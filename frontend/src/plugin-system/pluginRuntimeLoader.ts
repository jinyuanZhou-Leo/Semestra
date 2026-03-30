// input:  [plugin runtime declaration helpers, tab/widget registries, plugin manifest/catalog types, and load-state contracts]
// output: [plugin entry types plus runtime validation/register/unregister helpers]
// pos:    [Internal runtime-loader helper that owns plugin entry shape and keeps runtime registration logic out of the public facade file]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { TabRegistry } from '../services/tabRegistry';
import { WidgetRegistry } from '../services/widgetRegistry';
import { definePluginRuntime, type PluginRuntimeDefinition } from './contracts';
import type { PluginLoadState } from './pluginLoadState';
import type { PluginManifestItem, TabCatalogItem, WidgetCatalogItem } from './types';

export type PluginRuntimeModule = {
  default?: PluginRuntimeDefinition;
};

export interface PluginEntry {
  id: string;
  directoryName: string;
  manifest: PluginManifestItem;
  loader: () => Promise<PluginRuntimeModule>;
  tabCatalog: TabCatalogItem[];
  widgetCatalog: WidgetCatalogItem[];
  loadState: PluginLoadState;
  loadPromise: Promise<boolean> | null;
  registeredTabTypes: Set<string>;
  registeredWidgetTypes: Set<string>;
}

export const createPluginEntry = (
  manifest: PluginManifestItem,
  directoryName: string,
  loader: () => Promise<PluginRuntimeModule>,
  tabCatalog: TabCatalogItem[],
  widgetCatalog: WidgetCatalogItem[],
): PluginEntry => ({
  id: manifest.pluginId,
  directoryName,
  manifest,
  loader,
  tabCatalog,
  widgetCatalog,
  loadState: { status: 'idle', error: null },
  loadPromise: null,
  registeredTabTypes: new Set(),
  registeredWidgetTypes: new Set(),
});

export const validateRuntimeDefinition = (
  entry: PluginEntry,
  runtime: PluginRuntimeDefinition,
): PluginRuntimeDefinition => {
  const normalized = definePluginRuntime(runtime);
  const runtimeTabTypes = normalized.tabDefinitions?.map((definition) => definition.type) ?? [];
  const runtimeWidgetTypes = normalized.widgetDefinitions?.map((definition) => definition.type) ?? [];
  const expectedTabTypes = entry.tabCatalog.map((item) => item.type);
  const expectedWidgetTypes = entry.widgetCatalog.map((item) => item.type);

  const errors: string[] = [];

  runtimeTabTypes.forEach((type) => {
    if (!expectedTabTypes.includes(type)) {
      errors.push(`Runtime tab type "${type}" is missing from metadata`);
    }
  });
  runtimeWidgetTypes.forEach((type) => {
    if (!expectedWidgetTypes.includes(type)) {
      errors.push(`Runtime widget type "${type}" is missing from metadata`);
    }
  });
  expectedTabTypes.forEach((type) => {
    if (!runtimeTabTypes.includes(type)) {
      errors.push(`Metadata tab type "${type}" is missing from runtime`);
    }
  });
  expectedWidgetTypes.forEach((type) => {
    if (!runtimeWidgetTypes.includes(type)) {
      errors.push(`Metadata widget type "${type}" is missing from runtime`);
    }
  });

  if (errors.length > 0) {
    throw new Error(`[plugin-system] Invalid runtime for plugin "${entry.id}": ${errors.join('; ')}`);
  }

  return normalized;
};

export const unregisterEntryRuntime = (entry: PluginEntry) => {
  entry.registeredTabTypes.forEach((type) => TabRegistry.unregister(type));
  entry.registeredWidgetTypes.forEach((type) => WidgetRegistry.unregister(type));
  entry.registeredTabTypes.clear();
  entry.registeredWidgetTypes.clear();
};

export const registerEntryRuntime = (entry: PluginEntry, runtime: PluginRuntimeDefinition) => {
  unregisterEntryRuntime(entry);

  runtime.tabDefinitions?.forEach((definition) => {
    TabRegistry.register(definition);
    entry.registeredTabTypes.add(definition.type);
  });
  runtime.widgetDefinitions?.forEach((definition) => {
    WidgetRegistry.register(definition);
    entry.registeredWidgetTypes.add(definition.type);
  });
};
