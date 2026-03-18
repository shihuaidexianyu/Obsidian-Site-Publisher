import { z } from "zod";

import { PublisherConfigSchema } from "@osp/shared";
import type { PublisherConfig } from "@osp/shared";

import type { PublisherPluginShell } from "./plugin-shell.js";

export type PublisherPluginSettings = {
  config: PublisherConfig;
};

export type StoredPublisherPluginSettings = {
  config?: Partial<PublisherConfig> | undefined;
};

export type PluginDataStore = {
  loadData(): Promise<unknown>;
  saveData(data: unknown): Promise<void>;
};

const PartialPublisherConfigSchema = PublisherConfigSchema.partial();
export const StoredPublisherPluginSettingsSchema = z.object({
  config: PartialPublisherConfigSchema.optional()
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
    }
  };
}

function normalizeStoredPluginSettings(
  storedData: z.output<typeof StoredPublisherPluginSettingsSchema>
): StoredPublisherPluginSettings {
  return {
    config: normalizeConfig(storedData.config)
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
