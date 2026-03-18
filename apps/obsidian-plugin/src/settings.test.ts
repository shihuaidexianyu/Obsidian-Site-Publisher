import type { PublisherConfig } from "@osp/shared";
import { describe, expect, it, vi } from "vitest";

import { PublisherPluginShell } from "./plugin-shell.js";
import { loadPluginSettings, mergePluginSettings, savePluginSettings } from "./settings.js";

describe("plugin settings", () => {
  it("merges stored config on top of shell defaults while preserving vault root", () => {
    const shell = new PublisherPluginShell(() => createRuntime());

    const settings = mergePluginSettings(shell, "/vault", {
      config: {
        publishMode: "folder",
        publishRoot: "Public",
        strictMode: true,
        vaultRoot: "/other"
      }
    });

    expect(settings.config).toMatchObject({
      vaultRoot: "/vault",
      publishMode: "folder",
      publishRoot: "Public",
      strictMode: true
    });
  });

  it("loads defaults when no stored data is present", async () => {
    const shell = new PublisherPluginShell(() => createRuntime());
    const store = {
      loadData: vi.fn(async () => null),
      saveData: vi.fn(async () => {})
    };

    const settings = await loadPluginSettings(store, shell, "/vault");

    expect(settings.config).toMatchObject({
      vaultRoot: "/vault",
      outputDir: "/vault/.osp/dist"
    });
  });

  it("persists settings through the provided store", async () => {
    const shell = new PublisherPluginShell(() => createRuntime());
    const settings = mergePluginSettings(shell, "/vault");
    const store = {
      loadData: vi.fn(async () => null),
      saveData: vi.fn(async () => {})
    };

    await savePluginSettings(store, settings);

    expect(store.saveData).toHaveBeenCalledWith(settings);
  });
});

function createRuntime() {
  return {
    orchestrator: {
      scan: vi.fn(),
      build: vi.fn(),
      preview: vi.fn(),
      deployFromBuild: vi.fn()
    },
    stop: vi.fn(async () => {})
  };
}
