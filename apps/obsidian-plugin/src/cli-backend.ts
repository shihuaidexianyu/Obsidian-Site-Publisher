import { fork, spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  CliBuildResultSchema,
  CliDeployResultSchema,
  CliPreviewResultSchema,
  CliScanResultSchema,
  PublisherConfigSchema,
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
import type { PluginExecutionBackend, PluginPublishResult, PluginScanResult } from "./plugin-backend.js";
type CliBackendOptions = {
  cliCommand: string;
  logDirectory?: string;
  previewPort?: number;
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
      issues: payload.issues as PluginScanResult["issues"]
    };
  }

  public async build(config: PublisherConfig): Promise<BuildResult> {
    const payload = await this.runOneShotCommand("build", config, CliBuildResultSchema);

    return payload.result as BuildResult;
  }

  public async preview(config: PublisherConfig): Promise<PreviewSession> {
    await this.stopActivePreview();

    const cliCommand = this.options.cliCommand;
    const normalizedConfig = normalizePluginConfig(config);
    const tempDir = await createCliTempDirectory(this.options.tempRoot);
    const configPath = path.join(tempDir, "publisher.config.json");

    await writeCliConfig(configPath, normalizedConfig);

    const child = createCliChild(this.options.cliCommand, this.createCliArgs("preview", configPath), {
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
      const session = await new Promise<PreviewSession>((resolve, reject) => {
        const resolveIfReady = (): void => {
          const payload = tryParseCliPayload(stdout, CliPreviewResultSchema);

          if (payload === undefined) {
            return;
          }

          previewResolved = true;
          resolve(payload.session);
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

      return session;
    } catch (error) {
      await stopChildProcess(child);
      await exitState.catch(() => undefined);
      await rm(tempDir, { recursive: true, force: true });
      throw enrichCliLaunchError(cliCommand, error);
    }
  }

  public async publish(config: PublisherConfig): Promise<PluginPublishResult> {
    const payload = await this.runOneShotCommand("deploy", config, CliDeployResultSchema);

    if (payload.deploy === undefined) {
      return {
        build: payload.build as BuildResult
      };
    }

    return {
      build: payload.build as BuildResult,
      deploy: payload.deploy as NonNullable<PluginPublishResult["deploy"]>
    };
  }

  public async dispose(): Promise<void> {
    await this.stopActivePreview();
  }

  private async runOneShotCommand<TSchema extends z.ZodTypeAny>(
    command: "scan" | "build" | "deploy",
    config: PublisherConfig,
    schema: TSchema
  ): Promise<z.output<TSchema>> {
    const cliCommand = this.options.cliCommand;
    const normalizedConfig = normalizePluginConfig(config);
    const tempDir = await createCliTempDirectory(this.options.tempRoot);
    const configPath = path.join(tempDir, "publisher.config.json");

    await writeCliConfig(configPath, normalizedConfig);

    try {
      const completed = await runCliProcess(this.options.cliCommand, this.createCliArgs(command, configPath), {
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

  private createCliArgs(command: "scan" | "build" | "preview" | "deploy", configPath: string): string[] {
    return [
      command,
      "--config",
      configPath,
      "--json",
      ...(this.options.logDirectory === undefined ? [] : ["--log-dir", this.options.logDirectory]),
      ...(this.options.previewPort === undefined ? [] : ["--preview-port", `${this.options.previewPort}`])
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
  if (/\.(c|m)?js$/iu.test(cliCommand)) {
    return fork(cliCommand, args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1"
      },
      execPath: process.execPath,
      silent: true
    });
  }

  if (process.platform === "win32" && /\.(cmd|bat)$/iu.test(cliCommand)) {
    return spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", buildCommandLine(cliCommand, args)], {
      cwd: options.cwd,
      env: {
        ...process.env
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
  }

  return spawn(cliCommand, args, {
    cwd: options.cwd,
    env: {
      ...process.env
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
}

function buildCommandLine(command: string, args: string[]): string {
  return [command, ...args].map(quoteShellArgument).join(" ");
}

function quoteShellArgument(argument: string): string {
  return /[\s"]/u.test(argument) ? `"${argument.replace(/"/g, '\\"')}"` : argument;
}

function tryParseCliPayload<TSchema extends z.ZodTypeAny>(stdout: string, schema: TSchema): z.output<TSchema> | undefined {
  const lines = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "");

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const candidate = lines[index];

    if (candidate === undefined) {
      continue;
    }

    try {
      return schema.parse(JSON.parse(candidate)) as z.output<TSchema>;
    } catch {
      // Keep scanning older lines until we find the JSON payload.
    }
  }

  return undefined;
}
