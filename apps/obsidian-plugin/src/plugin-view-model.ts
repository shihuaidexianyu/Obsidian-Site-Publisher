import type { BuildIssue, BuildLogEntry } from "@osp/shared";

import type { PluginExecutionState } from "./plugin-shell.js";

export type PanelMeta = {
  title: string;
  summary: string;
  emptyMessage: string;
};

export type IssuePanelItem = {
  badge: string;
  fileLabel: string;
  message: string;
  suggestion?: string;
};

export type LogPanelItem = {
  badge: string;
  timestamp: string;
  message: string;
};

export function createIssuePanelMeta(state: PluginExecutionState): PanelMeta {
  return {
    title: "Publish Issues",
    summary: createSummaryText(state, `${state.lastIssues.length} issue(s) in the latest result`),
    emptyMessage: "Run the issues or build command to inspect publish blockers here."
  };
}

export function createIssuePanelItems(state: PluginExecutionState): IssuePanelItem[] {
  return state.lastIssues.map((issue) => {
    const item: IssuePanelItem = {
      badge: `${issue.severity.toUpperCase()} · ${issue.code}`,
      fileLabel: createIssueFileLabel(issue),
      message: issue.message
    };

    if (issue.suggestion !== undefined) {
      item.suggestion = issue.suggestion;
    }

    return item;
  });
}

export function createLogPanelMeta(state: PluginExecutionState): PanelMeta {
  return {
    title: "Build Logs",
    summary: createSummaryText(state, `${state.lastLogs.length} log entr${state.lastLogs.length === 1 ? "y" : "ies"} captured`),
    emptyMessage: "Run the build or publish command to inspect structured logs here."
  };
}

export function createLogPanelItems(state: PluginExecutionState): LogPanelItem[] {
  return state.lastLogs.map((entry) => ({
    badge: entry.level.toUpperCase(),
    timestamp: formatTimestamp(entry),
    message: entry.message
  }));
}

function createSummaryText(state: PluginExecutionState, fallback: string): string {
  const parts = [fallback];

  if (state.lastCommand !== undefined) {
    parts.push(`last command: ${state.lastCommand}`);
  }

  if (state.lastUpdatedAt !== undefined) {
    parts.push(`updated: ${state.lastUpdatedAt}`);
  }

  return parts.join(" | ");
}

function createIssueFileLabel(issue: BuildIssue): string {
  if (issue.location === undefined) {
    return issue.file;
  }

  return `${issue.file}:${issue.location.line}:${issue.location.column}`;
}

function formatTimestamp(entry: BuildLogEntry): string {
  return entry.timestamp.replace("T", " ").replace("Z", " UTC");
}
