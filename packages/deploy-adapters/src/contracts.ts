import type { BuildResult, DeployResult, PublisherConfig } from "@osp/shared";

export interface DeployAdapter {
  deploy(build: BuildResult, config: PublisherConfig): Promise<DeployResult>;
}
