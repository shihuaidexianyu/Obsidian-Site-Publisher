import type { BuildLogEntry } from "./types";

export interface Logger {
  entries(): BuildLogEntry[];
  debug(message: string): void;
  info(message: string): void;
  warning(message: string): void;
  error(message: string): void;
}

export function createMemoryLogger(): Logger {
  const logEntries: BuildLogEntry[] = [];

  return {
    entries(): BuildLogEntry[] {
      return [...logEntries];
    },
    debug(message: string): void {
      logEntries.push(createEntry("debug", message));
    },
    info(message: string): void {
      logEntries.push(createEntry("info", message));
    },
    warning(message: string): void {
      logEntries.push(createEntry("warning", message));
    },
    error(message: string): void {
      logEntries.push(createEntry("error", message));
    }
  };
}

function createEntry(level: BuildLogEntry["level"], message: string): BuildLogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString()
  };
}
