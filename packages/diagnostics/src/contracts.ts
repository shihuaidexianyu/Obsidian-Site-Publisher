import type { BuildIssue, PublisherConfig, VaultManifest } from "@osp/shared";

export interface DiagnosticsEngine {
  analyze(manifest: VaultManifest, config: PublisherConfig): BuildIssue[];
}
