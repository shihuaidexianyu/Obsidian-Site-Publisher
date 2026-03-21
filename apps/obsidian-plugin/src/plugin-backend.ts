import type { BuildIssue, BuildResult, DeployResult, PreviewSession, PublisherConfig, VaultManifest } from "@osp/shared";

export type PluginScanResult = {
  manifest: VaultManifest;
  issues: BuildIssue[];
  logPath?: string | undefined;
};

export type PluginBuildResult = {
  result: BuildResult;
  logPath?: string | undefined;
};

export type PluginPreviewResult = {
  session: PreviewSession;
  logPath?: string | undefined;
};

export type PluginPublishResult = {
  build: BuildResult;
  deploy?: DeployResult;
  logPath?: string | undefined;
};

export type PluginDeployFromBuildResult = {
  deploy: DeployResult;
  logPath?: string | undefined;
};

export type PluginExecutionBackend = {
  scan(config: PublisherConfig): Promise<PluginScanResult>;
  build(config: PublisherConfig): Promise<PluginBuildResult>;
  preview(config: PublisherConfig): Promise<PluginPreviewResult>;
  previewBuilt(build: BuildResult, config: PublisherConfig): Promise<PluginPreviewResult>;
  publish(config: PublisherConfig): Promise<PluginPublishResult>;
  deployBuilt(build: BuildResult, config: PublisherConfig): Promise<PluginDeployFromBuildResult>;
  dispose(): Promise<void>;
};
