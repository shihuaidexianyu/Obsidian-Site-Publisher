import type { PreparedWorkspace, PublisherConfig, VaultManifest } from "@osp/shared";

export type PrepareStagingInput = {
  config: PublisherConfig;
  manifest: VaultManifest;
  mode: "build" | "preview";
  stagingRoot?: string;
};

export interface StagingService {
  prepare(input: PrepareStagingInput): Promise<PreparedWorkspace>;
}
