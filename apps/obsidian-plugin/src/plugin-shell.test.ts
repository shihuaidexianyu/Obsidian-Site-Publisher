import type { BuildResult, DeployResult, PreviewSession, PublisherConfig, VaultManifest } from "@osp/shared";
import { describe, expect, it, vi } from "vitest";

import type { PluginExecutionBackend } from "./plugin-backend.js";
import { PublisherPluginShell } from "./plugin-shell.js";

describe("PublisherPluginShell", () => {
  it("exposes the four plugin commands with stable ids", () => {
    const plugin = new PublisherPluginShell(() => createBackend());

    expect(plugin.getCommandDefinitions()).toEqual([
      { id: "osp:preview", name: "启动站点预览", command: "preview" },
      { id: "osp:build", name: "构建站点", command: "build" },
      { id: "osp:publish", name: "发布站点", command: "publish" },
      { id: "osp:issues", name: "检查发布问题", command: "issues" }
    ]);
  });

  it("creates a safe default config for Obsidian vaults", () => {
    const plugin = new PublisherPluginShell(() => createBackend());

    expect(plugin.createInitialConfig("/vault")).toMatchObject({
      vaultRoot: "/vault",
      outputDir: "/vault/.osp/dist",
      excludeGlobs: ["**/.git/**", "**/.obsidian/**", "**/.osp/**", "**/.trash/**", "**/node_modules/**"]
    });
  });

  it("runs the issues command through core scan and stores the latest issues", async () => {
    const backend = createBackend({
      scanResult: {
        manifest: createManifest("/vault"),
        issues: [
          {
            code: "BROKEN_LINK",
            severity: "error",
            file: "Broken.md",
            message: "Broken"
          }
        ]
      }
    });
    const plugin = new PublisherPluginShell(() => backend);

    const result = await plugin.runCommand("issues", createConfig("/vault"));

    expect(result.command).toBe("issues");
    expect(backend.scan).toHaveBeenCalledOnce();
    expect(plugin.getState()).toMatchObject({
      lastCommand: "issues",
      lastIssues: [
        {
          code: "BROKEN_LINK"
        }
      ],
      statusMessage: "发现 1 个发布问题。"
    });
  });

  it("runs build through core and stores logs for later UI rendering", async () => {
    const backend = createBackend({
      buildResult: createBuildResult({
        logs: [
          {
            level: "info",
            message: "Quartz build finished.",
            timestamp: new Date().toISOString()
          }
        ]
      })
    });
    const plugin = new PublisherPluginShell(() => backend);

    const result = await plugin.runCommand("build", createConfig("/vault"));

    expect(result.command).toBe("build");
    expect(backend.build).toHaveBeenCalledOnce();
    expect(plugin.getState()).toMatchObject({
      lastCommand: "build",
      lastLogs: [
        {
          message: "Quartz build finished."
        }
      ],
      statusMessage: "站点构建完成。"
    });
  });

  it("runs preview through core and stores the last preview session", async () => {
    const backend = createBackend();
    const plugin = new PublisherPluginShell(() => backend);

    const result = await plugin.runCommand("preview", createConfig("/vault"));

    expect(result.command).toBe("preview");
    expect(backend.preview).toHaveBeenCalledOnce();
    expect(plugin.getState()).toMatchObject({
      lastCommand: "preview",
      lastPreviewSession: {
        url: "http://localhost:8080"
      }
    });
    expect(backend.dispose).not.toHaveBeenCalled();
  });

  it("stops the previous preview before starting a new one", async () => {
    const firstBackend = createBackend({
      previewSession: {
        url: "http://localhost:8080",
        workspaceRoot: "/vault/.osp/preview-a",
        startedAt: new Date().toISOString()
      }
    });
    const secondBackend = createBackend({
      previewSession: {
        url: "http://localhost:8081",
        workspaceRoot: "/vault/.osp/preview-b",
        startedAt: new Date().toISOString()
      }
    });
    const plugin = new PublisherPluginShell(vi.fn().mockReturnValueOnce(firstBackend).mockReturnValueOnce(secondBackend));

    await plugin.runCommand("preview", createConfig("/vault"));
    await plugin.runCommand("preview", createConfig("/vault"));

    expect(firstBackend.dispose).toHaveBeenCalledOnce();
    expect(secondBackend.dispose).not.toHaveBeenCalled();
  });

  it("disposes the active preview runtime when the shell is disposed", async () => {
    const backend = createBackend();
    const plugin = new PublisherPluginShell(() => backend);

    await plugin.runCommand("preview", createConfig("/vault"));
    await plugin.dispose();

    expect(backend.dispose).toHaveBeenCalledOnce();
  });

  it("runs publish as build plus deploy and stores the deploy result", async () => {
    const backend = createBackend();
    const plugin = new PublisherPluginShell(() => backend);

    const result = await plugin.runCommand("publish", createConfig("/vault"));

    expect(result.command).toBe("publish");
    expect(backend.publish).toHaveBeenCalledOnce();
    expect(plugin.getState()).toMatchObject({
      lastCommand: "publish",
      lastDeployResult: {
        success: true
      },
      statusMessage: "站点发布成功。"
    });
  });

  it("does not deploy when publish build fails", async () => {
    const backend = createBackend({
      buildResult: createBuildResult({
        success: false
      })
    });
    const plugin = new PublisherPluginShell(() => backend);

    const result = await plugin.runCommand("publish", createConfig("/vault"));

    expect(result.command).toBe("publish");
    expect(backend.publish).toHaveBeenCalledOnce();
    expect(plugin.getState().statusMessage).toBe("发布已停止，因为构建没有成功。");
  });
});

function createBackend(options: {
  scanResult?: { manifest: VaultManifest; issues: BuildResult["issues"] };
  buildResult?: BuildResult;
  previewSession?: PreviewSession;
  deployResult?: DeployResult;
} = {}): PluginExecutionBackend & { dispose: ReturnType<typeof vi.fn> } {
  return {
    scan: vi.fn(async () => options.scanResult ?? { manifest: createManifest("/vault"), issues: [] }),
    build: vi.fn(async () => options.buildResult ?? createBuildResult()),
    preview: vi.fn(async () => options.previewSession ?? createPreviewSession()),
    publish: vi.fn(async () =>
      options.buildResult?.success === false
        ? {
            build: options.buildResult
          }
        : {
            build: options.buildResult ?? createBuildResult(),
            deploy: options.deployResult ?? createDeployResult()
          }
    ),
    dispose: vi.fn(async () => {})
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

function createManifest(vaultRoot: string): VaultManifest {
  return {
    generatedAt: new Date().toISOString(),
    vaultRoot,
    notes: [],
    assetFiles: [],
    unsupportedObjects: []
  };
}

function createBuildResult(overrides: Partial<BuildResult> = {}): BuildResult {
  return {
    success: true,
    outputDir: "/vault/.osp/dist",
    manifestPath: "/vault/.osp/build/manifest.json",
    issues: [],
    logs: [],
    durationMs: 1,
    ...overrides
  };
}

function createPreviewSession(): PreviewSession {
  return {
    url: "http://localhost:8080",
    workspaceRoot: "/vault/.osp/preview",
    startedAt: new Date().toISOString()
  };
}

function createDeployResult(): DeployResult {
  return {
    success: true,
    target: "none",
    destination: "/vault/.osp/dist",
    message: "Published."
  };
}
