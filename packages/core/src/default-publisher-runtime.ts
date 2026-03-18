import { QuartzBuilderAdapter } from "@osp/builder-adapter-quartz";
import { NoopDeployAdapter } from "@osp/deploy-adapters";
import { DefaultDiagnosticsEngine } from "@osp/diagnostics";
import { FileSystemVaultParser } from "@osp/parser";
import { FileSystemStagingService } from "@osp/staging";

import { PublisherOrchestrator } from "./publisher-orchestrator.js";

export type DefaultPublisherRuntime = {
  orchestrator: PublisherOrchestrator;
  stop(): Promise<void>;
};

export function createDefaultPublisherRuntime(): DefaultPublisherRuntime {
  const builder = new QuartzBuilderAdapter();
  const orchestrator = new PublisherOrchestrator({
    parser: new FileSystemVaultParser(),
    diagnostics: new DefaultDiagnosticsEngine(),
    staging: new FileSystemStagingService(),
    builder,
    deploy: new NoopDeployAdapter()
  });

  return {
    orchestrator,
    stop: async () => builder.stopPreview()
  };
}
