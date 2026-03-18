import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
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

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const pluginId = manifest.id;
const pluginReleaseDir = path.join(releaseRoot, pluginId);
const temporaryRuntimeDir = path.join(releaseRoot, `${pluginId}-runtime-tmp`);

await rm(pluginReleaseDir, { recursive: true, force: true });
await rm(temporaryRuntimeDir, { recursive: true, force: true });
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
  await runWorkspaceCommand("corepack", ["pnpm", "--filter", "@osp/builder-adapter-quartz", "deploy", "--prod", "--legacy", temporaryRuntimeDir]);
  await cp(temporaryRuntimeDir, path.join(pluginReleaseDir, "runtime"), {
    dereference: true,
    force: true,
    recursive: true
  });
  await rm(temporaryRuntimeDir, { recursive: true, force: true });
  await pruneBundledQuartzRuntime(path.join(pluginReleaseDir, "runtime"));
}

async function pruneBundledQuartzRuntime(runtimeRoot) {
  await Promise.all(
    ["dist", "src", "index.ts", "README.md", "tsconfig.json"].map(async (entry) => {
      await rm(path.join(runtimeRoot, entry), { recursive: true, force: true });
    })
  );
}

async function runWorkspaceCommand(command, args) {
  const commandLine = `${quoteShellArgument(command)} ${args.map(quoteShellArgument).join(" ")}`;

  await new Promise((resolve, reject) => {
    const child = spawn(commandLine, [], {
      cwd: workspaceRoot,
      shell: true,
      stdio: "inherit",
      windowsHide: true
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? 1}.`));
    });
  });
}

function quoteShellArgument(argument) {
  return /[\s"]/u.test(argument) ? JSON.stringify(argument) : argument;
}
