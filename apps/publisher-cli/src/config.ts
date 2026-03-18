import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { PublisherConfigSchema } from "@osp/shared";
import type { PublisherConfig } from "@osp/shared";

export const supportedCommands = ["scan", "build", "preview", "deploy"] as const;

export type CliCommand = (typeof supportedCommands)[number];

export type CliOptions = {
  configPath?: string;
  vaultRoot?: string;
  json: boolean;
  quartzPackageRoot?: string;
  preferStaticPreview: boolean;
};

export type ParsedCliArguments =
  | {
      kind: "help";
    }
  | {
      kind: "error";
      message: string;
    }
  | {
      kind: "command";
      command: CliCommand;
      options: CliOptions;
    };

export type ResolvedCliConfig = {
  config: PublisherConfig;
  configPath?: string;
};

const configFileCandidates = ["osp.config.json", "publisher.config.json"];
const PartialPublisherConfigSchema = PublisherConfigSchema.partial();
type CliConfigFileInput = {
  [Key in keyof PublisherConfig]?: PublisherConfig[Key] | undefined;
};

export function parseCliArguments(argv: string[]): ParsedCliArguments {
  const [command, ...rest] = argv;

  if (command === undefined || command === "help" || command === "--help") {
    return { kind: "help" };
  }

  if (!supportedCommands.includes(command as CliCommand)) {
    return {
      kind: "error",
      message: `Unknown command: ${command}`
    };
  }

  const options: CliOptions = {
    json: false,
    preferStaticPreview: false
  };

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (token === "--config") {
      const value = rest[index + 1];

      if (value === undefined) {
        return { kind: "error", message: "Missing value for --config." };
      }

      options.configPath = value;
      index += 1;
      continue;
    }

    if (token === "--vault-root") {
      const value = rest[index + 1];

      if (value === undefined) {
        return { kind: "error", message: "Missing value for --vault-root." };
      }

      options.vaultRoot = value;
      index += 1;
      continue;
    }

    if (token === "--json") {
      options.json = true;
      continue;
    }

    if (token === "--quartz-package-root") {
      const value = rest[index + 1];

      if (value === undefined) {
        return { kind: "error", message: "Missing value for --quartz-package-root." };
      }

      options.quartzPackageRoot = value;
      index += 1;
      continue;
    }

    if (token === "--static-preview") {
      options.preferStaticPreview = true;
      continue;
    }

    if (token === "--help") {
      return { kind: "help" };
    }

    return {
      kind: "error",
      message: `Unknown option: ${token}`
    };
  }

  return {
    kind: "command",
    command: command as CliCommand,
    options
  };
}

export async function resolveCliConfig(options: CliOptions, cwd: string): Promise<ResolvedCliConfig> {
  const resolvedConfigPath =
    options.configPath !== undefined ? path.resolve(cwd, options.configPath) : await findExistingConfigPath(cwd);
  const configFileInput = resolvedConfigPath === undefined ? {} : await readConfigFile(resolvedConfigPath);
  const configBaseDir = resolvedConfigPath === undefined ? cwd : path.dirname(resolvedConfigPath);
  const resolvedVaultRoot =
    options.vaultRoot !== undefined
      ? path.resolve(cwd, options.vaultRoot)
      : resolveConfiguredPath(configBaseDir, configFileInput.vaultRoot) ?? cwd;
  const defaultConfig = createDefaultConfig(resolvedVaultRoot);
  const resolvedOutputDir = resolveConfiguredPath(configBaseDir, configFileInput.outputDir);
  const resolvedDeployOutputDir = resolveConfiguredPath(configBaseDir, configFileInput.deployOutputDir);

  const config = PublisherConfigSchema.parse({
    ...defaultConfig,
    ...configFileInput,
    vaultRoot: resolvedVaultRoot,
    ...(resolvedOutputDir === undefined ? {} : { outputDir: resolvedOutputDir }),
    ...(resolvedDeployOutputDir === undefined ? {} : { deployOutputDir: resolvedDeployOutputDir })
  }) as PublisherConfig;

  return {
    config,
    ...(resolvedConfigPath === undefined ? {} : { configPath: resolvedConfigPath })
  };
}

export function createDefaultConfig(vaultRoot: string): PublisherConfig {
  return {
    vaultRoot,
    publishMode: "frontmatter",
    includeGlobs: [],
    excludeGlobs: ["**/.git/**", "**/.obsidian/**", "**/.osp/**", "**/.trash/**", "**/node_modules/**"],
    outputDir: path.join(vaultRoot, ".osp", "dist"),
    builder: "quartz",
    deployTarget: "none",
    enableSearch: true,
    enableBacklinks: true,
    enableGraph: true,
    strictMode: false
  };
}

async function readConfigFile(configPath: string): Promise<CliConfigFileInput> {
  const fileContents = await readFile(configPath, "utf8");
  const parsedJson = JSON.parse(fileContents) as unknown;

  return PartialPublisherConfigSchema.parse(parsedJson) as CliConfigFileInput;
}

async function findExistingConfigPath(cwd: string): Promise<string | undefined> {
  for (const candidate of configFileCandidates) {
    const candidatePath = path.join(cwd, candidate);

    try {
      await access(candidatePath);
      return candidatePath;
    } catch {}
  }

  return undefined;
}

function resolveConfiguredPath(baseDir: string, filePath: string | undefined): string | undefined {
  if (filePath === undefined) {
    return undefined;
  }

  return path.isAbsolute(filePath) ? filePath : path.resolve(baseDir, filePath);
}
