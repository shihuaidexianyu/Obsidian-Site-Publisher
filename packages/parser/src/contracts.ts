import type { PublisherConfig, VaultManifest } from "@osp/shared";

export type ScanInput = {
  vaultRoot: string;
  config: PublisherConfig;
};

export type ScanResult = {
  manifest: VaultManifest;
};

export interface VaultParser {
  scanVault(input: ScanInput): Promise<ScanResult>;
}
