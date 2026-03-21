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

export class PluginExecutionError extends Error {
  public readonly logPath?: string | undefined;

  public constructor(message: string, options: { logPath?: string | undefined; cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "PluginExecutionError";
    this.logPath = options.logPath;
  }
}

export function getPluginErrorLogPath(error: unknown): string | undefined {
  if (error instanceof PluginExecutionError) {
    return error.logPath;
  }

  if (error instanceof Error && "logPath" in error) {
    const logPath = (error as Error & { logPath?: unknown }).logPath;

    return typeof logPath === "string" && logPath !== "" ? logPath : undefined;
  }

  return undefined;
}
