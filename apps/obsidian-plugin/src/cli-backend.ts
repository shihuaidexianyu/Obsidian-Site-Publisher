import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  BuildResultSchema,
  CliBuildResultSchema,
  CliDeployResultSchema,
  CliPreviewResultSchema,
  CliScanResultSchema,
  PublisherConfigSchema,
  type DeployResult,
  type BuildResult,
  type PreviewSession,
  type PublisherConfig
} from "@osp/shared";
import type { z } from "zod";

import {
  createCliFailureMessage,
  createCompletedProcessTracker,
  enrichCliLaunchError,
  stopChildProcess
} from "./cli-process.js";
import { tryParseCliPayload } from "./cli-json.js";
import type {
  PluginBuildResult,
  PluginDeployFromBuildResult,
  PluginExecutionBackend,
  PluginPreviewResult,
  PluginPublishResult,
  PluginScanResult
} from "./plugin-backend.js";
type CliBackendOptions = {
  cliCommand: string;
  logDirectory?: string;
  previewPort?: number;
  quartzPackageRoot?: string;
  tempRoot?: string;
};
type CliChildProcess = ReturnType<typeof spawn>;
type RunningPreview = {
  child: CliChildProcess;
  tempDir: string;
  settled: Promise<void>;
};
type CompletedCliProcess = {
  exitCode: number;
  stdout: string;
  stderr: string;
};
export class CliPluginBackend implements PluginExecutionBackend {
  private activePreview: RunningPreview | undefined;

  public constructor(private readonly options: CliBackendOptions) {}

  public async scan(config: PublisherConfig): Promise<PluginScanResult> {
    const payload = await this.runOneShotCommand("scan", config, CliScanResultSchema);

    return {
      manifest: payload.manifest as PluginScanResult["manifest"],
      issues: payload.issues as PluginScanResult["issues"],
      logPath: payload.logPath
    };
  }

  public async build(config: PublisherConfig): Promise<PluginBuildResult> {
    const payload = await this.runOneShotCommand("build", config, CliBuildResultSchema);

    return {
      result: payload.result as BuildResult,
      logPath: payload.logPath
    };
  }

  public async preview(config: PublisherConfig): Promise<PluginPreviewResult> {
    return this.startPreviewCommand(config);
  }

  public async previewBuilt(build: BuildResult, config: PublisherConfig): Promise<PluginPreviewResult> {
    return this.startPreviewCommand(config, build);
  }

  public async publish(config: PublisherConfig): Promise<PluginPublishResult> {
    const payload = await this.runOneShotCommand("deploy", config, CliDeployResultSchema);

    if (payload.deploy === undefined) {
      return {
        build: payload.build as BuildResult,
        logPath: payload.logPath
      };
    }

    return {
      build: payload.build as BuildResult,
      deploy: payload.deploy as NonNullable<PluginPublishResult["deploy"]>,
      logPath: payload.logPath
    };
  }

  public async deployBuilt(build: BuildResult, config: PublisherConfig): Promise<PluginDeployFromBuildResult> {
    const payload = await this.runOneShotCommand("deploy", config, CliDeployResultSchema, build);

    return {
      deploy: normalizeDeployResult(
        payload.deploy ?? {
          success: false,
          target: config.deployTarget,
          message: "CLI deploy command did not return a deploy result."
        }
      ),
      logPath: payload.logPath
    };
  }

  public async dispose(): Promise<void> {
    await this.stopActivePreview();
  }

