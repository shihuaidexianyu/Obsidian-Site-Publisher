import type { BuildResult, PreviewSession, PreparedWorkspace, PublisherConfig } from "@osp/shared";

import type { BuilderAdapter } from "./contracts";

export class QuartzBuilderAdapter implements BuilderAdapter {
  public async build(workspace: PreparedWorkspace, _config: PublisherConfig): Promise<BuildResult> {
    return {
      success: false,
      manifestPath: workspace.manifestPath,
      issues: [],
      logs: [
        {
          level: "warning",
          message: "QuartzBuilderAdapter is scaffolded but not wired to a real Quartz installation yet.",
          timestamp: new Date().toISOString()
        }
      ],
      durationMs: 0
    };
  }

  public async preview(workspace: PreparedWorkspace, _config: PublisherConfig): Promise<PreviewSession> {
    return {
      url: "http://localhost:8080",
      workspaceRoot: workspace.rootDir,
      startedAt: new Date().toISOString()
    };
  }
}
