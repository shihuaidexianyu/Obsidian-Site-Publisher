import type { BuildResult, DeployResult, PublisherConfig } from "@osp/shared";

import type { DeployAdapter } from "./contracts.js";
import { GitBranchDeployAdapter } from "./git-branch-deploy-adapter.js";

export class GitHubPagesDeployAdapter implements DeployAdapter {
  private readonly gitBranchAdapter = new GitBranchDeployAdapter();

  public async deploy(build: BuildResult, config: PublisherConfig): Promise<DeployResult> {
    const deployBranch = config.deployBranch ?? inferGitHubPagesBranch(config.deployRepositoryUrl);
    const result = await this.gitBranchAdapter.deploy(build, {
      ...config,
      deployTarget: "git-branch",
      deployBranch
    });

    return {
      ...result,
      target: "github-pages"
    };
  }
}

function inferGitHubPagesBranch(repositoryUrl: string | undefined): string {
  if (repositoryUrl !== undefined && repositoryUrl.includes(".github.io")) {
    return "main";
  }

  return "gh-pages";
}
