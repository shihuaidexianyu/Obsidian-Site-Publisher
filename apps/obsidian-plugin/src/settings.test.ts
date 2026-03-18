import type { PublisherConfig } from "@osp/shared";
import { describe, expect, it, vi } from "vitest";

import type { PluginExecutionBackend } from "./plugin-backend.js";
import { PublisherPluginShell } from "./plugin-shell.js";
import { loadPluginSettings, mergePluginSettings, savePluginSettings } from "./settings.js";

describe("plugin settings", () => {
  it("merges stored config on top of shell defaults while preserving vault root", () => {
    const shell = new PublisherPluginShell(() => createBackend());

    const settings = mergePluginSettings(shell, "/vault", {
      config: {
        publishMode: "folder",
        publishRoot: "Public",
        deployTarget: "github-pages",
        deployRepositoryUrl: "https://github.com/example/example.github.io",
        deployBranch: "main",
        strictMode: true,
        vaultRoot: "/other"
      }
    });

    expect(settings.config).toMatchObject({
      vaultRoot: "/vault",
      publishMode: "folder",
      publishRoot: "Public",
      deployTarget: "github-pages",
      deployRepositoryUrl: "https://github.com/example/example.github.io",
      deployBranch: "main",
      strictMode: true
    });
  });

  it("loads defaults when no stored data is present", async () => {
    const shell = new PublisherPluginShell(() => createBackend());
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

  it("falls back to defaults when stored data does not match the schema", async () => {
    const shell = new PublisherPluginShell(() => createBackend());
    const store = {
      loadData: vi.fn(async () => ({
        config: {
          strictMode: "yes"
        }
      })),
      saveData: vi.fn(async () => {})
    };

    const settings = await loadPluginSettings(store, shell, "/vault");

    expect(settings.config).toMatchObject({
      vaultRoot: "/vault",
      strictMode: false
    });
  });

  it("persists settings through the provided store", async () => {
    const shell = new PublisherPluginShell(() => createBackend());
    const settings = mergePluginSettings(shell, "/vault");
    const store = {
      loadData: vi.fn(async () => null),
      saveData: vi.fn(async () => {})
    };

    await savePluginSettings(store, settings);

    expect(store.saveData).toHaveBeenCalledWith(settings);
  });

  it("keeps deploy-related optional fields when loading valid stored settings", async () => {
    const shell = new PublisherPluginShell(() => createBackend());
    const store = {
      loadData: vi.fn(async () => ({
        config: {
          deployTarget: "git-branch",
          deployRepositoryUrl: "https://github.com/example/site.git",
          deployBranch: "gh-pages",
          deployCommitMessage: "Publish docs"
        }
      })),
      saveData: vi.fn(async () => {})
    };

    const settings = await loadPluginSettings(store, shell, "/vault");

    expect(settings.config).toMatchObject({
      deployTarget: "git-branch",
      deployRepositoryUrl: "https://github.com/example/site.git",
      deployBranch: "gh-pages",
      deployCommitMessage: "Publish docs"
    });
  });
});

function createBackend(): PluginExecutionBackend {
  return {
    scan: vi.fn(),
    build: vi.fn(),
    preview: vi.fn(),
    publish: vi.fn(),
    dispose: vi.fn(async () => {})
  };
}
