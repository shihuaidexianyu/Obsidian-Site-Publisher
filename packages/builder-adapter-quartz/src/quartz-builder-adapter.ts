import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";

import type { BuildLogEntry, BuildResult, PreviewSession, PreparedWorkspace, PublisherConfig } from "@osp/shared";

import type { BuilderAdapter } from "./contracts.js";
import { ensureQuartzWorkspaceRuntime, readQuartzVersion } from "./quartz-runtime.js";

type QuartzBuilderAdapterOptions = {
  previewPort?: number;
  previewReadinessTimeoutMs?: number;
  previewWsPort?: number;
  quartzPackageRoot?: string;
};

type PreviewProcessRecord = {
  child: ReturnType<typeof spawn>;
  logs: BuildLogEntry[];
};

const defaultPreviewPort = 8080;
const defaultPreviewReadinessTimeoutMs = 20_000;
const defaultPreviewWsPort = 3001;

export class QuartzBuilderAdapter implements BuilderAdapter {
  private readonly previewProcesses = new Map<string, PreviewProcessRecord>();
  private quartzPackageRoot: string | undefined;

  public constructor(private readonly options: QuartzBuilderAdapterOptions = {}) { }

  public async build(workspace: PreparedWorkspace, config: PublisherConfig): Promise<BuildResult> {
    const startedAt = Date.now();

    try {
      const quartzPackageRoot = this.getQuartzPackageRoot();

      await ensureQuartzWorkspaceRuntime(workspace, config, quartzPackageRoot);
      const execution = await runQuartzCommand({
        args: this.createBuildArgs(workspace),
        bootstrapCliPath: this.getBootstrapCliPath(workspace),
        cwd: workspace.rootDir,
        quartzPackageRoot
      });

      return {
        success: execution.exitCode === 0,
        manifestPath: workspace.manifestPath,
        issues: [],
        logs: execution.logs,
        durationMs: Date.now() - startedAt,
        ...(execution.exitCode === 0 ? { outputDir: workspace.outputDir } : {})
      };
    } catch (error) {
      return {
        success: false,
        manifestPath: workspace.manifestPath,
        issues: [],
        logs: [createErrorLog(error)],
        durationMs: Date.now() - startedAt
      };
    }
  }

  public async preview(workspace: PreparedWorkspace, config: PublisherConfig): Promise<PreviewSession> {
    const quartzPackageRoot = this.getQuartzPackageRoot();

    await ensureQuartzWorkspaceRuntime(workspace, config, quartzPackageRoot);
    await this.stopPreview(workspace.rootDir);

    const port = this.options.previewPort ?? defaultPreviewPort;
    const wsPort = this.options.previewWsPort ?? defaultPreviewWsPort;
    const logs: BuildLogEntry[] = [];
    const child = spawn(
      process.execPath,
      [this.getBootstrapCliPath(workspace), ...this.createPreviewArgs(workspace, port, wsPort)],
      {
        cwd: workspace.rootDir,
        env: createQuartzChildProcessEnv(),
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      }
    );

    attachProcessLogs(child, logs);

    const exitPromise = onceProcessExit(child);

    try {
      await waitForPortReady({
        exitPromise,
        host: "127.0.0.1",
        port,
        timeoutMs: this.options.previewReadinessTimeoutMs ?? defaultPreviewReadinessTimeoutMs
      });
    } catch (error) {
      child.kill();
      this.previewProcesses.delete(workspace.rootDir);
      throw new Error(createPreviewFailureMessage(error, logs));
    }

    this.previewProcesses.set(workspace.rootDir, {
      child,
      logs
    });

    return {
      url: `http://localhost:${port}`,
      workspaceRoot: workspace.rootDir,
      startedAt: new Date().toISOString()
    };
  }

  public async stopPreview(workspaceRoot?: string): Promise<void> {
    if (workspaceRoot !== undefined) {
      await stopPreviewProcess(this.previewProcesses, workspaceRoot);
      return;
    }

    await Promise.all([...this.previewProcesses.keys()].map(async (rootDir) => stopPreviewProcess(this.previewProcesses, rootDir)));
  }

  private createBuildArgs(workspace: PreparedWorkspace): string[] {
    return [
      "build",
      "--directory",
      toPosixRelativePath(workspace.rootDir, workspace.contentDir),
      "--output",
      toPosixRelativePath(workspace.rootDir, workspace.outputDir)
    ];
  }

  private createPreviewArgs(workspace: PreparedWorkspace, port: number, wsPort: number): string[] {
    return [
      ...this.createBuildArgs(workspace),
      "--serve",
      "--watch",
      "--port",
      `${port}`,
      "--wsPort",
      `${wsPort}`
    ];
  }

  private getBootstrapCliPath(workspace: PreparedWorkspace): string {
    return path.join(workspace.rootDir, "quartz", "bootstrap-cli.mjs");
  }

  private getQuartzPackageRoot(): string {
    if (this.quartzPackageRoot !== undefined) {
      return this.quartzPackageRoot;
    }

    this.quartzPackageRoot = this.options.quartzPackageRoot ?? resolveQuartzPackageRoot();
    return this.quartzPackageRoot;
  }
}

