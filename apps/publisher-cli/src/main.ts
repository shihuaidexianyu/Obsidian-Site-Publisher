import path from "node:path";

import { createDefaultPublisherRuntime } from "@osp/core";
import type { PublisherOrchestrator } from "@osp/core";
import type { BuildIssue, BuildLogEntry, BuildResult, CliJsonResult, DeployResult, PreviewSession, PublisherConfig } from "@osp/shared";

import { createCliLogger, type CliLogger } from "./cli-logging.js";
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
  createRuntime?: (options: { quartzPackageRoot?: string; preferStaticPreview: boolean; previewPort?: number }) => CliSession;
  waitForPreviewShutdown?: () => Promise<void>;
};

type CliReporter = {
  json: boolean;
  logger: CliLogger;
  output: CliOutput;
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
  let reporter: CliReporter | undefined;

  try {
    const resolvedConfig = await resolveCliConfig(parsedArguments.options, cwd);
    const builderOptions = {
      ...(parsedArguments.options.quartzPackageRoot === undefined
        ? {}
        : { quartzPackageRoot: path.resolve(cwd, parsedArguments.options.quartzPackageRoot) }),
      ...(parsedArguments.options.previewPort === undefined ? {} : { previewPort: parsedArguments.options.previewPort }),
      ...(parsedArguments.options.preferStaticPreview ? { preferStaticPreview: true } : {})
    };
    const logger = await createCliLogger({
      command: parsedArguments.command,
      ...(parsedArguments.options.logDir === undefined ? {} : { logDir: path.resolve(cwd, parsedArguments.options.logDir) }),
      vaultRoot: resolvedConfig.config.vaultRoot
    });

    reporter = {
      json: parsedArguments.options.json,
      logger,
      output
    };
    reporter.logger.info(`Resolved vault root: ${resolvedConfig.config.vaultRoot}`);

    cliRuntime =
      runtime.createRuntime?.({
        ...(builderOptions.quartzPackageRoot === undefined ? {} : { quartzPackageRoot: builderOptions.quartzPackageRoot }),
        ...(builderOptions.previewPort === undefined ? {} : { previewPort: builderOptions.previewPort }),
        preferStaticPreview: parsedArguments.options.preferStaticPreview
      }) ??
      createDefaultPublisherRuntime({
        builder: builderOptions
      });

    if (!reporter.json) {
      writeInfo(reporter, createConfigSourceMessage(resolvedConfig.configPath, resolvedConfig.config.vaultRoot));
    }

    switch (parsedArguments.command) {
      case "scan":
        return await runScanCommand(cliRuntime.orchestrator, resolvedConfig.config, reporter);
      case "build":
        return await runBuildCommand(cliRuntime.orchestrator, resolvedConfig.config, reporter);
      case "preview":
        return await runPreviewCommand(cliRuntime, resolvedConfig.config, reporter, runtime.waitForPreviewShutdown);
      case "deploy":
        return await runDeployCommand(cliRuntime.orchestrator, resolvedConfig.config, reporter);
    }

    return 1;
  } catch (error) {
    const message = formatError(error);

    if (reporter === undefined) {
      output.error(message);
    } else {
      writeError(reporter, message);
    }

    return 1;
  } finally {
    await cliRuntime?.stop();
    await reporter?.logger.close();
  }
}

async function runScanCommand(orchestrator: CliOrchestrator, config: PublisherConfig, reporter: CliReporter): Promise<number> {
  const report = await orchestrator.scan(config);

  if (reporter.json) {
    printJson(reporter, {
      command: "scan",
      success: true,
      logPath: reporter.logger.logPath,
      manifest: report.manifest,
      issues: report.issues
    });
    return 0;
  }

  writeInfo(
    reporter,
    [
      "Scan complete.",
      `Notes: ${report.manifest.notes.length}`,
      `Assets: ${report.manifest.assetFiles.length}`,
      `Unsupported: ${report.manifest.unsupportedObjects.length}`,
      `Issues: ${report.issues.length}`
    ].join(" ")
  );
  printIssues(reporter, report.issues);
  return 0;
}

async function runBuildCommand(orchestrator: CliOrchestrator, config: PublisherConfig, reporter: CliReporter): Promise<number> {
  const result = await orchestrator.build(config);

  writeBuildLogsToLogger(reporter, result.logs);

  if (reporter.json) {
    printJson(reporter, {
      command: "build",
      success: result.success,
      logPath: reporter.logger.logPath,
      result
    });
    return result.success ? 0 : 1;
  }

  printBuildResult(reporter, result);
  return result.success ? 0 : 1;
}

