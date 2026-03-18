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
      statusMessage: "站点预览已启动：http://localhost:8080"
    });
    const controller = new PluginCommandController(shell, host, () => createConfig("/vault"));

    await controller.runCommand("preview");

    expect(shell.runCommand).toHaveBeenCalledWith("preview", createConfig("/vault"));
    expect(host.beginProgress).toHaveBeenCalledWith("preview");
    expect(host.setStatus).toHaveBeenCalledWith("站点发布：预览已启动");
    expect(host.showNotice).toHaveBeenCalledWith("站点预览已启动：http://localhost:8080");
    expect(host.refreshViews).toHaveBeenCalledOnce();
  });

  it("surfaces command failures as readable host messages", async () => {
    const host = createHost();
    const shell = {
      getCommandDefinitions: vi.fn(() => []),
      runCommand: vi.fn(async () => {
        throw new Error("Cannot preview in strict mode while 2 warning issue(s) remain unresolved.");
      })
    };
    const controller = new PluginCommandController(shell, host, () => createConfig("/vault"));

    await controller.runCommand("preview");

    expect(host.beginProgress).toHaveBeenCalledWith("preview");
    expect(host.setStatus).toHaveBeenCalledWith("站点发布：预览失败");
    expect(host.showNotice).toHaveBeenCalledWith(
      "预览失败：Cannot preview in strict mode while 2 warning issue(s) remain unresolved."
    );
    expect(host.refreshViews).toHaveBeenCalledOnce();
  });

  it("reveals only the issue view for build-oriented commands", async () => {
    const host = createHost();
    const shell = createShell({
      statusMessage: "站点构建完成。"
    });
    const controller = new PluginCommandController(shell, host, () => createConfig("/vault"));

    await controller.runCommand("build");

    expect(host.revealIssueListView).toHaveBeenCalledOnce();
    expect(host.revealBuildLogView).not.toHaveBeenCalled();
    expect(host.refreshViews).toHaveBeenCalledOnce();
  });

  it("prevents starting a second command while one is still running", async () => {
    let resolveCommand: (() => void) | undefined;
    const host = createHost();
    const shell = {
      getCommandDefinitions: vi.fn(() => []),
      runCommand: vi.fn(() => new Promise<PluginCommandResult>((resolve) => {
        resolveCommand = () => resolve(createCommandResult("build", "站点构建完成。"));
      }))
    };
    const controller = new PluginCommandController(shell, host, () => createConfig("/vault"));

    const firstRun = controller.runCommand("build");
    await controller.runCommand("publish");
    resolveCommand?.();
    await firstRun;

    expect(shell.runCommand).toHaveBeenCalledTimes(1);
    expect(host.showNotice).toHaveBeenCalledWith("已有任务正在运行：构建。请等待当前任务完成。");
  });
});

function createShell(options: { statusMessage?: string } = {}) {
  const definitions: PluginCommandDefinition[] = [
    { id: "osp:preview", name: "启动站点预览", command: "preview" },
    { id: "osp:build", name: "构建站点", command: "build" },
    { id: "osp:publish", name: "发布站点", command: "publish" },
    { id: "osp:issues", name: "检查发布问题", command: "issues" }
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
    beginProgress: vi.fn(() => vi.fn()),
    showNotice: vi.fn(),
    revealIssueListView: vi.fn(async () => {}),
    revealBuildLogView: vi.fn(async () => {}),
    refreshViews: vi.fn()
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
