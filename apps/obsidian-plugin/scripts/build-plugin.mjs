import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(scriptDir, "..");
const workspaceRoot = path.resolve(pluginRoot, "..", "..");
const workspaceRequire = createRequire(path.join(workspaceRoot, "package.json"));
const packageJsonPath = path.join(workspaceRoot, "package.json");
const manifestPath = path.join(pluginRoot, "manifest.json");
const releaseRoot = path.join(workspaceRoot, ".obsidian-plugin-build");
const { build } = await import(pathToFileURL(workspaceRequire.resolve("esbuild")).href);
const workspaceQuartzPackageRoot = path.dirname(
  createRequire(path.join(workspaceRoot, "packages", "builder-adapter-quartz", "package.json")).resolve("@jackyzha0/quartz/package.json")
);
const workspaceQuartzPackageJson = JSON.parse(await readFile(path.join(workspaceQuartzPackageRoot, "package.json"), "utf8"));

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const pluginId = manifest.id;
const pluginReleaseDir = path.join(releaseRoot, pluginId);

await rm(pluginReleaseDir, { recursive: true, force: true });
await mkdir(pluginReleaseDir, { recursive: true });

await build({
  bundle: true,
  entryPoints: [path.join(pluginRoot, "src", "main.ts")],
  external: ["obsidian", "electron"],
  format: "cjs",
  logLevel: "info",
  outfile: path.join(pluginReleaseDir, "main.js"),
  platform: "node",
  sourcemap: false,
  target: "es2020",
  treeShaking: true,
  banner: {
    js: "/* Obsidian Site Publisher plugin bundle */"
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production")
  }
});

await bundleQuartzRuntime();
await cp(manifestPath, path.join(pluginReleaseDir, "manifest.json"), { force: true });
await writeFile(
  path.join(pluginReleaseDir, "versions.json"),
  JSON.stringify(
    {
      [packageJson.version]: manifest.minAppVersion
    },
    null,
    2
  ),
  "utf8"
);

console.log(`Obsidian plugin bundle written to ${pluginReleaseDir}`);

async function bundleQuartzRuntime() {
  const temporaryRuntimeDir = await mkdtemp(path.join(os.tmpdir(), `${pluginId}-runtime-`));
  const bundledRuntimeDir = path.join(pluginReleaseDir, "runtime");

  try {
    const quartzTarballName = await packQuartzRuntime(temporaryRuntimeDir);

    await writeRuntimePackageJson(temporaryRuntimeDir, quartzTarballName);
    await runCommand(resolveNpmExecutable(), ["install"], {
      cwd: temporaryRuntimeDir
    });
    await pruneBundledQuartzRuntime(temporaryRuntimeDir, quartzTarballName);
    await mkdir(bundledRuntimeDir, { recursive: true });
    await cp(temporaryRuntimeDir, bundledRuntimeDir, {
      dereference: true,
      force: true,
      recursive: true
    });
  } finally {
    await rm(temporaryRuntimeDir, { recursive: true, force: true });
  }

  await assertBundledQuartzRuntime(bundledRuntimeDir);
}

async function packQuartzRuntime(temporaryRuntimeDir) {
  const output = await runCommand(resolveNpmExecutable(), ["pack", "--pack-destination", temporaryRuntimeDir], {
    captureOutput: true,
    cwd: workspaceQuartzPackageRoot
  });

  return output.trim().split(/\r?\n/u).at(-1) ?? "jackyzha0-quartz.tgz";
}

async function writeRuntimePackageJson(temporaryRuntimeDir, quartzTarballName) {
  await writeFile(
    path.join(temporaryRuntimeDir, "package.json"),
    JSON.stringify(
      {
        name: "osp-quartz-runtime",
        private: true,
        type: "module",
        dependencies: {
          "@jackyzha0/quartz": `file:./${quartzTarballName}`,
          esbuild: workspaceQuartzPackageJson.devDependencies?.esbuild ?? "^0.27.2"
        }
      },
      null,
      2
    ),
    "utf8"
  );
}

async function pruneBundledQuartzRuntime(runtimeRoot, quartzTarballName) {
  await Promise.all(
    [quartzTarballName, "package-lock.json"].map(async (entry) => {
      await rm(path.join(runtimeRoot, entry), { recursive: true, force: true });
    })
  );
}

async function assertBundledQuartzRuntime(runtimeRoot) {
  const runtimeRequire = createRequire(path.join(runtimeRoot, "package.json"));

  runtimeRequire.resolve("@jackyzha0/quartz/package.json");
  runtimeRequire.resolve("esbuild/package.json");
}

async function runCommand(command, args, options) {
  const stdoutChunks = [];
  const stderrChunks = [];

  await new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : command,
      process.platform === "win32"
        ? ["/d", "/s", "/c", buildCommandLine(command, args)]
        : args,
      {
        cwd: options.cwd,
        shell: false,
        stdio: options.captureOutput ? "pipe" : "inherit",
        windowsHide: true
      }
    );

    if (options.captureOutput) {
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (chunk) => stdoutChunks.push(chunk));
      child.stderr?.on("data", (chunk) => stderrChunks.push(chunk));
    }

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          [
            `${command} ${args.join(" ")} exited with code ${code ?? 1}.`,
            stderrChunks.join("").trim()
          ]
            .filter((message) => message !== "")
            .join(" ")
        )
      );
    });
  });

  return stdoutChunks.join("");
}

function resolveNpmExecutable() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function buildCommandLine(command, args) {
  return [command, ...args].map(quoteShellArgument).join(" ");
}

function quoteShellArgument(argument) {
  return /[\s"]/u.test(argument) ? `"${argument.replace(/"/g, '\\"')}"` : argument;
}
