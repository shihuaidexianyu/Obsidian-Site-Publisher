import type { PublisherConfig } from "@osp/shared";
import { describe, expect, it, vi } from "vitest";

import type { PluginCommand, PluginCommandDefinition, PluginCommandResult } from "./plugin-shell.js";
import { PluginCommandController } from "./plugin-controller.js";

describe("PluginCommandController", () => {
  it("registers every shell command with the host", () => {
    const host = createHost();
    const shell = createShell();
    const controller = new PluginCommandController(shell, host, () => createConfig("/vault"));

    controller.registerCommands();

    expect(host.registerCommand).toHaveBeenCalledTimes(4);
  });

  it("updates the host status and notice after a command completes", async () => {
    const host = createHost();
    const shell = createShell({
      statusMessage: "Preview ready at http://localhost:8080"
    });
    const controller = new PluginCommandController(shell, host, () => createConfig("/vault"));

    await controller.runCommand("preview");

    expect(shell.runCommand).toHaveBeenCalledWith("preview", createConfig("/vault"));
    expect(host.setStatus).toHaveBeenCalledWith("Preview ready at http://localhost:8080");
    expect(host.showNotice).toHaveBeenCalledWith("Preview ready at http://localhost:8080");
  });
});

function createShell(options: { statusMessage?: string } = {}) {
  const definitions: PluginCommandDefinition[] = [
    { id: "osp:preview", name: "Preview Site", command: "preview" },
    { id: "osp:build", name: "Build Site", command: "build" },
    { id: "osp:publish", name: "Publish Site", command: "publish" },
    { id: "osp:issues", name: "Show Publish Issues", command: "issues" }
  ];

  return {
    getCommandDefinitions: vi.fn(() => definitions),
    runCommand: vi.fn(async (command: PluginCommand) => createCommandResult(command, options.statusMessage ?? "Done"))
  };
}

function createHost() {
  return {
    registerCommand: vi.fn(),
    setStatus: vi.fn(),
    showNotice: vi.fn()
  };
}

function createConfig(vaultRoot: string): PublisherConfig {
  return {
    vaultRoot,
    publishMode: "frontmatter",
    includeGlobs: [],
    excludeGlobs: [],
    outputDir: `${vaultRoot}/.osp/dist`,
    builder: "quartz",
    deployTarget: "none",
    enableSearch: true,
    enableBacklinks: true,
    enableGraph: true,
    strictMode: false
  };
}

function createCommandResult(command: PluginCommand, statusMessage: string): PluginCommandResult {
  if (command === "preview") {
    return {
      command,
      session: {
        url: "http://localhost:8080",
        workspaceRoot: "/vault/.osp/preview",
        startedAt: new Date().toISOString()
      },
      statusMessage
    };
  }

  if (command === "build") {
    return {
      command,
      result: {
        success: true,
        outputDir: "/vault/.osp/dist",
        manifestPath: "/vault/.osp/build/manifest.json",
        issues: [],
        logs: [],
        durationMs: 1
      },
      statusMessage
    };
  }

  if (command === "issues") {
    return {
      command,
      manifest: {
        generatedAt: new Date().toISOString(),
        vaultRoot: "/vault",
        notes: [],
        assetFiles: [],
        unsupportedObjects: []
      },
      issues: [],
      statusMessage
    };
  }

  return {
    command,
    build: {
      success: true,
      outputDir: "/vault/.osp/dist",
      manifestPath: "/vault/.osp/build/manifest.json",
      issues: [],
      logs: [],
      durationMs: 1
    },
    statusMessage
  };
}
