import type { BuildResult, DeployResult, PublisherConfig } from "@osp/shared";

import type { DeployAdapter } from "./contracts.js";

export class NoopDeployAdapter implements DeployAdapter {
  public async deploy(build: BuildResult, config: PublisherConfig): Promise<DeployResult> {
    if (!build.success) {
      return {
        success: false,
        target: config.deployTarget,
        message: "Build must succeed before deploy can proceed."
      };
    }

    const result: DeployResult = {
      success: true,
      target: config.deployTarget,
      message: "Noop deploy adapter accepted the build output."
    };

    if (build.outputDir !== undefined) {
      result.destination = build.outputDir;
    }

    return result;
  }
}
