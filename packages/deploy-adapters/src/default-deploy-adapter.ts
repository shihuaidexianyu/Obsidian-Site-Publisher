import type { BuildResult, DeployResult, PublisherConfig } from "@osp/shared";

import type { DeployAdapter } from "./contracts.js";
import { FileSystemDeployAdapter } from "./file-system-deploy-adapter.js";
import { GitBranchDeployAdapter } from "./git-branch-deploy-adapter.js";
import { NoopDeployAdapter } from "./noop-deploy-adapter.js";

export class DefaultDeployAdapter implements DeployAdapter {
  private readonly noopAdapter = new NoopDeployAdapter();
  private readonly fileSystemAdapter = new FileSystemDeployAdapter();
  private readonly gitBranchAdapter = new GitBranchDeployAdapter();

  public async deploy(build: BuildResult, config: PublisherConfig): Promise<DeployResult> {
    if (config.deployTarget === "none") {
      return this.noopAdapter.deploy(build, config);
    }

    if (config.deployTarget === "local-export") {
      return this.fileSystemAdapter.deploy(build, config);
    }

    if (config.deployTarget === "git-branch") {
      return this.gitBranchAdapter.deploy(build, config);
    }

    return {
      success: false,
      target: config.deployTarget,
      message: `Deploy target ${config.deployTarget} is not implemented yet.`
    };
  }
}
