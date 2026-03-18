import path from "node:path";

import type { BuildLogEntry } from "@osp/shared";

export function createErrorLog(error: unknown): BuildLogEntry {
  return {
    level: "error",
    message: error instanceof Error ? error.message : "Quartz build failed with an unknown error.",
    timestamp: new Date().toISOString()
  };
}

export function createQuartzRuntimeResolutionMessage(error: unknown): string {
  const details = error instanceof Error ? error.message : "Unknown module resolution failure.";

  return [
    "Quartz runtime could not be resolved.",
    "The current environment does not provide @jackyzha0/quartz as a loadable package.",
    "If you are running the packaged Obsidian plugin, the install bundle is not self-contained for build/preview/publish yet.",
    `Details: ${details}`
  ].join(" ");
}

export async function stopPreviewProcess(
  previewProcesses: Map<string, { stop(): Promise<void> }>,
  workspaceRoot: string
): Promise<void> {
  const record = previewProcesses.get(workspaceRoot);

  if (record === undefined) {
    return;
  }

  await record.stop();
  previewProcesses.delete(workspaceRoot);
}

export function toPosixRelativePath(rootDir: string, targetPath: string): string {
  const relativePath = path.relative(rootDir, targetPath).replace(/\\/g, "/");

  return relativePath === "" ? "." : relativePath;
}
