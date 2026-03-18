import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type GitCommandResult = {
  stdout: string;
  stderr: string;
};

export async function runGit(args: string[], cwd: string): Promise<GitCommandResult> {
  const result = await execFileAsync("git", args, {
    cwd,
    windowsHide: true
  });

  return {
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim()
  };
}
