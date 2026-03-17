import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { PreparedWorkspace } from "@osp/shared";

import type { PrepareStagingInput, StagingService } from "./contracts";

export class FileSystemStagingService implements StagingService {
  public async prepare(input: PrepareStagingInput): Promise<PreparedWorkspace> {
    const rootDir = input.stagingRoot ?? path.join(input.config.vaultRoot, ".osp", input.mode);
    const contentDir = path.join(rootDir, "content");
    const outputDir = path.join(rootDir, "dist");
    const manifestPath = path.join(rootDir, "manifest.json");

    await mkdir(contentDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });
    await writeFile(manifestPath, JSON.stringify(input.manifest, null, 2), "utf8");

    return {
      mode: input.mode,
      rootDir,
      contentDir,
      outputDir,
      manifestPath
    };
  }
}
