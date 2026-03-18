import type { BuildIssue, BuildResult, DeployResult, PreviewSession, PublisherConfig, VaultManifest } from "@osp/shared";

export type PluginScanResult = {
  manifest: VaultManifest;
  issues: BuildIssue[];
};

export type PluginPublishResult = {
  build: BuildResult;
  deploy?: DeployResult;
};

export type PluginExecutionBackend = {
  scan(config: PublisherConfig): Promise<PluginScanResult>;
  build(config: PublisherConfig): Promise<BuildResult>;
  preview(config: PublisherConfig): Promise<PreviewSession>;
  publish(config: PublisherConfig): Promise<PluginPublishResult>;
  dispose(): Promise<void>;
};
