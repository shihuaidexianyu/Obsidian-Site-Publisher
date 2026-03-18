import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, "..");
const workspaceRequire = createRequire(path.join(workspaceRoot, "package.json"));
const nodeSeaFuse = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

export async function buildNativeCli(options = {}) {
  const outputDirectory = options.outputDirectory ?? path.join(workspaceRoot, ".release", "native-cli");
  const outputExecutableName = options.outputExecutableName ?? (process.platform === "win32" ? "publisher-cli.exe" : "publisher-cli");
  const stagingDirectory = path.join(outputDirectory, ".staging");
  const launcherPath = path.join(stagingDirectory, "publisher-cli-launcher.cjs");
  const seaConfigPath = path.join(stagingDirectory, "sea-config.json");
  const seaBlobPath = path.join(stagingDirectory, "sea-prep.blob");
  const outputExecutablePath = path.join(outputDirectory, outputExecutableName);

  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(stagingDirectory, { recursive: true });
  await writeFile(launcherPath, createLauncherSource(), "utf8");
  await writeFile(
    seaConfigPath,
    JSON.stringify(
      {
        main: launcherPath,
        output: seaBlobPath,
        useCodeCache: false,
        useSnapshot: false
      },
      null,
      2
    ),
    "utf8"
  );

  await runCommand(process.execPath, ["--experimental-sea-config", seaConfigPath], workspaceRoot);
  await copyFile(process.execPath, outputExecutablePath);
  await tryPrepareBaseBinary(outputExecutablePath);
  await runCommand(process.execPath, [resolvePostjectCliPath(), outputExecutablePath, "NODE_SEA_BLOB", seaBlobPath, "--sentinel-fuse", nodeSeaFuse], workspaceRoot);

  return {
    outputExecutablePath
  };
}

function createLauncherSource() {
  return [
    "const path = require('node:path');",
    "const { pathToFileURL } = require('node:url');",
    "",
    "(async () => {",
    "  const executableDirectory = path.dirname(process.execPath);",
    "  const cliEntrypoint = path.join(executableDirectory, 'runtime', 'app', 'dist', 'main.js');",
    "  const moduleUrl = pathToFileURL(cliEntrypoint).href;",
    "  const { runCli } = await import(moduleUrl);",
    "  process.exitCode = await runCli(process.argv.slice(2), {",
    "    cwd: process.cwd()",
    "  });",
    "})().catch((error) => {",
    "  const message = error instanceof Error ? error.stack ?? error.message : 'Native CLI failed with an unknown error.';",
    "  console.error(message);",
    "  process.exitCode = 1;",
    "});",
    ""
  ].join("\n");
}

async function tryPrepareBaseBinary(executablePath) {
  if (process.platform === "darwin") {
    await tryRunOptionalCommand("codesign", ["--remove-signature", executablePath]);
    return;
  }

  if (process.platform === "win32") {
    await tryRunOptionalCommand("signtool", ["remove", "/s", executablePath]);
  }
}

async function tryRunOptionalCommand(command, args) {
  try {
    await runCommand(command, args, workspaceRoot);
  } catch {}
}

function resolvePostjectCliPath() {
  const packageJsonPath = workspaceRequire.resolve("postject/package.json");
  const packageJson = workspaceRequire(packageJsonPath);
  const binPath = typeof packageJson.bin === "string" ? packageJson.bin : packageJson.bin.postject;

  return path.join(path.dirname(packageJsonPath), binPath);
}

async function runCommand(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputDirectory = process.argv[2];
  const result = await buildNativeCli(outputDirectory === undefined ? {} : { outputDirectory: path.resolve(workspaceRoot, outputDirectory) });

  console.log(`Native CLI written to ${result.outputExecutablePath}`);
}
