import { createDefaultPublisherRuntime } from "@osp/core";
import type { PublisherOrchestrator } from "@osp/core";
import type { BuildIssue, BuildLogEntry, BuildResult, DeployResult, PreviewSession, PublisherConfig, VaultManifest } from "@osp/shared";

export const pluginManifest = {
  id: "obsidian-site-publisher",
  name: "Obsidian Site Publisher"
} as const;

export type PluginCommand = "preview" | "build" | "publish" | "issues";

export type PluginCommandDefinition = {
  id: string;
  name: string;
  command: PluginCommand;
};

export type PluginExecutionState = {
  lastCommand?: PluginCommand | undefined;
  lastUpdatedAt?: string | undefined;
  statusMessage?: string | undefined;
  lastManifest?: VaultManifest | undefined;
  lastIssues: BuildIssue[];
  lastLogs: BuildLogEntry[];
  lastBuildResult?: BuildResult | undefined;
  lastPreviewSession?: PreviewSession | undefined;
  lastDeployResult?: DeployResult | undefined;
};

export type PluginCommandResult =
  | {
      command: "issues";
      manifest: VaultManifest;
      issues: BuildIssue[];
      statusMessage: string;
    }
  | {
      command: "build";
      result: BuildResult;
      statusMessage: string;
    }
  | {
      command: "preview";
      session: PreviewSession;
      statusMessage: string;
    }
  | {
      command: "publish";
      build: BuildResult;
      deploy?: DeployResult;
      statusMessage: string;
    };

type PluginOrchestrator = Pick<PublisherOrchestrator, "scan" | "build" | "preview" | "deployFromBuild">;

type PluginRuntime = {
  orchestrator: PluginOrchestrator;
  stop(): Promise<void>;
};

const defaultState: PluginExecutionState = {
  lastIssues: [],
  lastLogs: []
};

export class PublisherPluginShell {
  private state: PluginExecutionState = defaultState;
  private activePreviewRuntime: PluginRuntime | undefined;

  public constructor(private readonly createRuntime: () => PluginRuntime = createDefaultPublisherRuntime) {}

  public getSupportedCommands(): PluginCommand[] {
    return this.getCommandDefinitions().map((definition) => definition.command);
  }

  public getCommandDefinitions(): PluginCommandDefinition[] {
    return [
      createCommandDefinition("preview", "Preview Site"),
      createCommandDefinition("build", "Build Site"),
      createCommandDefinition("publish", "Publish Site"),
      createCommandDefinition("issues", "Show Publish Issues")
    ];
  }

  public createInitialConfig(vaultRoot: string): PublisherConfig {
    return {
      vaultRoot,
      publishMode: "frontmatter",
      includeGlobs: [],
      excludeGlobs: ["**/.git/**", "**/.obsidian/**", "**/.osp/**", "**/.trash/**", "**/node_modules/**"],
      outputDir: `${vaultRoot}/.osp/dist`,
      builder: "quartz",
      deployTarget: "none",
      enableSearch: true,
      enableBacklinks: true,
      enableGraph: true,
      strictMode: false
    };
  }

  public getState(): PluginExecutionState {
    return {
      ...this.state,
      lastIssues: [...this.state.lastIssues],
      lastLogs: [...this.state.lastLogs]
    };
  }

  public async dispose(): Promise<void> {
    await this.stopActivePreview();
  }

  public async runCommand(command: PluginCommand, config: PublisherConfig): Promise<PluginCommandResult> {
    switch (command) {
      case "issues":
        return this.withEphemeralRuntime(async (runtime) => this.runIssuesCommand(runtime.orchestrator, config));
      case "build":
        return this.withEphemeralRuntime(async (runtime) => this.runBuildCommand(runtime.orchestrator, config));
      case "preview":
        return this.runPreviewCommand(config);
      case "publish":
        return this.withEphemeralRuntime(async (runtime) => this.runPublishCommand(runtime.orchestrator, config));
    }
  }

