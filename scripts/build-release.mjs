import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ZipFile } from "yazl";

import { buildNativeCli } from "./build-native-cli.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, "..");
const rootPackageJson = JSON.parse(await readFile(path.join(workspaceRoot, "package.json"), "utf8"));
const pluginManifest = JSON.parse(
  await readFile(path.join(workspaceRoot, "apps", "obsidian-plugin", "manifest.json"), "utf8")
);
const version = rootPackageJson.version;
const releaseRoot = path.join(workspaceRoot, ".release", `v${version}`);
const artifactsRoot = path.join(releaseRoot, "artifacts");
const stagingRoot = path.join(releaseRoot, "staging");
const cliDeployRoot = path.join(stagingRoot, "publisher-cli");
const coreDeployRoot = path.join(stagingRoot, "core-runtime");
const cliPackageRoot = path.join(stagingRoot, "publisher-cli-package");
const nativeCliRoot = path.join(stagingRoot, "native-cli");
const cliDeployRootRelative = path.relative(workspaceRoot, cliDeployRoot);
const coreDeployRootRelative = path.relative(workspaceRoot, coreDeployRoot);
const pluginBundleRoot = path.join(workspaceRoot, ".obsidian-plugin-build", pluginManifest.id);
const platformLabel = `${process.platform}-${process.arch}`;

await rm(releaseRoot, { recursive: true, force: true });
await mkdir(artifactsRoot, { recursive: true });
await mkdir(stagingRoot, { recursive: true });

await runCommand(resolveCorepackCommand(), ["pnpm", "build"], workspaceRoot);
await runCommand(resolveCorepackCommand(), ["pnpm", "build:obsidian-plugin"], workspaceRoot);
await runCommand(
  resolveCorepackCommand(),
  ["pnpm", "deploy", "--legacy", "--filter", "@osp/publisher-cli", "--prod", cliDeployRootRelative],
  workspaceRoot
);
await runCommand(
  resolveCorepackCommand(),
  ["pnpm", "deploy", "--legacy", "--filter", "@osp/core", "--prod", coreDeployRootRelative],
  workspaceRoot
);

await sanitizeCliDeployDirectory(cliDeployRoot);
await mkdir(cliPackageRoot, { recursive: true });
await copyReleaseEntry(coreDeployRoot, cliPackageRoot, "node_modules");
await copyReleaseEntry(cliDeployRoot, cliPackageRoot, "dist");
await copyReleaseEntry(cliDeployRoot, cliPackageRoot, "package.json");
await copyReleaseEntry(cliDeployRoot, cliPackageRoot, "tsconfig.json");
const nativeCli = await buildNativeCli({
  outputDirectory: nativeCliRoot
});

const pluginPackageRoot = path.join(stagingRoot, pluginManifest.id);
await cp(pluginBundleRoot, pluginPackageRoot, { recursive: true });
await mkdir(path.join(pluginPackageRoot, "bin"), { recursive: true });
await cp(nativeCli.outputExecutablePath, path.join(pluginPackageRoot, "bin", path.basename(nativeCli.outputExecutablePath)), { force: true });
await cp(cliPackageRoot, path.join(pluginPackageRoot, "bin", "runtime", "app"), { recursive: true, dereference: true });

const pluginArchiveName = `obsidian-site-publisher-${platformLabel}-${version}.zip`;
const pluginArchivePath = path.join(artifactsRoot, pluginArchiveName);

await createZipArchive(pluginPackageRoot, pluginArchivePath, pluginManifest.id);

await writeFile(
  path.join(artifactsRoot, "release-manifest.json"),
  JSON.stringify(
    {
      version,
      platform: platformLabel,
      plugin: path.basename(pluginArchivePath),
      bundledCli: path.basename(nativeCli.outputExecutablePath)
    },
    null,
    2
  ),
  "utf8"
);

console.log(`Release artifacts written to ${artifactsRoot}`);

function resolveCorepackCommand() {
  return "corepack";
}

async function runCommand(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child =
      process.platform === "win32"
        ? spawn("cmd.exe", ["/d", "/s", "/c", `${command} ${args.map(quoteWindowsArgument).join(" ")}`], {
            cwd,
            stdio: "inherit",
            windowsHide: true
          })
        : spawn(command, args, {
            cwd,
            stdio: "inherit",
            windowsHide: true
          });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed: ${command} ${args.join(" ")}`));
    });
  });
}

function quoteWindowsArgument(argument) {
  if (!/[ \t"]/u.test(argument)) {
    return argument;
  }

  return `"${argument.replace(/"/gu, '\\"')}"`;
}

async function sanitizeCliDeployDirectory(cliRoot) {
  await writeFile(
    path.join(cliRoot, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          allowJs: true,
          checkJs: false,
          resolveJsonModule: true,
          esModuleInterop: true,
          skipLibCheck: true
        }
      },
      null,
      2
    ),
    "utf8"
  );
}

async function copyReleaseEntry(sourceRoot, targetRoot, entryName) {
  const sourcePath = path.join(sourceRoot, entryName);
  const targetPath = path.join(targetRoot, entryName);
  const sourceStats = await stat(sourcePath);

  if (sourceStats.isDirectory()) {
    await cp(sourcePath, targetPath, {
      recursive: true,
      dereference: true,
      filter: (copiedPath) => shouldIncludeRuntimePath(path.relative(sourcePath, copiedPath))
    });
    return;
  }

  await cp(sourcePath, targetPath, { force: true });
}

function shouldIncludeRuntimePath(relativePath) {
  if (relativePath === "") {
    return true;
  }

  const normalizedPath = relativePath.replace(/\\/gu, "/");

  if (normalizedPath === ".release" || normalizedPath.startsWith(".release/") || normalizedPath.includes("/.release/")) {
    return false;
  }

  if (normalizedPath.startsWith(".tmp-") || normalizedPath.includes("/.tmp-")) {
    return false;
  }

  if (normalizedPath.endsWith(".tsbuildinfo") || normalizedPath.endsWith(".map")) {
    return false;
  }

  return true;
}

async function createZipArchive(sourceDir, archivePath, rootDirectoryName) {
  const zipFile = new ZipFile();
  const output = createWriteStream(archivePath);

  const closePromise = new Promise((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
    zipFile.outputStream.on("error", reject);
  });

  zipFile.outputStream.pipe(output);
  await addDirectoryToZip(zipFile, sourceDir, rootDirectoryName);
  zipFile.end();
  await closePromise;
}

async function addDirectoryToZip(zipFile, sourceDir, zipDir) {
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(sourceDir, entry.name);
    const zipPath = path.posix.join(zipDir, entry.name);
    const fileStats = await stat(absolutePath);

    if (fileStats.isDirectory()) {
      zipFile.addEmptyDirectory(zipPath);
      await addDirectoryToZip(zipFile, absolutePath, zipPath);
      continue;
    }

    zipFile.addFile(absolutePath, zipPath, { mode: fileStats.mode, mtime: fileStats.mtime, compress: false });
  }
}
