import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  BuildIssueSchema,
  BuildResultSchema,
  DeployResultSchema,
  PreviewSessionSchema,
  PublisherConfigSchema,
  VaultManifestSchema
} from "@osp/shared";
import type { BuildResult, PreviewSession, PublisherConfig } from "@osp/shared";
import { z } from "zod";

import type { PluginExecutionBackend, PluginPublishResult, PluginScanResult } from "./plugin-backend.js";

const ScanCliResultSchema = z.object({
  command: z.literal("scan"),
  success: z.literal(true),
  manifest: VaultManifestSchema,
  issues: z.array(BuildIssueSchema)
});

const BuildCliResultSchema = z.object({
  command: z.literal("build"),
  success: z.boolean(),
  result: BuildResultSchema
});

const PreviewCliResultSchema = z.object({
  command: z.literal("preview"),
  success: z.literal(true),
  session: PreviewSessionSchema
});

const DeployCliResultSchema = z.object({
  command: z.literal("deploy"),
  success: z.boolean(),
  build: BuildResultSchema,
  deploy: DeployResultSchema.optional()
});

type CliBackendOptions = {
  cliEntrypoint?: string;
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
    const payload = await this.runOneShotCommand("scan", config, ScanCliResultSchema);

    return {
      manifest: payload.manifest as PluginScanResult["manifest"],
      issues: payload.issues as PluginScanResult["issues"]
    };
  }

  public async build(config: PublisherConfig): Promise<BuildResult> {
    const payload = await this.runOneShotCommand("build", config, BuildCliResultSchema);

    return payload.result as BuildResult;
  }

  public async preview(config: PublisherConfig): Promise<PreviewSession> {
    await this.stopActivePreview();

    const cliEntrypoint = this.requireCliEntrypoint();
    const normalizedConfig = normalizePluginConfig(config);
    const tempDir = await createCliTempDirectory(this.options.tempRoot);
    const configPath = path.join(tempDir, "publisher.config.json");

    await writeCliConfig(configPath, normalizedConfig);

    const child = spawn(process.execPath, this.createCliArgs("preview", configPath, true), {
      cwd: normalizedConfig.vaultRoot,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1"
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });

    if (child.stdout === null || child.stderr === null) {
      throw new Error("Bundled publisher CLI did not expose stdout/stderr pipes.");
    }

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    const exitState = createCompletedProcessTracker(child);
    let stdout = "";
    let stderr = "";
    let previewResolved = false;

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    try {
      const session = await new Promise<PreviewSession>((resolve, reject) => {
        const resolveIfReady = (): void => {
          const payload = tryParseCliPayload(stdout, PreviewCliResultSchema);

          if (payload === undefined) {
            return;
          }

          previewResolved = true;
          resolve(payload.session);
        };

        child.stdout.on("data", resolveIfReady);
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
      throw enrichCliLaunchError(cliEntrypoint, error);
    }
  }

  public async publish(config: PublisherConfig): Promise<PluginPublishResult> {
    const payload = await this.runOneShotCommand("deploy", config, DeployCliResultSchema);

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
    const cliEntrypoint = this.requireCliEntrypoint();
    const normalizedConfig = normalizePluginConfig(config);
    const tempDir = await createCliTempDirectory(this.options.tempRoot);
    const configPath = path.join(tempDir, "publisher.config.json");

    await writeCliConfig(configPath, normalizedConfig);

    try {
      const completed = await runCliProcess(process.execPath, this.createCliArgs(command, configPath, false), {
        cwd: normalizedConfig.vaultRoot,
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: "1"
        }
      });
      const payload = tryParseCliPayload(completed.stdout, schema);

      if (payload === undefined) {
        throw new Error(createCliFailureMessage(command, completed.exitCode, completed.stdout, completed.stderr));
      }

      return payload;
    } catch (error) {
      throw enrichCliLaunchError(cliEntrypoint, error);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private createCliArgs(command: "scan" | "build" | "preview" | "deploy", configPath: string, preferStaticPreview: boolean): string[] {
    return [
      this.requireCliEntrypoint(),
      command,
      "--config",
      configPath,
      "--json",
      ...(this.options.quartzPackageRoot === undefined ? [] : ["--quartz-package-root", this.options.quartzPackageRoot]),
      ...(preferStaticPreview ? ["--static-preview"] : [])
    ];
  }

  private requireCliEntrypoint(): string {
    if (this.options.cliEntrypoint !== undefined) {
      return this.options.cliEntrypoint;
    }

    throw new Error("Bundled publisher CLI entrypoint was not found in the installed plugin.");
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
  command: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
  }
): Promise<CompletedCliProcess> {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });

  if (child.stdout === null || child.stderr === null) {
    throw new Error("Bundled publisher CLI did not expose stdout/stderr pipes.");
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

function createCompletedProcessTracker(child: CliChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", () => resolve());
  });
}

async function stopChildProcess(child: CliChildProcess): Promise<void> {
  if (child.exitCode !== null || child.killed) {
    return;
  }

  const settled = new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
  });

  child.kill();
  await settled;
}

function createCliFailureMessage(command: string, exitCode: number, stdout: string, stderr: string): string {
  const lastStdoutLine = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .at(-1);
  const lastStderrLine = stderr
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .at(-1);
  const detail = lastStderrLine ?? lastStdoutLine;

  return [
    `CLI ${command} failed with exit code ${exitCode}.`,
    ...(detail === undefined ? [] : [`Last CLI output: ${detail}`])
  ].join(" ");
}

function enrichCliLaunchError(cliEntrypoint: string, error: unknown): Error {
  if (error instanceof Error) {
    return new Error(`Failed to run bundled publisher CLI at ${cliEntrypoint}: ${error.message}`);
  }

  return new Error(`Failed to run bundled publisher CLI at ${cliEntrypoint}.`);
}
