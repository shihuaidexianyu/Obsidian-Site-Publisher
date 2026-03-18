import path from "node:path";

import { createDefaultPublisherRuntime } from "@osp/core";
import type { PublisherOrchestrator } from "@osp/core";
import type { BuildIssue, BuildResult, DeployResult, PreviewSession, PublisherConfig, VaultManifest } from "@osp/shared";

import { parseCliArguments, resolveCliConfig, supportedCommands } from "./config.js";

type CliOutput = {
  log(message: string): void;
  error(message: string): void;
};

type CliOrchestrator = Pick<PublisherOrchestrator, "scan" | "build" | "preview" | "deployFromBuild">;

type CliSession = {
  orchestrator: CliOrchestrator;
  stop(): Promise<void>;
};

export type CliRuntime = {
  cwd?: string;
  output?: CliOutput;
  createRuntime?: (options: { quartzPackageRoot?: string; preferStaticPreview: boolean }) => CliSession;
  waitForPreviewShutdown?: () => Promise<void>;
};

type CliJsonResult =
  | {
      command: "scan";
      success: true;
      manifest: VaultManifest;
      issues: BuildIssue[];
    }
  | {
      command: "build";
      success: boolean;
      result: BuildResult;
    }
  | {
      command: "preview";
      success: true;
      session: PreviewSession;
    }
  | {
      command: "deploy";
      success: boolean;
      build: BuildResult;
      deploy?: DeployResult;
    };

export async function runCli(argv: string[], runtime: CliRuntime = {}): Promise<number> {
  const output = runtime.output ?? console;
  const cwd = runtime.cwd ?? process.cwd();
  const parsedArguments = parseCliArguments(argv);

  if (parsedArguments.kind === "help") {
    output.log(createHelpText());
    return 0;
  }

  if (parsedArguments.kind === "error") {
    output.error(parsedArguments.message);
    output.log(createHelpText());
    return 1;
  }

  let cliRuntime: CliSession | undefined;

  try {
    const resolvedConfig = await resolveCliConfig(parsedArguments.options, cwd);
    const builderOptions = {
      ...(parsedArguments.options.quartzPackageRoot === undefined
        ? {}
        : { quartzPackageRoot: path.resolve(cwd, parsedArguments.options.quartzPackageRoot) }),
      ...(parsedArguments.options.preferStaticPreview ? { preferStaticPreview: true } : {})
    };

    cliRuntime =
      runtime.createRuntime?.({
        ...(builderOptions.quartzPackageRoot === undefined ? {} : { quartzPackageRoot: builderOptions.quartzPackageRoot }),
        preferStaticPreview: parsedArguments.options.preferStaticPreview
      }) ??
      createDefaultPublisherRuntime({
        builder: builderOptions
      });

    if (!parsedArguments.options.json) {
      output.log(createConfigSourceMessage(resolvedConfig.configPath, resolvedConfig.config.vaultRoot));
    }

    switch (parsedArguments.command) {
      case "scan":
        return await runScanCommand(cliRuntime.orchestrator, resolvedConfig.config, output, parsedArguments.options.json);
      case "build":
        return await runBuildCommand(cliRuntime.orchestrator, resolvedConfig.config, output, parsedArguments.options.json);
      case "preview":
        return await runPreviewCommand(
          cliRuntime,
          resolvedConfig.config,
          output,
          runtime.waitForPreviewShutdown,
          parsedArguments.options.json
        );
      case "deploy":
        return await runDeployCommand(cliRuntime.orchestrator, resolvedConfig.config, output, parsedArguments.options.json);
    }

    return 1;
  } catch (error) {
    output.error(formatError(error));
    return 1;
  } finally {
    await cliRuntime?.stop();
  }
}

async function runScanCommand(
  orchestrator: CliOrchestrator,
  config: PublisherConfig,
  output: CliOutput,
  json: boolean
): Promise<number> {
  const report = await orchestrator.scan(config);

  if (json) {
    printJson(output, {
      command: "scan",
      success: true,
      manifest: report.manifest,
      issues: report.issues
    });
    return 0;
  }

  output.log(
    [
      "Scan complete.",
      `Notes: ${report.manifest.notes.length}`,
      `Assets: ${report.manifest.assetFiles.length}`,
      `Unsupported: ${report.manifest.unsupportedObjects.length}`,
      `Issues: ${report.issues.length}`
    ].join(" ")
  );
  printIssues(output, report.issues);
  return 0;
}

