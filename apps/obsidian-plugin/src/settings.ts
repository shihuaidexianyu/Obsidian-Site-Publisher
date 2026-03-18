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

export async function loadPluginSettings(
  store: PluginDataStore,
  shell: PublisherPluginShell,
  vaultRoot: string
): Promise<PublisherPluginSettings> {
  const storedData = (await store.loadData()) as StoredPublisherPluginSettings | null;

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
