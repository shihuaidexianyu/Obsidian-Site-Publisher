import type { ScanInput, ScanResult, VaultParser } from "./contracts";
export declare class FileSystemVaultParser implements VaultParser {
    scanVault(input: ScanInput): Promise<ScanResult>;
}
