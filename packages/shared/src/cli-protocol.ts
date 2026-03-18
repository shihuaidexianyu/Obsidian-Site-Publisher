import { z } from "zod";

import { BuildIssueSchema, BuildResultSchema, DeployResultSchema, PreviewSessionSchema, VaultManifestSchema } from "./schemas.js";

export const CliScanResultSchema = z.object({
  command: z.literal("scan"),
  success: z.literal(true),
  logPath: z.string(),
  manifest: VaultManifestSchema,
  issues: z.array(BuildIssueSchema)
});

export const CliBuildResultSchema = z.object({
  command: z.literal("build"),
  success: z.boolean(),
  logPath: z.string(),
  result: BuildResultSchema
});

export const CliPreviewResultSchema = z.object({
  command: z.literal("preview"),
  success: z.literal(true),
  logPath: z.string(),
  session: PreviewSessionSchema
});

export const CliDeployResultSchema = z.object({
  command: z.literal("deploy"),
  success: z.boolean(),
  logPath: z.string(),
  build: BuildResultSchema,
  deploy: DeployResultSchema.optional()
});

export type CliJsonResult =
  | z.output<typeof CliScanResultSchema>
  | z.output<typeof CliBuildResultSchema>
  | z.output<typeof CliPreviewResultSchema>
  | z.output<typeof CliDeployResultSchema>;