async function runPreviewCommand(
  runtime: CliSession,
  config: PublisherConfig,
  reporter: CliReporter,
  waitForPreviewShutdown: (() => Promise<void>) | undefined
): Promise<number> {
  const session = await runtime.orchestrator.preview(config);

  if (reporter.json) {
    printJson(reporter, {
      command: "preview",
      success: true,
      logPath: reporter.logger.logPath,
      session
    });
  } else {
    printPreviewSession(reporter, session);
  }

  reporter.logger.info(`Preview active at ${session.url}`);
  await (waitForPreviewShutdown ?? waitForTerminationSignal)();
  return 0;
}

async function runDeployCommand(orchestrator: CliOrchestrator, config: PublisherConfig, reporter: CliReporter): Promise<number> {
  const build = await orchestrator.build(config);

  writeBuildLogsToLogger(reporter, build.logs);

  if (!build.success) {
    if (reporter.json) {
      printJson(reporter, {
        command: "deploy",
        success: false,
        logPath: reporter.logger.logPath,
        build
      });
    } else {
      printBuildResult(reporter, build);
    }

    return 1;
  }

  const deploy = await orchestrator.deployFromBuild(build, config);

  if (reporter.json) {
    printJson(reporter, {
      command: "deploy",
      success: deploy.success,
      logPath: reporter.logger.logPath,
      build,
      deploy
    });
    return deploy.success ? 0 : 1;
  }

  printBuildResult(reporter, build);
  printDeployResult(reporter, deploy);
  return deploy.success ? 0 : 1;
}

function printBuildResult(reporter: CliReporter, result: BuildResult): void {
  writeInfo(
    reporter,
    [
      result.success ? "Build succeeded." : "Build failed.",
      `Issues: ${result.issues.length}`,
      `Logs: ${result.logs.length}`,
      `Duration: ${result.durationMs}ms`,
      ...(result.outputDir === undefined ? [] : [`Output: ${result.outputDir}`])
    ].join(" ")
  );
  printIssues(reporter, result.issues);

  const lastLog = result.logs.at(-1);

  if (lastLog !== undefined) {
    writeInfo(reporter, `Last log: [${lastLog.level}] ${lastLog.message}`);
  }
}

function writeBuildLogsToLogger(reporter: CliReporter, logs: BuildLogEntry[]): void {
  for (const log of logs) {
    reporter.logger.entry(log.level === "warning" || log.level === "error" ? log.level : "info", `[build] ${log.message}`);
  }
}

function printPreviewSession(reporter: CliReporter, session: PreviewSession): void {
  writeInfo(reporter, `Preview ready at ${session.url}`);
  writeInfo(reporter, `Workspace: ${session.workspaceRoot}`);
  writeInfo(reporter, "Press Ctrl+C to stop preview.");
}

function printDeployResult(reporter: CliReporter, result: DeployResult): void {
  writeInfo(
    reporter,
    [
      result.success ? "Deploy succeeded." : "Deploy failed.",
      `Target: ${result.target}`,
      result.message,
      ...(result.destination === undefined ? [] : [`Destination: ${result.destination}`])
    ].join(" ")
  );
}

function printIssues(reporter: CliReporter, issues: BuildIssue[]): void {
  if (issues.length === 0) {
    writeInfo(reporter, "No issues found.");
    return;
  }

  writeInfo(reporter, `Issue summary: ${createIssueSummary(issues)}`);

  for (const issue of issues) {
    writeInfo(reporter, `- ${formatIssue(issue)}`);
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
  const location = issue.location === undefined ? issue.file : `${issue.file}:${issue.location.line}:${issue.location.column}`;

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
    "  publisher-cli build --config ./osp.config.json --log-dir ./.osp/logs",
    "  publisher-cli preview --vault-root ./my-vault --preview-port 8080",
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

function printJson(reporter: CliReporter, payload: CliJsonResult): void {
  reporter.output.log(JSON.stringify(payload));
  reporter.logger.info(`JSON result emitted for ${payload.command}.`);
}

function writeInfo(reporter: CliReporter, message: string): void {
  reporter.logger.info(message);

  if (!reporter.json) {
    reporter.output.log(message);
  }
}

function writeError(reporter: CliReporter, message: string): void {
  reporter.logger.error(message);
  reporter.output.error(message);
}
