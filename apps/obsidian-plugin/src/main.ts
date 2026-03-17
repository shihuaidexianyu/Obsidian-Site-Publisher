import type { PublisherConfig } from "@osp/shared";

export const pluginManifest = {
  id: "obsidian-site-publisher",
  name: "Obsidian Site Publisher"
} as const;

export type PluginCommand = "preview" | "build" | "publish" | "issues";

export class PublisherPluginShell {
  public getSupportedCommands(): PluginCommand[] {
    return ["preview", "build", "publish", "issues"];
  }

  public createInitialConfig(vaultRoot: string): PublisherConfig {
    return {
      vaultRoot,
      publishMode: "frontmatter",
      includeGlobs: [],
      excludeGlobs: ["**/.obsidian/**"],
      outputDir: `${vaultRoot}/.osp/dist`,
      builder: "quartz",
      deployTarget: "none",
      enableSearch: true,
      enableBacklinks: true,
      enableGraph: true,
      strictMode: false
    };
  }
}