  private async runIssuesCommand(
    orchestrator: PluginOrchestrator,
    config: PublisherConfig
  ): Promise<Extract<PluginCommandResult, { command: "issues" }>> {
    const report = await orchestrator.scan(config);
    const statusMessage = createIssuesStatusMessage(report.issues.length);

    this.updateState({
      lastCommand: "issues",
      statusMessage,
      lastManifest: report.manifest,
      lastIssues: report.issues,
      lastLogs: [],
      lastBuildResult: undefined,
      lastPreviewSession: undefined,
      lastDeployResult: undefined
    });

    return {
      command: "issues",
      manifest: report.manifest,
      issues: report.issues,
      statusMessage
    };
  }

  private async runBuildCommand(
    orchestrator: PluginOrchestrator,
    config: PublisherConfig
  ): Promise<Extract<PluginCommandResult, { command: "build" }>> {
    const result = await orchestrator.build(config);
    const statusMessage = result.success ? "Build completed successfully." : "Build failed. Check issues and logs.";

    this.updateState({
      lastCommand: "build",
      statusMessage,
      lastIssues: result.issues,
      lastLogs: result.logs,
      lastBuildResult: result,
      lastPreviewSession: undefined,
      lastDeployResult: undefined
    });

    return {
      command: "build",
      result,
      statusMessage
    };
  }

  private async runPreviewCommand(config: PublisherConfig): Promise<Extract<PluginCommandResult, { command: "preview" }>> {
    await this.stopActivePreview();

    const runtime = this.createRuntime();

    try {
      const session = await runtime.orchestrator.preview(config);
      const statusMessage = `Preview ready at ${session.url}`;

      this.activePreviewRuntime = runtime;
      this.updateState({
        lastCommand: "preview",
        statusMessage,
        lastIssues: this.state.lastIssues,
        lastLogs: [],
        lastBuildResult: undefined,
        lastPreviewSession: session,
        lastDeployResult: undefined
      });

      return {
        command: "preview",
        session,
        statusMessage
      };
    } catch (error) {
      await runtime.stop();
      throw error;
    }
  }

  private async runPublishCommand(
    orchestrator: PluginOrchestrator,
    config: PublisherConfig
  ): Promise<Extract<PluginCommandResult, { command: "publish" }>> {
    const build = await orchestrator.build(config);

    if (!build.success) {
      const statusMessage = "Publish stopped because build did not succeed.";

      this.updateState({
        lastCommand: "publish",
        statusMessage,
        lastIssues: build.issues,
        lastLogs: build.logs,
        lastBuildResult: build,
        lastPreviewSession: undefined,
        lastDeployResult: undefined
      });

      return {
        command: "publish",
        build,
        statusMessage
      };
    }

    const deploy = await orchestrator.deployFromBuild(build, config);
    const statusMessage = deploy.success ? "Publish completed successfully." : "Deploy failed after a successful build.";

    this.updateState({
      lastCommand: "publish",
      statusMessage,
      lastIssues: build.issues,
      lastLogs: build.logs,
      lastBuildResult: build,
      lastPreviewSession: undefined,
      lastDeployResult: deploy
    });

    return {
      command: "publish",
      build,
      deploy,
      statusMessage
    };
  }

  private updateState(nextState: Partial<PluginExecutionState>): void {
    this.state = {
      ...this.state,
      ...nextState,
      lastUpdatedAt: new Date().toISOString(),
      lastIssues: nextState.lastIssues ?? this.state.lastIssues,
      lastLogs: nextState.lastLogs ?? this.state.lastLogs
    };
  }

  private async withEphemeralRuntime<T>(callback: (runtime: PluginRuntime) => Promise<T>): Promise<T> {
    const runtime = this.createRuntime();

    try {
      return await callback(runtime);
    } finally {
      await runtime.stop();
    }
  }

  private async stopActivePreview(): Promise<void> {
    if (this.activePreviewRuntime === undefined) {
      return;
    }

    await this.activePreviewRuntime.stop();
    this.activePreviewRuntime = undefined;
  }
}

function createCommandDefinition(command: PluginCommand, name: string): PluginCommandDefinition {
  return {
    id: `osp:${command}`,
    name,
    command
  };
}

function createIssuesStatusMessage(issueCount: number): string {
  if (issueCount === 0) {
    return "No publish issues detected.";
  }

  return `Found ${issueCount} publish issue(s).`;
}
