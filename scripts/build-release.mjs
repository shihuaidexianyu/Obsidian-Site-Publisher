import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ZipFile } from "yazl";

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
const cliPackageRoot = path.join(stagingRoot, "publisher-cli-package");
const cliDeployRootRelative = path.relative(workspaceRoot, cliDeployRoot);
const pluginBundleRoot = path.join(workspaceRoot, ".obsidian-plugin-build", pluginManifest.id);

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

await sanitizeCliDeployDirectory(cliDeployRoot);
await mkdir(cliPackageRoot, { recursive: true });
await copyReleaseEntry(cliDeployRoot, cliPackageRoot, "dist");
await copyReleaseEntry(cliDeployRoot, cliPackageRoot, "node_modules");
await copyReleaseEntry(cliDeployRoot, cliPackageRoot, "package.json");
await copyReleaseEntry(cliDeployRoot, cliPackageRoot, "tsconfig.json");

const pluginPackageRoot = path.join(stagingRoot, pluginManifest.id);
await cp(pluginBundleRoot, pluginPackageRoot, { recursive: true });

const pluginArchivePath = path.join(artifactsRoot, `obsidian-site-publisher-plugin-${version}.zip`);
const cliArchiveName = `publisher-cli-portable-${version}.zip`;

await createZipArchive(pluginPackageRoot, pluginArchivePath, pluginManifest.id);
await createZipArchiveWithExtras(cliPackageRoot, path.join(artifactsRoot, cliArchiveName), "publisher-cli", [
  {
    zipPath: path.posix.join("publisher-cli", "publisher-cli.cmd"),
    contents: ["@echo off", "setlocal", "set SCRIPT_DIR=%~dp0", "node \"%SCRIPT_DIR%dist\\main.js\" %*"].join("\r\n"),
    mode: 0o644
  },
  {
    zipPath: path.posix.join("publisher-cli", "publisher-cli"),
    contents: [
      "#!/usr/bin/env sh",
      "set -eu",
      "SCRIPT_DIR=$(CDPATH= cd -- \"$(dirname -- \"$0\")\" && pwd)",
      "node \"$SCRIPT_DIR/dist/main.js\" \"$@\""
    ].join("\n"),
    mode: 0o755
  },
  {
    zipPath: path.posix.join("publisher-cli", "README.txt"),
    contents: createCliInstallGuide(),
    mode: 0o644
  }
]);

await writeFile(
  path.join(artifactsRoot, "release-manifest.json"),
  JSON.stringify(
    {
      version,
      plugin: path.basename(pluginArchivePath),
      cli: [
        {
          platform: "portable",
          archive: cliArchiveName
        }
      ]
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

function createCliInstallGuide() {
  return [
    "Obsidian Site Publisher CLI",
    "",
    "This package requires Node.js 20 or newer.",
    "",
    "Usage:",
    `1. Extract this archive to any directory, for example C:\\Tools\\publisher-cli or ~/Tools/publisher-cli`,
    "2. On Windows, point the plugin setting \"CLI 可执行文件路径\" at publisher-cli.cmd",
    "3. On macOS or Linux, point it at publisher-cli",
    "4. Alternatively, add the extracted directory to PATH and leave the plugin setting empty"
  ].join("\n");
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

async function createZipArchiveWithExtras(sourceDir, archivePath, rootDirectoryName, extraFiles) {
  const zipFile = new ZipFile();
  const output = createWriteStream(archivePath);

  const closePromise = new Promise((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
    zipFile.outputStream.on("error", reject);
  });

  zipFile.outputStream.pipe(output);
  await addDirectoryToZip(zipFile, sourceDir, rootDirectoryName);

  for (const file of extraFiles) {
    zipFile.addBuffer(Buffer.from(file.contents, "utf8"), file.zipPath, { mode: file.mode, compress: false });
  }

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
