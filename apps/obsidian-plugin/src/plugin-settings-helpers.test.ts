import { describe, expect, it } from "vitest";

import { formatGlobList, parseGlobList, updateGlobListSetting, updateOptionalCliSetting } from "./plugin-settings-helpers.js";

describe("plugin settings helpers", () => {
  it("formats and parses multi-line glob lists", () => {
    const patterns = ["课程笔记/**/*.md", "科研/**", "日记/**"];

    expect(formatGlobList(patterns)).toBe("课程笔记/**/*.md\n科研/**\n日记/**");
    expect(parseGlobList("课程笔记/**/*.md\n\n 科研/** \r\n日记/**")).toEqual(patterns);
  });

  it("updates include and exclude glob lists from textarea input", () => {
    const config = {
      vaultRoot: "/vault",
      publishMode: "folder" as const,
      publishRoot: "Public",
      includeGlobs: [],
      excludeGlobs: ["**/.obsidian/**"],
      outputDir: "/vault/.osp/dist",
      builder: "quartz" as const,
      deployTarget: "none" as const,
      enableSearch: true,
      enableBacklinks: true,
      enableGraph: true,
      strictMode: false
    };

    expect(updateGlobListSetting(config, "includeGlobs", "Public/**/*.md\n课程笔记/**")).toMatchObject({
      includeGlobs: ["Public/**/*.md", "课程笔记/**"]
    });
    expect(updateGlobListSetting(config, "excludeGlobs", "日记/**\n科研/草稿/**")).toMatchObject({
      excludeGlobs: ["日记/**", "科研/草稿/**"]
    });
  });

  it("normalizes quoted cli executable paths", () => {
    const cliSettings = {
      executablePath: undefined,
      logDirectory: undefined,
      previewPort: undefined
    };

    expect(updateOptionalCliSetting(cliSettings, "executablePath", '  "C:\\Tools\\publisher-cli.exe"  ')).toMatchObject({
      executablePath: "C:\\Tools\\publisher-cli.exe"
    });
    expect(updateOptionalCliSetting(cliSettings, "executablePath", "  'C:\\Tools\\publisher-cli.exe'  ")).toMatchObject({
      executablePath: "C:\\Tools\\publisher-cli.exe"
    });
  });
});
