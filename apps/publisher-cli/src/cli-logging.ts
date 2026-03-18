import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type CliLogger = {
  logPath: string;
  info(message: string): void;
  error(message: string): void;
  close(): Promise<void>;
};

export async function createCliLogger(input: {
  command: string;
  logDir?: string;
  vaultRoot: string;
}): Promise<CliLogger> {
  const logDir = input.logDir ?? path.join(input.vaultRoot, ".osp", "logs");
  const logPath = path.join(logDir, `${createLogTimestamp()}-${input.command}.log`);
  let pendingWrite = Promise.resolve();

  await mkdir(logDir, { recursive: true });

  const write = (level: "INFO" | "ERROR", message: string): void => {
    pendingWrite = pendingWrite.then(() =>
      appendFile(logPath, `[${new Date().toISOString()}] ${level} ${message}\n`, "utf8")
    );
  };

  write("INFO", `CLI log started for command ${input.command}.`);

  return {
    logPath,
    info(message: string): void {
      write("INFO", message);
    },
    error(message: string): void {
      write("ERROR", message);
    },
    async close(): Promise<void> {
      await pendingWrite;
    }
  };
}

function createLogTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/gu, "-");
}
