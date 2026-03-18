import type { BuildResult, DeployResult, PreviewSession, PublisherConfig, VaultManifest } from "@osp/shared";
import { describe, expect, it, vi } from "vitest";

import { PublisherPluginShell } from "./main";

describe("PublisherPluginShell", () => {
  it("exposes the four plugin commands with stable ids", () => {
    const plugin = new PublisherPluginShell(() => createRuntime());

    expect(plugin.getCommandDefinitions()).toEqual([
      { id: "osp:preview", name: "Preview Site", command: "preview" },
      { id: "osp:build", name: "Build Site", command: "build" },
      { id: "osp:publish", name: "Publish Site", command: "publish" },
      { id: "osp:issues", name: "Show Publish Issues", command: "issues" }
    ]);
  });

  it("creates a safe default config for Obsidian vaults", () => {
    const plugin = new PublisherPluginShell(() => createRuntime());

    expect(plugin.createInitialConfig("/vault")).toMatchObject({
      vaultRoot: "/vault",
      outputDir: "/vault/.osp/dist",
      excludeGlobs: ["**/.git/**", "**/.obsidian/**", "**/.osp/**", "**/.trash/**", "**/node_modules/**"]
    });
  });

  it("runs the issues command through core scan and stores the latest issues", async () => {
    const runtime = createRuntime({
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
    const plugin = new PublisherPluginShell(() => runtime);

    const result = await plugin.runCommand("issues", createConfig("/vault"));

    expect(result.command).toBe("issues");
    expect(runtime.orchestrator.scan).toHaveBeenCalledOnce();
    expect(plugin.getState()).toMatchObject({
      lastCommand: "issues",
      lastIssues: [
        {
          code: "BROKEN_LINK"
        }
      ],
      statusMessage: "Found 1 publish issue(s)."
    });
  });

  it("runs build through core and stores logs for later UI rendering", async () => {
    const runtime = createRuntime({
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
    const plugin = new PublisherPluginShell(() => runtime);

    const result = await plugin.runCommand("build", createConfig("/vault"));

    expect(result.command).toBe("build");
    expect(runtime.orchestrator.build).toHaveBeenCalledOnce();
    expect(plugin.getState()).toMatchObject({
      lastCommand: "build",
      lastLogs: [
        {
          message: "Quartz build finished."
        }
      ],
      statusMessage: "Build completed successfully."
    });
  });

  it("runs preview through core and stores the last preview session", async () => {
    const runtime = createRuntime();
    const plugin = new PublisherPluginShell(() => runtime);

    const result = await plugin.runCommand("preview", createConfig("/vault"));

    expect(result.command).toBe("preview");
    expect(runtime.orchestrator.preview).toHaveBeenCalledOnce();
    expect(plugin.getState()).toMatchObject({
      lastCommand: "preview",
      lastPreviewSession: {
        url: "http://localhost:8080"
      }
    });
  });

  it("runs publish as build plus deploy and stores the deploy result", async () => {
    const runtime = createRuntime();
    const plugin = new PublisherPluginShell(() => runtime);

    const result = await plugin.runCommand("publish", createConfig("/vault"));

    expect(result.command).toBe("publish");
    expect(runtime.orchestrator.build).toHaveBeenCalledOnce();
    expect(runtime.orchestrator.deployFromBuild).toHaveBeenCalledOnce();
    expect(plugin.getState()).toMatchObject({
      lastCommand: "publish",
      lastDeployResult: {
        success: true
      },
      statusMessage: "Publish completed successfully."
    });
  });

  it("does not deploy when publish build fails", async () => {
    const runtime = createRuntime({
      buildResult: createBuildResult({
        success: false
      })
    });
    const plugin = new PublisherPluginShell(() => runtime);

    const result = await plugin.runCommand("publish", createConfig("/vault"));

    expect(result.command).toBe("publish");
    expect(runtime.orchestrator.deployFromBuild).not.toHaveBeenCalled();
    expect(plugin.getState().statusMessage).toBe("Publish stopped because build did not succeed.");
  });
});

function createRuntime(options: {
  scanResult?: { manifest: VaultManifest; issues: BuildResult["issues"] };
  buildResult?: BuildResult;
  previewSession?: PreviewSession;
  deployResult?: DeployResult;
} = {}) {
  return {
    orchestrator: {
      scan: vi.fn(async () => options.scanResult ?? { manifest: createManifest("/vault"), issues: [] }),
      build: vi.fn(async () => options.buildResult ?? createBuildResult()),
      preview: vi.fn(async () => options.previewSession ?? createPreviewSession()),
      deployFromBuild: vi.fn(async () => options.deployResult ?? createDeployResult())
    },
    stop: vi.fn(async () => {})
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
