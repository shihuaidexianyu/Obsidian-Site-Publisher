import type { BuilderAdapter } from "@osp/builder-adapter-quartz";
import type { DeployAdapter } from "@osp/deploy-adapters";
import type { DiagnosticsEngine } from "@osp/diagnostics";
import type { ScanResult, VaultParser } from "@osp/parser";
import type { StagingService } from "@osp/staging";
import type { BuildIssue, BuildResult, DeployResult, PreviewSession, PublisherConfig, VaultManifest } from "@osp/shared";

export type ScanReport = {
  manifest: VaultManifest;
  issues: BuildIssue[];
};

export type PublisherDependencies = {
  parser: VaultParser;
  diagnostics: DiagnosticsEngine;
  staging: StagingService;
  builder: BuilderAdapter;
  deploy: DeployAdapter;
};

export class PublisherOrchestrator {
  public constructor(private readonly dependencies: PublisherDependencies) {}

  public async scan(config: PublisherConfig): Promise<ScanReport> {
    const scanResult = await this.dependencies.parser.scanVault({
      vaultRoot: config.vaultRoot,
      config
    });

    return this.createScanReport(scanResult, config);
  }

  public async build(config: PublisherConfig): Promise<BuildResult> {
    const { manifest, issues } = await this.scan(config);
    const workspace = await this.dependencies.staging.prepare({
      config,
      manifest,
      mode: "build"
    });
    const result = await this.dependencies.builder.build(workspace, config);

    return {
      ...result,
      issues: [...issues, ...result.issues]
    };
  }

  public async preview(config: PublisherConfig): Promise<PreviewSession> {
    const { manifest } = await this.scan(config);
    const workspace = await this.dependencies.staging.prepare({
      config,
      manifest,
      mode: "preview"
    });

    if (this.dependencies.builder.preview === undefined) {
      throw new Error("Active builder adapter does not support preview.");
    }

    return this.dependencies.builder.preview(workspace, config);
  }

  public async deployFromBuild(build: BuildResult, config: PublisherConfig): Promise<DeployResult> {
    return this.dependencies.deploy.deploy(build, config);
  }

  private createScanReport(scanResult: ScanResult, config: PublisherConfig): ScanReport {
    return {
      manifest: scanResult.manifest,
      issues: this.dependencies.diagnostics.analyze(scanResult.manifest, config)
    };
  }
}