  private async startPreviewCommand(config: PublisherConfig, build: BuildResult | undefined = undefined): Promise<PluginPreviewResult> {
    await this.stopActivePreview();

    const cliCommand = this.options.cliCommand;
    const normalizedConfig = normalizePluginConfig(config);
    const tempDir = await createCliTempDirectory(this.options.tempRoot);
    const configPath = path.join(tempDir, "publisher.config.json");

    await writeCliConfig(configPath, normalizedConfig);
    if (build !== undefined) {
      await writeBuildResult(path.join(tempDir, "build-result.json"), build);
    }

    const child = createCliChild(this.options.cliCommand, this.createCliArgs("preview", configPath, build), {
      cwd: normalizedConfig.vaultRoot
    });

    if (child.stdout === null || child.stderr === null) {
      throw new Error("外部 publisher-cli 未暴露 stdout/stderr 管道。");
    }

    const stdoutStream = child.stdout;
    const stderrStream = child.stderr;

    stdoutStream.setEncoding("utf8");
    stderrStream.setEncoding("utf8");

    const exitState = createCompletedProcessTracker(child);
    let stdout = "";
    let stderr = "";
    let previewResolved = false;

    stdoutStream.on("data", (chunk: string) => {
      stdout += chunk;
    });
    stderrStream.on("data", (chunk: string) => {
      stderr += chunk;
    });

    try {
      const previewResult = await new Promise<PluginPreviewResult>((resolve, reject) => {
        const resolveIfReady = (): void => {
          const payload = tryParseCliPayload(stdout, CliPreviewResultSchema);

          if (payload === undefined) {
            return;
          }

          previewResolved = true;
          resolve({
            session: payload.session,
            logPath: payload.logPath
          });
        };

        stdoutStream.on("data", resolveIfReady);
        child.once("error", reject);
        child.once("exit", (exitCode) => {
          if (previewResolved) {
            return;
          }

          reject(new Error(createCliFailureMessage("preview", exitCode ?? 1, stdout, stderr)));
        });
        resolveIfReady();
      });

      this.activePreview = {
        child,
        tempDir,
        settled: exitState.finally(async () => {
          if (this.activePreview?.child === child) {
            this.activePreview = undefined;
          }

          await rm(tempDir, { recursive: true, force: true });
        })
      };

      return previewResult;
    } catch (error) {
      await stopChildProcess(child);
      await exitState.catch(() => undefined);
      await rm(tempDir, { recursive: true, force: true });
      throw enrichCliLaunchError(cliCommand, error);
    }
  }

