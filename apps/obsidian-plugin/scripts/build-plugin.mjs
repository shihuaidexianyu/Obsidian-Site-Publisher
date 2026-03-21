import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(scriptDir, "..");
const workspaceRoot = path.resolve(pluginRoot, "..", "..");
const workspaceRequire = createRequire(path.join(workspaceRoot, "package.json"));
const packageJsonPath = path.join(workspaceRoot, "package.json");
const manifestPath = path.join(pluginRoot, "manifest.json");
const stylesPath = path.join(pluginRoot, "styles.css");
const releaseRoot = path.join(workspaceRoot, ".obsidian-plugin-build");
const { build } = await import(pathToFileURL(workspaceRequire.resolve("esbuild")).href);

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

await cp(manifestPath, path.join(pluginReleaseDir, "manifest.json"), { force: true });
await cp(stylesPath, path.join(pluginReleaseDir, "styles.css"), { force: true });
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
