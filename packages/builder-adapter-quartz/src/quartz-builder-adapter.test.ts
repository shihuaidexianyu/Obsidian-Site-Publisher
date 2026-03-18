import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { PreparedWorkspace, PublisherConfig } from "@osp/shared";
import { afterEach, describe, expect, it } from "vitest";

import { QuartzBuilderAdapter } from "./quartz-builder-adapter";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directoryPath) => {
      await rm(directoryPath, { force: true, recursive: true });
    })
  );
});

describe("QuartzBuilderAdapter", () => {
  it(
    "builds a real Quartz site from a prepared workspace",
    async () => {
      const workspace = await createPreparedWorkspace("osp-quartz-build-");
      const adapter = new QuartzBuilderAdapter();

      const result = await adapter.build(workspace, createConfig(workspace.rootDir));

      expect(result.success).toBe(true);
      expect(result.outputDir).toBe(workspace.outputDir);
      await expect(access(path.join(workspace.outputDir, "index.html"))).resolves.toBeUndefined();

      const indexHtml = await readFile(path.join(workspace.outputDir, "index.html"), "utf8");

      expect(indexHtml).toContain("Hello Quartz");
    },
    60_000
  );

  it(
    "starts a real Quartz preview server",
    async () => {
      const workspace = await createPreparedWorkspace("osp-quartz-preview-");
      const adapter = new QuartzBuilderAdapter({
        previewPort: 43180,
        previewReadinessTimeoutMs: 60_000,
        previewWsPort: 43181
      });

      try {
        const session = await adapter.preview(workspace, createConfig(workspace.rootDir));

        expect(session.url).toBe("http://localhost:43180");

        const response = await fetch(session.url);
        const html = await response.text();

        expect(response.ok).toBe(true);
        expect(html).toContain("Hello Quartz");
      } finally {
        await adapter.stopPreview(workspace.rootDir);
      }
    },
    90_000
  );
});

function createConfig(vaultRoot: string): PublisherConfig {
  return {
    vaultRoot,
    publishMode: "frontmatter",
    includeGlobs: [],
    excludeGlobs: [],
    outputDir: path.join(vaultRoot, ".osp", "dist"),
    builder: "quartz",
    deployTarget: "none",
    enableSearch: true,
    enableBacklinks: true,
    enableGraph: true,
    strictMode: false
  };
}

async function createPreparedWorkspace(prefix: string): Promise<PreparedWorkspace> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), prefix));

  temporaryDirectories.push(rootDir);

  const contentDir = path.join(rootDir, "content");
  const outputDir = path.join(rootDir, "dist");
  const manifestPath = path.join(rootDir, "manifest.json");

  await mkdir(contentDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    path.join(contentDir, "index.md"),
    "---\ntitle: Home\n---\n\n# Hello Quartz\n\nThis page was built by the adapter test.\n",
    "utf8"
  );
  await writeFile(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString() }), "utf8");

  return {
    mode: "build",
    rootDir,
    contentDir,
    outputDir,
    manifestPath
  };
}
