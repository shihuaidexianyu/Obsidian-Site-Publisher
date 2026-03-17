import type { BuildResult, PreviewSession, PreparedWorkspace, PublisherConfig } from "@osp/shared";

export interface BuilderAdapter {
  build(workspace: PreparedWorkspace, config: PublisherConfig): Promise<BuildResult>;
  preview?(workspace: PreparedWorkspace, config: PublisherConfig): Promise<PreviewSession>;
}
