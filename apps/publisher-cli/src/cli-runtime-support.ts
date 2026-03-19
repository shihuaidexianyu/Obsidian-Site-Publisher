import { existsSync } from "node:fs";
import path from "node:path";

export function resolveBundledNodeExecutablePath(): string | undefined {
  const candidate = path.join(path.dirname(process.execPath), process.platform === "win32" ? "node.exe" : "node");

  if (path.resolve(candidate) === path.resolve(process.execPath)) {
    return undefined;
  }

  return existsSync(candidate) ? candidate : undefined;
}

export function waitForTerminationSignal(): Promise<void> {
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