async function runBuildCommand(
  orchestrator: CliOrchestrator,
  config: PublisherConfig,
  output: CliOutput,
  json: boolean
): Promise<number> {
  const result = await orchestrator.build(config);

  if (json) {
    printJson(output, {
      command: "build",
      success: result.success,
      result
    });
    return result.success ? 0 : 1;
  }

  printBuildResult(output, result);
  return result.success ? 0 : 1;
}

async function runPreviewCommand(
  runtime: CliSession,
  config: PublisherConfig,
  output: CliOutput,
  waitForPreviewShutdown: (() => Promise<void>) | undefined,
  json: boolean
): Promise<number> {
  const session = await runtime.orchestrator.preview(config);

  if (json) {
    printJson(output, {
      command: "preview",
      success: true,
      session
    });
  } else {
    printPreviewSession(output, session);
  }

  await (waitForPreviewShutdown ?? waitForTerminationSignal)();
  return 0;
}

async function runDeployCommand(
  orchestrator: CliOrchestrator,
  config: PublisherConfig,
  output: CliOutput,
  json: boolean
): Promise<number> {
  const build = await orchestrator.build(config);

  if (!build.success) {
    if (json) {
      printJson(output, {
        command: "deploy",
        success: false,
        build
      });
    } else {
      printBuildResult(output, build);
    }

    return 1;
  }

  const deploy = await orchestrator.deployFromBuild(build, config);

  if (json) {
    printJson(output, {
      command: "deploy",
      success: deploy.success,
      build,
      deploy
    });
    return deploy.success ? 0 : 1;
  }

  printBuildResult(output, build);
  printDeployResult(output, deploy);
  return deploy.success ? 0 : 1;
}

function printBuildResult(output: CliOutput, result: BuildResult): void {
  output.log(
    [
      result.success ? "Build succeeded." : "Build failed.",
      `Issues: ${result.issues.length}`,
      `Logs: ${result.logs.length}`,
      `Duration: ${result.durationMs}ms`,
      ...(result.outputDir === undefined ? [] : [`Output: ${result.outputDir}`])
    ].join(" ")
  );

  printIssues(output, result.issues);

  const lastLog = result.logs.at(-1);

  if (lastLog !== undefined) {
    output.log(`Last log: [${lastLog.level}] ${lastLog.message}`);
  }
}

function printPreviewSession(output: CliOutput, session: PreviewSession): void {
  output.log(`Preview ready at ${session.url}`);
  output.log(`Workspace: ${session.workspaceRoot}`);
  output.log("Press Ctrl+C to stop preview.");
}

function printDeployResult(output: CliOutput, result: DeployResult): void {
  output.log(
    [
      result.success ? "Deploy succeeded." : "Deploy failed.",
      `Target: ${result.target}`,
      result.message,
      ...(result.destination === undefined ? [] : [`Destination: ${result.destination}`])
    ].join(" ")
  );
}

function printIssues(output: CliOutput, issues: BuildIssue[]): void {
  if (issues.length === 0) {
    output.log("No issues found.");
    return;
  }

  output.log(`Issue summary: ${createIssueSummary(issues)}`);

  for (const issue of issues) {
    output.log(`- ${formatIssue(issue)}`);
  }
}

function createIssueSummary(issues: BuildIssue[]): string {
  const counts = new Map<string, number>();

  for (const issue of issues) {
    counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([leftCode], [rightCode]) => leftCode.localeCompare(rightCode))
    .map(([code, count]) => `${code}=${count}`)
    .join(", ");
}

function formatIssue(issue: BuildIssue): string {
  const location =
    issue.location === undefined ? issue.file : `${issue.file}:${issue.location.line}:${issue.location.column}`;

  return `[${issue.severity}] ${issue.code} ${location} ${issue.message}`;
}

function createConfigSourceMessage(configPath: string | undefined, vaultRoot: string): string {
  if (configPath === undefined) {
    return `Using default CLI config for vault ${vaultRoot}`;
  }

  return `Using config ${configPath} for vault ${vaultRoot}`;
}

function createHelpText(): string {
  return [
    `publisher-cli <${supportedCommands.join("|")}> [--config <path>] [--vault-root <path>] [--json]`,
    "",
    "Examples:",
    "  publisher-cli scan --vault-root ./test_vault/hw",
    "  publisher-cli build --config ./osp.config.json",
    "  publisher-cli preview --vault-root ./my-vault --static-preview",
    "  publisher-cli deploy --config ./publisher.config.json"
  ].join("\n");
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "CLI command failed with an unknown error.";
}

function waitForTerminationSignal(): Promise<void> {
  return new Promise((resolve) => {
    const onSignal = (): void => {
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      resolve();
    };

    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
  });
}

function printJson(output: CliOutput, payload: CliJsonResult): void {
  output.log(JSON.stringify(payload));
}
