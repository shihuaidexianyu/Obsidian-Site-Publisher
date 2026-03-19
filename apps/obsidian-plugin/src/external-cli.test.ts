import path from "node:path";
import os from "node:os";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  resolveBundledCliCommand,
  resolveBundledQuartzPackageRoot,
  resolveCliCommand,
  resolveCliLogDirectory
} from "./external-cli.js";

describe("external CLI helpers", () => {
  it("uses the configured CLI executable path when provided", () => {
    expect(
      resolveCliCommand("/vault", "/plugin", {
        executablePath: "./tools/publisher-cli.cmd"
      })
    ).toBe(path.resolve("/vault", "./tools/publisher-cli.cmd"));
  });

  it("falls back to the default publisher-cli command when no path is configured", () => {
    expect(resolveCliCommand("/vault", "/plugin", {})).toBe(process.platform === "win32" ? "publisher-cli.cmd" : "publisher-cli");
  });

  it("resolves the configured CLI log directory against the vault root", () => {
    expect(
      resolveCliLogDirectory("/vault", {
        logDirectory: ".osp/logs"
      })
    ).toBe(path.resolve("/vault", ".osp/logs"));
  });

  it("returns undefined when the CLI log directory is not configured", () => {
    expect(resolveCliLogDirectory("/vault", {})).toBeUndefined();
  });

  it("prefers a bundled CLI executable when no explicit CLI path is configured", async () => {
    const pluginRoot = await mkdtemp(path.join(os.tmpdir(), "osp-plugin-bin-"));

    try {
      const bundledCliPath = path.join(pluginRoot, "bin", process.platform === "win32" ? "publisher-cli.exe" : "publisher-cli");

      await mkdir(path.dirname(bundledCliPath), { recursive: true });
      await writeFile(bundledCliPath, "stub", "utf8");

      expect(resolveBundledCliCommand(pluginRoot)).toBe(bundledCliPath);
      expect(resolveCliCommand("/vault", pluginRoot, {})).toBe(bundledCliPath);
    } finally {
      await rm(pluginRoot, { recursive: true, force: true });
    }
  });

  it("locates the bundled Quartz runtime when the plugin ships its own CLI", async () => {
    const pluginRoot = await mkdtemp(path.join(os.tmpdir(), "osp-plugin-runtime-"));

    try {
      const bundledCliPath = path.join(pluginRoot, "bin", process.platform === "win32" ? "publisher-cli.exe" : "publisher-cli");
      const quartzPackageRoot = path.join(pluginRoot, "bin", "runtime", "app", "node_modules", "@jackyzha0", "quartz");

      await mkdir(path.dirname(bundledCliPath), { recursive: true });
      await writeFile(bundledCliPath, "stub", "utf8");
      await mkdir(quartzPackageRoot, { recursive: true });
      await writeFile(path.join(quartzPackageRoot, "package.json"), "{\"name\":\"@jackyzha0/quartz\"}", "utf8");

      expect(resolveBundledQuartzPackageRoot(pluginRoot, {})).toBe(quartzPackageRoot);
    } finally {
      await rm(pluginRoot, { recursive: true, force: true });
    }
  });
});
