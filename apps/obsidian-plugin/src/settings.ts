import { z } from "zod";

import { PublisherConfigSchema } from "@osp/shared";
import type { PublisherConfig } from "@osp/shared";

import type { PublisherPluginShell } from "./plugin-shell.js";

export type PublisherPluginSettings = {
  config: PublisherConfig;
  cli: PublisherPluginCliSettings;
};

export type PublisherPluginCliSettings = {
  executablePath?: string | undefined;
  logDirectory?: string | undefined;
  previewPort?: number | undefined;
};

export type StoredPublisherPluginSettings = {
  config?: Partial<PublisherConfig> | undefined;
  cli?: PublisherPluginCliSettings | undefined;
};

export type PluginDataStore = {
  loadData(): Promise<unknown>;
  saveData(data: unknown): Promise<void>;
};

const PartialPublisherConfigSchema = PublisherConfigSchema.partial();
const PublisherPluginCliSettingsSchema = z.object({
  executablePath: z.string().optional(),
  logDirectory: z.string().optional(),
  previewPort: z.number().int().positive().optional()
});
export const StoredPublisherPluginSettingsSchema = z.object({
  config: PartialPublisherConfigSchema.optional(),
  cli: PublisherPluginCliSettingsSchema.optional()
});

export async function loadPluginSettings(
  store: PluginDataStore,
  shell: PublisherPluginShell,
  vaultRoot: string
): Promise<PublisherPluginSettings> {
  const parseResult = StoredPublisherPluginSettingsSchema.safeParse(await store.loadData());
  const storedData = parseResult.success ? normalizeStoredPluginSettings(parseResult.data) : undefined;

  return mergePluginSettings(shell, vaultRoot, storedData ?? undefined);
}

export async function savePluginSettings(store: PluginDataStore, settings: PublisherPluginSettings): Promise<void> {
  await store.saveData(settings);
}

export function mergePluginSettings(
  shell: PublisherPluginShell,
  vaultRoot: string,
  storedData?: StoredPublisherPluginSettings
): PublisherPluginSettings {
  const defaultConfig = shell.createInitialConfig(vaultRoot);

  return {
    config: {
      ...defaultConfig,
      ...storedData?.config,
      vaultRoot
    },
    cli: storedData?.cli ?? {}
  };
}

function normalizeStoredPluginSettings(
  storedData: z.output<typeof StoredPublisherPluginSettingsSchema>
): StoredPublisherPluginSettings {
  return {
    config: normalizeConfig(storedData.config),
    cli: normalizeCliSettings(storedData.cli)
  };
}

function normalizeConfig(config: z.output<typeof PartialPublisherConfigSchema> | undefined): Partial<PublisherConfig> | undefined {
  if (config === undefined) {
    return undefined;
  }

  const normalizedConfig = Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== undefined)
  ) as Partial<PublisherConfig>;

  return Object.keys(normalizedConfig).length > 0 ? normalizedConfig : undefined;
}

function normalizeCliSettings(
  settings: z.output<typeof PublisherPluginCliSettingsSchema> | undefined
): PublisherPluginCliSettings | undefined {
  if (settings === undefined) {
    return undefined;
  }

  const normalizedSettings = Object.fromEntries(
    Object.entries(settings).filter(([, value]) => value !== undefined)
  ) as PublisherPluginCliSettings;

  return Object.keys(normalizedSettings).length > 0 ? normalizedSettings : undefined;
}
