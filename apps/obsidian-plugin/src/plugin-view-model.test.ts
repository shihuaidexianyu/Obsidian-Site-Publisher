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
      title: "Publish Issues",
      summary: "1 issue(s) in the latest result | last command: issues | updated: 2026-03-18T13:00:00.000Z",
      emptyMessage: "Run the issues or build command to inspect publish blockers here."
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
      lastLogs: [
        {
          level: "warning",
          message: "Quartz emitted a warning.",
          timestamp: "2026-03-18T13:04:59.000Z"
        }
      ]
    });

    expect(createLogPanelMeta(state)).toEqual({
      title: "Build Logs",
      summary: "1 log entry captured | last command: build | updated: 2026-03-18T13:05:00.000Z",
      emptyMessage: "Run the build or publish command to inspect structured logs here."
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
