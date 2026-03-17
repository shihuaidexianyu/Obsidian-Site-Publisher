import type { PublisherConfig, VaultManifest } from "@osp/shared";

import type { ScanInput, ScanResult, VaultParser } from "./contracts";

export class FileSystemVaultParser implements VaultParser {
  public async scanVault(input: ScanInput): Promise<ScanResult> {
    return {
      manifest: createEmptyManifest(input.config)
    };
  }
}

function createEmptyManifest(config: PublisherConfig): VaultManifest {
  return {
    generatedAt: new Date().toISOString(),
    vaultRoot: config.vaultRoot,
    notes: [],
    unsupportedObjects: []
  };
}
