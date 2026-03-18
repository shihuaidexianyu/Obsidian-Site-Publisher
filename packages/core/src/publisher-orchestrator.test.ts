import type { BuilderAdapter } from "@osp/builder-adapter-quartz";
import type { DeployAdapter } from "@osp/deploy-adapters";
import type { DiagnosticsEngine } from "@osp/diagnostics";
import type { ScanResult, VaultParser } from "@osp/parser";
import type { StagingService } from "@osp/staging";
import type { BuildIssue, BuildResult, DeployResult, NoteRecord, PreparedWorkspace, PreviewSession, PublisherConfig, VaultManifest } from "@osp/shared";
import { describe, expect, it, vi } from "vitest";

import { PublisherOrchestrator } from "./publisher-orchestrator";

describe("PublisherOrchestrator", () => {
  it("blocks build on error issues before calling the builder", async () => {
    const builder = createBuilder();
    const orchestrator = createOrchestrator({
      builder,
      diagnosticsIssues: [createIssue("error", "BROKEN_LINK")]
    });

    const result = await orchestrator.build(createConfig(false));

    expect(result.success).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(builder.build).not.toHaveBeenCalled();
  });

  it("blocks build on warning issues when strict mode is enabled", async () => {
    const builder = createBuilder();
    const orchestrator = createOrchestrator({
      builder,
      diagnosticsIssues: [createIssue("warning", "UNPUBLISHED_REFERENCE")]
    });

    const result = await orchestrator.build(createConfig(true));

    expect(result.success).toBe(false);
    expect(result.logs[0]?.message).toContain("strict mode");
    expect(builder.build).not.toHaveBeenCalled();
  });

  it("allows build on warning issues when strict mode is disabled", async () => {
    const builder = createBuilder();
    const orchestrator = createOrchestrator({
      builder,
      diagnosticsIssues: [createIssue("warning", "UNPUBLISHED_REFERENCE")]
    });

    const result = await orchestrator.build(createConfig(false));

    expect(result.success).toBe(true);
    expect(builder.build).toHaveBeenCalledOnce();
  });
});

function createOrchestrator(options: {
  builder?: BuilderAdapter & { build: ReturnType<typeof vi.fn>; preview: ReturnType<typeof vi.fn> };
  diagnosticsIssues?: BuildIssue[];
}): PublisherOrchestrator {
  const parser: VaultParser = {
    scanVault: vi.fn(async (): Promise<ScanResult> => ({
      manifest: createManifest()
    }))
  };
  const diagnostics: DiagnosticsEngine = {
    analyze: vi.fn(() => options.diagnosticsIssues ?? [])
  };
  const staging: StagingService = {
    prepare: vi.fn(async (): Promise<PreparedWorkspace> => ({
      mode: "build",
      rootDir: "/workspace",
      contentDir: "/workspace/content",
      outputDir: "/workspace/dist",
      manifestPath: "/workspace/manifest.json"
    }))
  };
  const deploy: DeployAdapter = {
    deploy: vi.fn(async (): Promise<DeployResult> => ({
      success: true,
      target: "none",
      message: "ok"
    }))
  };

  return new PublisherOrchestrator({
    parser,
    diagnostics,
    staging,
    builder: options.builder ?? createBuilder(),
    deploy
  });
}

function createBuilder(): BuilderAdapter & { build: ReturnType<typeof vi.fn>; preview: ReturnType<typeof vi.fn> } {
  return {
    build: vi.fn(async (): Promise<BuildResult> => ({
      success: true,
      outputDir: "/workspace/dist",
      manifestPath: "/workspace/manifest.json",
      issues: [],
      logs: [],
      durationMs: 1
    })),
    preview: vi.fn(async (): Promise<PreviewSession> => ({
      url: "http://localhost:8080",
      workspaceRoot: "/workspace",
      startedAt: new Date().toISOString()
    }))
  };
}

function createConfig(strictMode: boolean): PublisherConfig {
  return {
    vaultRoot: "/vault",
    publishMode: "frontmatter",
    includeGlobs: [],
    excludeGlobs: [],
    outputDir: "/vault/.osp/dist",
    builder: "quartz",
    deployTarget: "none",
    enableSearch: true,
    enableBacklinks: true,
    enableGraph: true,
    strictMode
  };
}

function createManifest(): VaultManifest {
  return {
    generatedAt: new Date().toISOString(),
    vaultRoot: "/vault",
    notes: [createNote("Home.md")],
    assetFiles: [],
    unsupportedObjects: []
  };
}

function createNote(path: string): NoteRecord {
  return {
    id: path,
    path,
    title: "Home",
    slug: "home",
    aliases: [],
    headings: [],
    blockIds: [],
    properties: {},
    links: [],
    embeds: [],
    assets: [],
    publish: true
  };
}

function createIssue(severity: BuildIssue["severity"], code: BuildIssue["code"]): BuildIssue {
  return {
    code,
    severity,
    file: "Home.md",
    message: `${code} issue`
  };
}
