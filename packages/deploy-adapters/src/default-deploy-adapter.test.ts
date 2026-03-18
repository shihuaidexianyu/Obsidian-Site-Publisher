import type { BuildResult, PublisherConfig } from "@osp/shared";
import { describe, expect, it } from "vitest";

import { DefaultDeployAdapter } from "./default-deploy-adapter.js";

describe("DefaultDeployAdapter", () => {
  it("returns a structured failure for unimplemented deploy targets", async () => {
    const adapter = new DefaultDeployAdapter();
    const result = await adapter.deploy(createBuildResult(), createConfig("github-pages"));

    expect(result).toEqual({
      success: false,
      target: "github-pages",
      message: "Deploy target github-pages is not implemented yet."
    });
  });
});

function createBuildResult(): BuildResult {
  return {
    success: true,
    outputDir: "/workspace/dist",
    manifestPath: "/workspace/manifest.json",
    issues: [],
    logs: [],
    durationMs: 1
  };
}

function createConfig(deployTarget: PublisherConfig["deployTarget"]): PublisherConfig {
  return {
    vaultRoot: "/workspace",
    publishMode: "frontmatter",
    includeGlobs: [],
    excludeGlobs: [],
    outputDir: "/workspace/.osp/dist",
    builder: "quartz",
    deployTarget,
    enableSearch: true,
    enableBacklinks: true,
    enableGraph: true,
    strictMode: false
  };
}
