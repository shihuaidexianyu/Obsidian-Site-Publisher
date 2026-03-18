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

  return [
    `CLI ${command} failed with exit code ${exitCode}.`,
    ...(detail === undefined ? [] : [`Last CLI output: ${detail}`])
  ].join(" ");
}

export function enrichCliLaunchError(cliEntrypoint: string, error: unknown): Error {
  if (error instanceof Error) {
    return new Error(`Failed to run external publisher-cli at ${cliEntrypoint}: ${error.message}`);
  }

  return new Error(`Failed to run external publisher-cli at ${cliEntrypoint}.`);
}