function resolveQuartzPackageRoot(): string {
  try {
    return path.dirname(resolveNodeRequire().resolve("@jackyzha0/quartz/package.json"));
  } catch (error) {
    throw new Error(createQuartzRuntimeResolutionMessage(error));
  }
}

function resolveNodeRequire(): NodeJS.Require {
  const nativeRequire = readNativeRequire();

  if (nativeRequire !== undefined) {
    return nativeRequire;
  }

  return createRequire(path.join(process.cwd(), "package.json"));
}

function readNativeRequire(): NodeJS.Require | undefined {
  try {
    return Function("return typeof require === 'function' ? require : undefined;")() as NodeJS.Require | undefined;
  } catch {
    return undefined;
  }
}

function createQuartzChildProcessEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1"
  };
}

async function runQuartzCommand(input: {
  args: string[];
  bootstrapCliPath: string;
  cwd: string;
  quartzPackageRoot: string;
}): Promise<{ exitCode: number; logs: BuildLogEntry[] }> {
  const logs: BuildLogEntry[] = [
    {
      level: "info",
      message: `Using Quartz ${await readQuartzVersion(input.quartzPackageRoot)}.`,
      timestamp: new Date().toISOString()
    }
  ];
  const child = spawn(process.execPath, [input.bootstrapCliPath, ...input.args], {
    cwd: input.cwd,
    env: createQuartzChildProcessEnv(),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });

  attachProcessLogs(child, logs);
  const exitCode = await onceProcessExit(child);

  return {
    exitCode,
    logs
  };
}

function attachProcessLogs(child: ReturnType<typeof spawn>, logs: BuildLogEntry[]): void {
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => pushLogLines(logs, chunk, "info"));
  child.stderr?.on("data", (chunk: string) => pushLogLines(logs, chunk, "error"));
}

function pushLogLines(logs: BuildLogEntry[], chunk: string, level: BuildLogEntry["level"]): void {
  for (const line of chunk.split(/\r?\n/u)) {
    const message = line.trim();

    if (message === "") {
      continue;
    }

    logs.push({
      level,
      message,
      timestamp: new Date().toISOString()
    });
  }
}

function onceProcessExit(child: ReturnType<typeof spawn>): Promise<number> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

async function waitForPortReady(input: {
  exitPromise: Promise<number>;
  host: string;
  port: number;
  timeoutMs: number;
}): Promise<void> {
  const deadline = Date.now() + input.timeoutMs;

  while (Date.now() < deadline) {
    const exitState = await Promise.race([
      input.exitPromise.then((code) => ({ kind: "exit" as const, code })),
      delay(250).then(() => ({ kind: "wait" as const }))
    ]);

    if (exitState.kind === "exit") {
      throw new Error(`Quartz preview exited before becoming ready with code ${exitState.code}.`);
    }

    if (await canConnect(input.host, input.port)) {
      return;
    }
  }

  throw new Error(`Quartz preview did not open http://localhost:${input.port} within ${input.timeoutMs}ms.`);
}

function canConnect(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function delay(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
  });
}

function createErrorLog(error: unknown): BuildLogEntry {
  return {
    level: "error",
    message: error instanceof Error ? error.message : "Quartz build failed with an unknown error.",
    timestamp: new Date().toISOString()
  };
}

function createQuartzRuntimeResolutionMessage(error: unknown): string {
  const details = error instanceof Error ? error.message : "Unknown module resolution failure.";

  return [
    "Quartz runtime could not be resolved.",
    "The current environment does not provide @jackyzha0/quartz as a loadable package.",
    "If you are running the packaged Obsidian plugin, the install bundle is not self-contained for build/preview/publish yet.",
    `Details: ${details}`
  ].join(" ");
}

function createPreviewFailureMessage(error: unknown, logs: BuildLogEntry[]): string {
  const lastLog = logs.at(-1)?.message;
  const baseMessage = error instanceof Error ? error.message : "Quartz preview failed to start.";

  if (lastLog === undefined) {
    return baseMessage;
  }

  return `${baseMessage} Last Quartz log: ${lastLog}`;
}

async function stopPreviewProcess(
  previewProcesses: Map<string, PreviewProcessRecord>,
  workspaceRoot: string
): Promise<void> {
  const record = previewProcesses.get(workspaceRoot);

  if (record === undefined) {
    return;
  }

  const { child } = record;

  if (child.killed || child.exitCode !== null) {
    previewProcesses.delete(workspaceRoot);
    return;
  }

  const exitPromise = onceProcessExit(child);

  child.kill();

  await Promise.race([exitPromise, delay(5_000)]);
  previewProcesses.delete(workspaceRoot);
}

function toPosixRelativePath(rootDir: string, targetPath: string): string {
  const relativePath = path.relative(rootDir, targetPath).replace(/\\/g, "/");

  return relativePath === "" ? "." : relativePath;
}
