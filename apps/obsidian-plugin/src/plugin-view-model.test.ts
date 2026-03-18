import { describe, expect, it } from "vitest";

import {
  createIssuePanelItems,
  createIssuePanelMeta,
  createLogPanelItems,
  createLogPanelMeta
} from "./plugin-view-model.js";
import type { PluginExecutionState } from "./plugin-shell.js";

describe("plugin view model", () => {
  it("formats issues into stable panel items", () => {
    const state = createState({
      lastCommand: "issues",
      lastUpdatedAt: "2026-03-18T13:00:00.000Z",
      lastIssues: [
        {
          code: "BROKEN_LINK",
          severity: "error",
          file: "Broken.md",
          message: "Link target is missing.",
          location: {
            line: 3,
            column: 7
          },
          suggestion: "Publish the target note or fix the link."
        }
      ]
    });

    expect(createIssuePanelMeta(state)).toEqual({
      title: "发布问题",
      summary: "最近一次结果里有 1 个问题 | 最近命令：检查问题 | 更新时间：2026-03-18T13:00:00.000Z",
      emptyMessage: "运行“检查发布问题”或“构建站点”后，可在这里查看阻断项。"
    });
    expect(createIssuePanelItems(state)).toEqual([
      {
        badge: "ERROR · BROKEN_LINK",
        fileLabel: "Broken.md:3:7",
        message: "Link target is missing.",
        suggestion: "Publish the target note or fix the link."
      }
    ]);
  });

  it("formats logs into stable panel items", () => {
    const state = createState({
      lastCommand: "build",
      lastUpdatedAt: "2026-03-18T13:05:00.000Z",
      lastLogPath: "D:/vault/.osp/logs/build.log",
      lastLogs: [
        {
          level: "warning",
          message: "Quartz emitted a warning.",
          timestamp: "2026-03-18T13:04:59.000Z"
        }
      ]
    });

    expect(createLogPanelMeta(state)).toEqual({
      title: "构建日志",
      summary: "侧栏仅显示最近 1 条日志 | 完整日志：D:/vault/.osp/logs/build.log | 最近命令：构建 | 更新时间：2026-03-18T13:05:00.000Z",
      emptyMessage: "运行“构建站点”或“发布站点”后，可在这里查看日志摘要；完整内容在日志文件里。"
    });
    expect(createLogPanelItems(state)).toEqual([
      {
        badge: "WARNING",
        timestamp: "2026-03-18 13:04:59.000 UTC",
        message: "Quartz emitted a warning."
      }
    ]);
  });
});

function createState(overrides: Partial<PluginExecutionState>): PluginExecutionState {
  return {
    lastIssues: [],
    lastLogs: [],
    ...overrides
  };
}
