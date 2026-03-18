import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { resolveBundledQuartzPackageRoot, resolvePluginInstallRoot } from "./bundled-runtime.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directoryPath) => {
      await rm(directoryPath, { force: true, recursive: true });
    })
  );
});

describe("bundled runtime helpers", () => {
  it("resolves the plugin install root from the manifest dir when Obsidian provides it", () => {
    expect(
      resolvePluginInstallRoot("/vault", {
        dir: ".obsidian/plugins/obsidian-site-publisher",
        id: "obsidian-site-publisher"
      })
    ).toBe(path.resolve("/vault", ".obsidian/plugins/obsidian-site-publisher"));
  });

  it("falls back to the default plugin directory when manifest dir is missing", () => {
    expect(
      resolvePluginInstallRoot("/vault", {
        dir: undefined,
        id: "obsidian-site-publisher"
      })
    ).toBe(path.resolve("/vault", ".obsidian/plugins/obsidian-site-publisher"));
  });

  it("returns undefined when the plugin bundle does not contain a packaged Quartz runtime", () => {
    expect(resolveBundledQuartzPackageRoot("/missing-plugin")).toBeUndefined();
  });

  it("resolves the vendored Quartz package from the plugin runtime directory", async () => {
    const pluginRoot = await mkdtemp(path.join(os.tmpdir(), "osp-plugin-runtime-"));

    temporaryDirectories.push(pluginRoot);
    await mkdir(path.join(pluginRoot, "runtime", "node_modules", "@jackyzha0", "quartz"), { recursive: true });
    await writeFile(path.join(pluginRoot, "runtime", "package.json"), JSON.stringify({ name: "runtime" }), "utf8");
    await writeFile(
      path.join(pluginRoot, "runtime", "node_modules", "@jackyzha0", "quartz", "package.json"),
      JSON.stringify({ name: "@jackyzha0/quartz", version: "0.0.0-test" }),
      "utf8"
    );

    expect(resolveBundledQuartzPackageRoot(pluginRoot)).toBe(
      path.join(pluginRoot, "runtime", "node_modules", "@jackyzha0", "quartz")
    );
  });

  it("prefers the pnpm Quartz package path when the bundled runtime contains a virtual store", async () => {
    const pluginRoot = await mkdtemp(path.join(os.tmpdir(), "osp-plugin-runtime-"));

    temporaryDirectories.push(pluginRoot);
    await mkdir(
      path.join(
        pluginRoot,
        "runtime",
        "node_modules",
        ".pnpm",
        "@jackyzha0+quartz@test",
        "node_modules",
        "@jackyzha0",
        "quartz"
      ),
      { recursive: true }
    );
    await writeFile(path.join(pluginRoot, "runtime", "package.json"), JSON.stringify({ name: "runtime" }), "utf8");
    await writeFile(
      path.join(
        pluginRoot,
        "runtime",
        "node_modules",
        ".pnpm",
        "@jackyzha0+quartz@test",
        "node_modules",
        "@jackyzha0",
        "quartz",
        "package.json"
      ),
      JSON.stringify({ name: "@jackyzha0/quartz", version: "0.0.0-test" }),
      "utf8"
    );

    expect(resolveBundledQuartzPackageRoot(pluginRoot)).toBe(
      path.join(pluginRoot, "runtime", "node_modules", ".pnpm", "@jackyzha0+quartz@test", "node_modules", "@jackyzha0", "quartz")
    );
  });
});
