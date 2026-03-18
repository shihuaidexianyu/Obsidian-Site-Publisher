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

const maxVisibleLogEntries = 40;

export function createIssuePanelMeta(state: PluginExecutionState): PanelMeta {
  return {
    title: "发布问题",
    summary: createSummaryText(state, `最近一次结果里有 ${state.lastIssues.length} 个问题`),
    emptyMessage: "运行“检查发布问题”或“构建站点”后，可在这里查看阻断项。"
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
  const displayedCount = Math.min(state.lastLogs.length, maxVisibleLogEntries);
  const logPathSummary = state.lastLogPath === undefined ? "完整日志请查看 CLI 日志目录。" : `完整日志：${state.lastLogPath}`;

  return {
    title: "构建日志",
    summary: createSummaryText(state, `侧栏仅显示最近 ${displayedCount} 条日志 | ${logPathSummary}`),
    emptyMessage: "运行“构建站点”或“发布站点”后，可在这里查看日志摘要；完整内容在日志文件里。"
  };
}

export function createLogPanelItems(state: PluginExecutionState): LogPanelItem[] {
  return state.lastLogs.slice(-maxVisibleLogEntries).map((entry) => ({
    badge: entry.level.toUpperCase(),
    timestamp: formatTimestamp(entry),
    message: entry.message
  }));
}

function createSummaryText(state: PluginExecutionState, fallback: string): string {
  const parts = [fallback];

  if (state.lastCommand !== undefined) {
    parts.push(`最近命令：${formatCommand(state.lastCommand)}`);
  }

  if (state.lastUpdatedAt !== undefined) {
    parts.push(`更新时间：${state.lastUpdatedAt}`);
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

function formatCommand(command: PluginExecutionState["lastCommand"]): string {
  switch (command) {
    case "preview":
      return "预览";
    case "build":
      return "构建";
    case "publish":
      return "发布";
    case "issues":
      return "检查问题";
    default:
      return "未知";
  }
}