  private async runOneShotCommand<TSchema extends z.ZodTypeAny>(
    command: "scan" | "build" | "deploy",
    config: PublisherConfig,
    schema: TSchema,
    build: BuildResult | undefined = undefined
  ): Promise<z.output<TSchema>> {
    const cliCommand = this.options.cliCommand;
    const normalizedConfig = normalizePluginConfig(config);
    const tempDir = await createCliTempDirectory(this.options.tempRoot);
    const configPath = path.join(tempDir, "publisher.config.json");

    await writeCliConfig(configPath, normalizedConfig);
    if (build !== undefined) {
      await writeBuildResult(path.join(tempDir, "build-result.json"), build);
    }

    try {
      const completed = await runCliProcess(this.options.cliCommand, this.createCliArgs(command, configPath, build), {
        cwd: normalizedConfig.vaultRoot
      });
      const payload = tryParseCliPayload(completed.stdout, schema);

      if (payload === undefined) {
        throw new Error(createCliFailureMessage(command, completed.exitCode, completed.stdout, completed.stderr));
      }

      return payload;
    } catch (error) {
      throw enrichCliLaunchError(cliCommand, error);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private createCliArgs(command: "scan" | "build" | "preview" | "deploy", configPath: string, build: BuildResult | undefined): string[] {
    return [
      command,
      "--config",
      configPath,
      "--json",
      ...(build === undefined ? [] : ["--build-result", path.join(path.dirname(configPath), "build-result.json")]),
      ...(this.options.logDirectory === undefined ? [] : ["--log-dir", this.options.logDirectory]),
      ...(this.options.previewPort === undefined ? [] : ["--preview-port", `${this.options.previewPort}`]),
      ...(this.options.quartzPackageRoot === undefined ? [] : ["--quartz-package-root", this.options.quartzPackageRoot])
    ];
  }

  private async stopActivePreview(): Promise<void> {
    if (this.activePreview === undefined) {
      return;
    }

    const { child, settled } = this.activePreview;

    this.activePreview = undefined;
    await stopChildProcess(child);
    await settled.catch(() => undefined);
  }
}

async function writeCliConfig(configPath: string, config: PublisherConfig): Promise<void> {
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
}

async function writeBuildResult(buildResultPath: string, build: BuildResult): Promise<void> {
  await writeFile(buildResultPath, JSON.stringify(BuildResultSchema.parse(build), null, 2), "utf8");
}

function normalizeDeployResult(result: {
  success: boolean;
  target: DeployResult["target"];
  message: string;
  destination?: string | undefined;
}): DeployResult {
  return {
    success: result.success,
    target: result.target,
    message: result.message,
    ...(result.destination === undefined ? {} : { destination: result.destination })
  };
}
async function createCliTempDirectory(tempRoot: string | undefined): Promise<string> {
  const baseDirectory = tempRoot ?? path.join(os.tmpdir(), "osp-plugin-cli-");
  return mkdtemp(baseDirectory);
}

function normalizePluginConfig(config: PublisherConfig): PublisherConfig {
  return PublisherConfigSchema.parse({
    ...config,
    vaultRoot: path.resolve(config.vaultRoot),
    outputDir: resolveVaultRelativePath(config.vaultRoot, config.outputDir),
    ...(config.deployOutputDir === undefined
      ? {}
      : {
          deployOutputDir: resolveVaultRelativePath(config.vaultRoot, config.deployOutputDir)
        })
  }) as PublisherConfig;
}

function resolveVaultRelativePath(vaultRoot: string, value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(vaultRoot, value);
}

async function runCliProcess(
  cliCommand: string,
  args: string[],
  options: {
    cwd: string;
  }
): Promise<CompletedCliProcess> {
  const child = createCliChild(cliCommand, args, options);

  if (child.stdout === null || child.stderr === null) {
    throw new Error("外部 publisher-cli 未暴露 stdout/stderr 管道。");
  }

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  child.stdout.on("data", (chunk: string) => {
    stdoutChunks.push(chunk);
  });
  child.stderr.on("data", (chunk: string) => {
    stderrChunks.push(chunk);
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      resolve(code ?? 1);
    });
  });

  return {
    exitCode,
    stdout: stdoutChunks.join(""),
    stderr: stderrChunks.join("")
  };
}

function createCliChild(
  cliCommand: string,
  args: string[],
  options: {
    cwd: string;
  }
): CliChildProcess {
  const normalizedCliCommand = normalizeCliCommand(cliCommand);

  if (/\.(c|m)?js$/iu.test(normalizedCliCommand)) {
    return spawn(resolveNodeCommand(), [normalizedCliCommand, ...args], {
      cwd: options.cwd,
      env: {
        ...process.env
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
  }

  if (process.platform === "win32" && /\.(cmd|bat)$/iu.test(normalizedCliCommand)) {
    return spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", buildCommandLine(normalizedCliCommand, args)], {
      cwd: options.cwd,
      env: {
        ...process.env
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
  }

  return spawn(normalizedCliCommand, args, {
    cwd: options.cwd,
    env: {
      ...process.env
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
}

function resolveNodeCommand(): string {
  return process.env.OSP_NODE_BINARY ?? process.env.NODE ?? "node";
}

function buildCommandLine(command: string, args: string[]): string {
  return [command, ...args].map(quoteShellArgument).join(" ");
}

function quoteShellArgument(argument: string): string {
  return /[\s"]/u.test(argument) ? `"${argument.replace(/"/g, '\\"')}"` : argument;
}

function normalizeCliCommand(cliCommand: string): string {
  const trimmedCommand = cliCommand.trim();

  if (trimmedCommand.length >= 2) {
    const firstCharacter = trimmedCommand[0];
    const lastCharacter = trimmedCommand.at(-1);

    if ((firstCharacter === "\"" || firstCharacter === "'") && firstCharacter === lastCharacter) {
      return trimmedCommand.slice(1, -1).trim();
    }
  }

  return trimmedCommand;
}
