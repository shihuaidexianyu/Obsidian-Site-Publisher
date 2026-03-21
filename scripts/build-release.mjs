import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
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
const cliPackageRoot = path.join(stagingRoot, "publisher-cli-package");
const externalRuntimeRoot = path.join(stagingRoot, "external-runtime");
const nativeCliRoot = path.join(stagingRoot, "native-cli");
const pluginBundleRoot = path.join(workspaceRoot, ".obsidian-plugin-build", pluginManifest.id);
const publisherCliPackageRoot = path.join(workspaceRoot, "apps", "publisher-cli");
const platformLabel = `${process.platform}-${process.arch}`;

await rm(releaseRoot, { recursive: true, force: true });
await mkdir(artifactsRoot, { recursive: true });
await mkdir(stagingRoot, { recursive: true });

await runCommand(resolveCorepackCommand(), ["pnpm", "build"], workspaceRoot);
const releasePreparationResults = await Promise.all([
  runCommand(resolveCorepackCommand(), ["pnpm", "build:obsidian-plugin"], workspaceRoot),
  installExternalRuntimeDependencies(externalRuntimeRoot),
  buildNativeCli({
    outputDirectory: nativeCliRoot
  })
]);
const nativeCli = releasePreparationResults[2];

await mkdir(cliPackageRoot, { recursive: true });
await copyReleaseEntry(externalRuntimeRoot, cliPackageRoot, "node_modules");
await materializeWorkspacePackages(path.join(workspaceRoot, "packages"), path.join(cliPackageRoot, "node_modules"));
await copyReleaseEntry(publisherCliPackageRoot, cliPackageRoot, "dist");
await copyReleaseEntry(publisherCliPackageRoot, cliPackageRoot, "package.json");

const pluginPackageRoot = path.join(stagingRoot, pluginManifest.id);
const bundledNodeExecutableName = process.platform === "win32" ? "node.exe" : "node";
await cp(pluginBundleRoot, pluginPackageRoot, { recursive: true });
await mkdir(path.join(pluginPackageRoot, "bin"), { recursive: true });
await cp(nativeCli.outputExecutablePath, path.join(pluginPackageRoot, "bin", path.basename(nativeCli.outputExecutablePath)), { force: true });
await cp(process.execPath, path.join(pluginPackageRoot, "bin", bundledNodeExecutableName), { force: true });
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

async function installExternalRuntimeDependencies(targetRoot) {
  const dependencies = await collectExternalRuntimeDependencies();
  const cacheRoot = path.join(workspaceRoot, ".release-cache", "external-runtime", createDependencyCacheKey(dependencies));
  const readyMarkerPath = path.join(cacheRoot, ".ready");

  await rm(targetRoot, { recursive: true, force: true });

  if (await pathExists(readyMarkerPath)) {
    await cp(cacheRoot, targetRoot, { recursive: true, force: true });
    return;
  }

  const temporaryCacheRoot = `${cacheRoot}.tmp-${process.pid}`;
  await rm(temporaryCacheRoot, { recursive: true, force: true });
  await mkdir(temporaryCacheRoot, { recursive: true });
  await writeExternalRuntimePackageJson(temporaryCacheRoot, dependencies);
  await runCommand("npm", ["install", "--omit=dev", "--prefer-offline", "--no-audit", "--no-fund"], temporaryCacheRoot);
  await writeFile(readyMarkerPath.replace(cacheRoot, temporaryCacheRoot), "", "utf8");

  await rm(cacheRoot, { recursive: true, force: true });
  await mkdir(path.dirname(cacheRoot), { recursive: true });
  await cp(temporaryCacheRoot, cacheRoot, { recursive: true, force: true });
  await rm(temporaryCacheRoot, { recursive: true, force: true });
  await cp(cacheRoot, targetRoot, { recursive: true, force: true });
}

async function collectExternalRuntimeDependencies() {
  const packagesRoot = path.join(workspaceRoot, "packages");
  const packageDirectories = await readdir(packagesRoot, { withFileTypes: true });
  const dependencies = {};

  for (const directory of packageDirectories) {
    if (!directory.isDirectory()) {
      continue;
    }

    const packageJsonPath = path.join(packagesRoot, directory.name, "package.json");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

    for (const [dependencyName, dependencyVersion] of Object.entries(packageJson.dependencies ?? {})) {
      if (dependencyName.startsWith("@osp/") || dependencyVersion.startsWith("workspace:")) {
        continue;
      }

      dependencies[dependencyName] = dependencyVersion;
    }
  }

  return dependencies;
}

function createDependencyCacheKey(dependencies) {
  return createHash("sha256")
    .update(JSON.stringify({
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      dependencies
    }))
    .digest("hex")
    .slice(0, 16);
}

async function writeExternalRuntimePackageJson(targetRoot, dependencies) {
  await writeFile(
    path.join(targetRoot, "package.json"),
    JSON.stringify(
      {
        name: "osp-external-runtime",
        private: true,
        type: "module",
        dependencies
      },
      null,
      2
    ),
    "utf8"
  );
}

async function mergeDirectoryContents(sourceDirectory, targetDirectory) {
  await mkdir(targetDirectory, { recursive: true });

  for (const entry of await readdir(sourceDirectory, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const targetPath = path.join(targetDirectory, entry.name);

    await cp(sourcePath, targetPath, {
      recursive: true,
      force: true,
      dereference: true,
      filter: (copiedPath) => shouldIncludeRuntimePath(path.relative(sourcePath, copiedPath))
    });
  }
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function materializeWorkspacePackages(packagesRoot, nodeModulesRoot) {
  const packageDirectories = await readdir(packagesRoot, { withFileTypes: true });

  for (const directory of packageDirectories) {
    if (!directory.isDirectory()) {
      continue;
    }

    const sourcePackageRoot = path.join(packagesRoot, directory.name);
    const packageJson = JSON.parse(await readFile(path.join(sourcePackageRoot, "package.json"), "utf8"));
    const targetPackageRoot = path.join(nodeModulesRoot, ...packageJson.name.split("/"));

    await rm(targetPackageRoot, { recursive: true, force: true });
    await mkdir(targetPackageRoot, { recursive: true });
    await copyReleaseEntry(sourcePackageRoot, targetPackageRoot, "dist");
    await copyReleaseEntry(sourcePackageRoot, targetPackageRoot, "package.json");
  }
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
