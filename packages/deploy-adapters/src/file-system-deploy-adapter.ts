import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

import type { BuildResult, DeployResult, PublisherConfig } from "@osp/shared";

import type { DeployAdapter } from "./contracts.js";

export class FileSystemDeployAdapter implements DeployAdapter {
  public async deploy(build: BuildResult, config: PublisherConfig): Promise<DeployResult> {
    if (!build.success) {
      return {
        success: false,
        target: config.deployTarget,
        message: "Build must succeed before deploy can proceed."
      };
    }

    if (build.outputDir === undefined) {
      return {
        success: false,
        target: config.deployTarget,
        message: "Build output directory is missing, so local export cannot proceed."
      };
    }

    const destination = resolveDeployDestination(config);

    await rm(destination, { recursive: true, force: true });
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(build.outputDir, destination, { recursive: true });

    return {
      success: true,
      target: config.deployTarget,
      destination,
      message: "Local export completed successfully."
    };
  }
}

function resolveDeployDestination(config: PublisherConfig): string {
  if (config.deployOutputDir !== undefined) {
    return config.deployOutputDir;
  }

  return path.join(config.vaultRoot, ".osp", "export");
}
