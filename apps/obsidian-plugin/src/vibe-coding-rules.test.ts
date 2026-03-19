import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { StoredPublisherPluginSettingsSchema } from "./settings.js";

const testFilePath = fileURLToPath(import.meta.url);
const pluginSourceDirectory = path.dirname(testFilePath);
const workspaceRoot = path.resolve(pluginSourceDirectory, "..", "..", "..");
const pluginPackageJsonPath = path.join(workspaceRoot, "apps", "obsidian-plugin", "package.json");
const cliPackageJsonPath = path.join(workspaceRoot, "apps", "publisher-cli", "package.json");
const engineeringRulesPath = path.join(workspaceRoot, "docs", "prompts", "engineering-rules.md");
const forbiddenPluginDependencies = [
  "@osp/core",
  "@osp/parser",
  "@osp/diagnostics",
  "@osp/staging",
  "@osp/builder-adapter-quartz",
  "@osp/deploy-adapters"
];
const forbiddenPluginImportPattern =
  /from\s+["']@osp\/(core|parser|diagnostics|staging|builder-adapter-quartz|deploy-adapters)["']/u;

describe("vibe coding rules", () => {
  it("documents the repository's current architecture and guardrails", async () => {
    const document = await readFile(engineeringRulesPath, "utf8");

    expect(document).toContain("Every new external input must have a schema.");
    expect(document).toContain("Do not move business logic into UI code.");
    expect(document).toContain("Keep files under 300 logical lines whenever possible.");
    expect(document).toContain("test_vault/hw");
    expect(document).toContain("thin shell around external CLI calls");
  });

  it("keeps the Obsidian plugin isolated from orchestration packages", async () => {
    const packageJson = JSON.parse(await readFile(pluginPackageJsonPath, "utf8")) as {
      dependencies?: Record<string, string>;
    };
    const dependencyNames = Object.keys(packageJson.dependencies ?? {});

    expect(dependencyNames).toEqual(expect.not.arrayContaining(forbiddenPluginDependencies));

    for (const filePath of await collectTypeScriptFiles(pluginSourceDirectory)) {
      const fileContents = await readFile(filePath, "utf8");

      expect(fileContents, path.relative(workspaceRoot, filePath)).not.toMatch(forbiddenPluginImportPattern);
    }
  });

  it("keeps the CLI as the orchestration boundary", async () => {
    const packageJson = JSON.parse(await readFile(cliPackageJsonPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies).toMatchObject({
      "@osp/core": "workspace:*"
    });
    expect(Object.keys(packageJson.dependencies ?? {})).toEqual(expect.not.arrayContaining(["obsidian"]));
    expect(Object.keys(packageJson.devDependencies ?? {})).toEqual(expect.not.arrayContaining(["obsidian"]));
  });

  it("keeps plugin-side persisted external input behind a schema", () => {
    expect(StoredPublisherPluginSettingsSchema.safeParse({}).success).toBe(true);
    expect(
      StoredPublisherPluginSettingsSchema.safeParse({
        cli: {
          previewPort: "43180"
        }
      }).success
    ).toBe(false);
  });
});

async function collectTypeScriptFiles(directoryPath: string): Promise<string[]> {
  const filePaths: string[] = [];

  for (const entry of await readdir(directoryPath, { withFileTypes: true })) {
    const absolutePath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      filePaths.push(...(await collectTypeScriptFiles(absolutePath)));
      continue;
    }

    if (entry.isFile() && absolutePath.endsWith(".ts")) {
      filePaths.push(absolutePath);
    }
  }

  return filePaths;
}
