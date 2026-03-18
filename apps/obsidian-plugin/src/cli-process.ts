import type { ChildProcess } from "node:child_process";

type CliChildProcess = ChildProcess;

export function createCompletedProcessTracker(child: CliChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", () => resolve());
  });
}

export async function stopChildProcess(child: CliChildProcess): Promise<void> {
  if (child.exitCode !== null || child.killed) {
    return;
  }

  const settled = new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
  });

  child.kill();
  await settled;
}

export function createCliFailureMessage(command: string, exitCode: number, stdout: string, stderr: string): string {
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
  const commandLabel = formatCliCommand(command);

  return [
    `外部 CLI 执行“${commandLabel}”失败，退出码为 ${exitCode}。`,
    ...(detail === undefined ? [] : [`最后一条 CLI 输出：${detail}`])
  ].join(" ");
}

export function enrichCliLaunchError(cliEntrypoint: string, error: unknown): Error {
  if (error instanceof Error) {
    return new Error(`启动外部 publisher-cli 失败：${cliEntrypoint}。${error.message}`);
  }

  return new Error(`启动外部 publisher-cli 失败：${cliEntrypoint}。`);
}

function formatCliCommand(command: string): string {
  switch (command) {
    case "scan":
      return "扫描";
    case "build":
      return "构建";
    case "preview":
      return "预览";
    case "deploy":
      return "发布";
    default:
      return command;
  }
}
