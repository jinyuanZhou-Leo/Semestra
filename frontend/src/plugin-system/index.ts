// input:  [descriptor-backed plugin modules via `import.meta.glob`, validated setup registry facade, tab/widget registries, settings registry, internal catalog/load-state/runtime-loader helpers, and Vite HMR updates]
// output: [plugin facade helpers for runtime loading, tab/widget catalogs, setup-registry access, load state, metadata resolution, ownership lookups, and idle background preloading, plus curated re-exports from stable public surfaces]
// pos:    [Central plugin loader and facade core that discovers descriptor-backed plugin.ts entries, applies private host policy, builds runtime catalogs, and registers lazy plugin runtimes]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useSyncExternalStore } from 'react';
import type { FC } from 'react';

import hostPolicyJson from '@/plugins/host-policy.json';
import type { PluginDefinition, PluginDescriptor, PluginDescriptorTabDefinition, PluginDescriptorWidgetDefinition } from '@/plugin-sdk';
import { PluginSettingsRegistry } from '../services/pluginSettingsRegistry';
import type { TabContext, TabProps, TabSettingsProps } from '../services/tabRegistry';
import { TabRegistry } from '../services/tabRegistry';
import type { WidgetContext, WidgetProps, WidgetSettingsProps } from '../services/widgetRegistry';
import { WidgetRegistry } from '../services/widgetRegistry';
import {
  getAllPluginSetupDefinitions,
  getPluginSetupDefinitionById,
  hasPluginSetupDefinition,
  initSetupRegistry,
} from './setupRegistry';
import {
  buildPluginCatalogIndex,
  canAddTabCatalogItem,
  canAddWidgetCatalogItem,
  getPublicPluginManifest,
  getTabCatalogItems,
  getWidgetCatalogItems,
  resolveCatalogMetadata,
} from './pluginCatalog';
import {
  cancelBrowserIdleTask,
  createPluginLoadStateStore,
  IDLE_LOAD_STATE,
  scheduleBrowserIdleTask,
  type IdleTaskHandle,
  type PluginLoadState,
} from './pluginLoadState';
import {
  createPluginEntry,
  registerEntryRuntime,
  unregisterEntryRuntime,
  validateRuntimeDefinition,
  type PluginEntry,
} from './pluginRuntimeLoader';
import { resolvePluginIcon } from './iconResolver';
import type {
  PluginKind,
  PluginManifestItem,
  PluginManifestVisibility,
  ResolvedPluginMetadata,
  TabCatalogItem,
  WidgetCatalogItem,
  WidgetLayoutDefinition,
} from './types';
export type { PluginManifestItem, ResolvedPluginMetadata, TabCatalogItem, WidgetCatalogItem } from './types';
export * from './public-types';
export * from './tabSettingsMeta';
export * from './setup';
export * from './pluginSettingsFields';
export * from './host-api';
export { PluginSettingsSectionRenderer, getPluginSettingsSections, usePluginSettingsRegistry } from './settings-sections';
export { PluginSettingsSectionsGroup } from './PluginSettingsSectionsGroup';
export type { PluginActivationMeta } from './PluginSettingsSectionsGroup';
export type { PluginLoadState, PluginLoadStatus } from './pluginLoadState';

type PluginModule = {
  default?: PluginDefinition;
};

const pluginModules = import.meta.glob('../plugins/*/plugin.ts', { eager: true }) as Record<string, PluginModule>;
const runtimeHmrModulePaths = Object.keys(
  import.meta.glob('../plugins/*/**/*.{ts,tsx}')
).filter((path) => {
  if (path.endsWith('.test.tsx') || path.endsWith('.test.ts') || path.endsWith('.spec.tsx') || path.endsWith('.spec.ts')) {
    return false;
  }
  return !path.endsWith('/plugin.ts');
});

const pluginModulePaths = Object.keys(pluginModules);
const isDev = import.meta.env.DEV;
const loadStateStore = createPluginLoadStateStore();

// Initialize setup registry from the shared modules (P-15: eliminate duplicate import.meta.glob)
initSetupRegistry(pluginModules);

type HostPolicyRecord = {
  kind?: PluginKind;
  visibility?: PluginManifestVisibility;
};

const hostPolicyByPluginId = hostPolicyJson as Record<string, HostPolicyRecord>;

const getDirectoryName = (path: string): string | null => {
  const match = path.match(/^\.\.\/plugins\/([^/]+)\/plugin\.ts$/);
  return match?.[1] ?? null;
};

const toError = (error: unknown) => error instanceof Error ? error : new Error(String(error));

const failValidation = (message: string) => {
  console.error(message);
  if (isDev) {
    // Log as a group for visibility in dev tools without crashing the app.
    // Callers already skip invalid plugins gracefully.
    console.trace('[plugin-system] Stack trace for validation failure above');
  }
};

const resolveHostPolicy = (pluginId: string): Required<HostPolicyRecord> => {
  const hostPolicy = hostPolicyByPluginId[pluginId];
  return {
    kind: hostPolicy?.kind ?? 'external',
    visibility: hostPolicy?.visibility ?? 'public',
  };
};

const toManifestItem = (descriptor: PluginDescriptor): PluginManifestItem => {
  const policy = resolveHostPolicy(descriptor.id);
  return {
    pluginId: descriptor.id,
    displayName: descriptor.display_name,
    author: descriptor.author,
    description: descriptor.description,
    longDescription: descriptor.long_description,
    kind: policy.kind,
    visibility: policy.visibility,
    icon: resolvePluginIcon(descriptor.icon) ?? null,
  };
};

const toTabCatalogItem = (
  descriptor: PluginDescriptor,
  tabDefinition: PluginDescriptorTabDefinition,
): TabCatalogItem => ({
  pluginId: descriptor.id,
  type: tabDefinition.type,
  name: tabDefinition.title,
  description: tabDefinition.description,
  icon: resolvePluginIcon(tabDefinition.icon ?? descriptor.icon),
  allowedContexts: [...tabDefinition.contexts],
});

const toWidgetCatalogItem = (
  descriptor: PluginDescriptor,
  widgetDefinition: PluginDescriptorWidgetDefinition,
): WidgetCatalogItem => ({
  pluginId: descriptor.id,
  type: widgetDefinition.type,
  name: widgetDefinition.title,
  description: widgetDefinition.description,
  icon: resolvePluginIcon(widgetDefinition.icon ?? descriptor.icon),
  allowedContexts: [...widgetDefinition.contexts],
  layout: widgetDefinition.layout ? { ...widgetDefinition.layout } : undefined,
  maxInstances: widgetDefinition.max_instances,
});

const validateSettingsSectionBindings = (definition: PluginDefinition) => {
  const declaredSectionIds = new Set((definition.descriptor.settings?.panels ?? []).map((section) => section.id));
  const settingsSections = definition.settingsSections ?? [];
  settingsSections.forEach((section) => {
    if (!declaredSectionIds.has(section.id)) {
      throw new Error(
        `[plugin-system] Settings section "${section.id}" in plugin "${definition.descriptor.id}" is missing from plugin.ts descriptor.settings.panels.`
      );
    }
  });
};

const rawEntries = pluginModulePaths.map((path) => {
  const definition = pluginModules[path]?.default;
  const directoryName = getDirectoryName(path);
  if (!definition || !directoryName) {
    failValidation(`[plugin-system] Invalid plugin module: ${path}`);
    return null;
  }

  try {
    validateSettingsSectionBindings(definition);
  } catch (error) {
    failValidation(error instanceof Error ? error.message : String(error));
    return null;
  }

  return createPluginEntry(
    toManifestItem(definition.descriptor),
    directoryName,
    definition.loadRuntime,
    (definition.descriptor.tabs ?? []).map((tabDefinition) => toTabCatalogItem(definition.descriptor, tabDefinition)),
    (definition.descriptor.widgets ?? []).map((widgetDefinition) => toWidgetCatalogItem(definition.descriptor, widgetDefinition)),
  );
}).filter((entry): entry is PluginEntry => entry !== null);

const acceptedPluginIds = new Set<string>();
const acceptedTabTypes = new Map<string, string>();
const acceptedWidgetTypes = new Map<string, string>();

const pluginEntries = rawEntries.filter((entry) => {
  const errors: string[] = [];

  if (acceptedPluginIds.has(entry.id)) {
    errors.push(`Duplicate pluginId "${entry.id}"`);
  }

  const ownTabTypes = new Set<string>();
  entry.tabCatalog.forEach((item) => {
    if (item.pluginId !== entry.id) {
      errors.push(`Tab catalog item "${item.type}" has mismatched pluginId "${item.pluginId}"`);
    }
    if (ownTabTypes.has(item.type)) {
      errors.push(`Duplicate tab type "${item.type}" inside plugin "${entry.id}"`);
      return;
    }
    ownTabTypes.add(item.type);

    const existingOwner = acceptedTabTypes.get(item.type);
    if (existingOwner) {
      errors.push(`Duplicate tab type "${item.type}" already owned by "${existingOwner}"`);
    }
  });

  const ownWidgetTypes = new Set<string>();
  entry.widgetCatalog.forEach((item) => {
    if (item.pluginId !== entry.id) {
      errors.push(`Widget catalog item "${item.type}" has mismatched pluginId "${item.pluginId}"`);
    }
    if (ownWidgetTypes.has(item.type)) {
      errors.push(`Duplicate widget type "${item.type}" inside plugin "${entry.id}"`);
      return;
    }
    ownWidgetTypes.add(item.type);

    const existingOwner = acceptedWidgetTypes.get(item.type);
    if (existingOwner) {
      errors.push(`Duplicate widget type "${item.type}" already owned by "${existingOwner}"`);
    }
  });

  if (errors.length > 0) {
    failValidation(`[plugin-system] Invalid plugin "${entry.id}": ${errors.join('; ')}`);
    return false;
  }

  acceptedPluginIds.add(entry.id);
  ownTabTypes.forEach((type) => acceptedTabTypes.set(type, entry.id));
  ownWidgetTypes.forEach((type) => acceptedWidgetTypes.set(type, entry.id));
  return true;
});

const pluginsById = new Map(pluginEntries.map((entry) => [entry.id, entry]));
const pluginsByDirectoryName = new Map(pluginEntries.map((entry) => [entry.directoryName, entry]));
const {
  pluginManifestById,
  tabTypeToPluginId,
  widgetTypeToPluginId,
  tabCatalogByType,
  widgetCatalogByType,
} = buildPluginCatalogIndex(pluginEntries);

pluginModulePaths.forEach((path) => {
  const definition = pluginModules[path]?.default;
  const directoryName = getDirectoryName(path);
  const entry = directoryName ? pluginsByDirectoryName.get(directoryName) : undefined;
  if (!definition || !entry) {
    return;
  }
  PluginSettingsRegistry.registerPluginSettingsMany(entry.id, definition.settingsSections ?? []);
});

const loadPluginEntry = async (entry: PluginEntry): Promise<boolean> => {
  if (entry.loadState.status === 'loaded') {
    return true;
  }
  if (entry.loadPromise) {
    return entry.loadPromise;
  }

  entry.loadState = { status: 'loading', error: null };
  loadStateStore.notify();

  entry.loadPromise = entry.loader()
    .then((runtime) => {
      const validatedRuntime = validateRuntimeDefinition(entry, runtime);
      registerEntryRuntime(entry, validatedRuntime);
      entry.loadState = { status: 'loaded', error: null };
      return true;
    })
    .catch((error) => {
      unregisterEntryRuntime(entry);
      entry.loadState = { status: 'error', error: toError(error) };
      console.error(`[plugin-system] Failed to load plugin: ${entry.id}`, error);
      return false;
    })
    .finally(() => {
      entry.loadPromise = null;
      loadStateStore.notify();
    });

  return entry.loadPromise;
};

const forceReloadPluginEntry = async (entry: PluginEntry) => {
  entry.loadState = { status: 'idle', error: null };
  entry.loadPromise = null;
  loadStateStore.notify();
  return loadPluginEntry(entry);
};

const disposePluginEntry = (entry: PluginEntry) => {
  unregisterEntryRuntime(entry);
  PluginSettingsRegistry.registerPluginSettingsMany(entry.id, []);
};

const disposePluginSystemState = () => {
  pluginEntries.forEach(disposePluginEntry);
};

const getLoadStateByPluginId = (pluginId?: string): PluginLoadState => {
  if (!pluginId) {
    return IDLE_LOAD_STATE;
  }
  return pluginsById.get(pluginId)?.loadState ?? IDLE_LOAD_STATE;
};

export const getTabPluginLoadState = (type: string): PluginLoadState => {
  return getLoadStateByPluginId(tabTypeToPluginId.get(type));
};

export const getWidgetPluginLoadState = (type: string): PluginLoadState => {
  return getLoadStateByPluginId(widgetTypeToPluginId.get(type));
};

export const useTabPluginLoadState = (type?: string): PluginLoadState => useSyncExternalStore(
  (listener) => loadStateStore.subscribe(listener),
  () => (type ? getTabPluginLoadState(type) : IDLE_LOAD_STATE),
  () => (type ? getTabPluginLoadState(type) : IDLE_LOAD_STATE),
);

export const useWidgetPluginLoadState = (type?: string): PluginLoadState => useSyncExternalStore(
  (listener) => loadStateStore.subscribe(listener),
  () => (type ? getWidgetPluginLoadState(type) : IDLE_LOAD_STATE),
  () => (type ? getWidgetPluginLoadState(type) : IDLE_LOAD_STATE),
);

export const usePluginLoadStateVersion = (): number => useSyncExternalStore(
  (listener) => loadStateStore.subscribe(listener),
  () => loadStateStore.getVersion(),
  () => loadStateStore.getVersion(),
);

export const hasTabPluginForType = (type: string) => tabTypeToPluginId.has(type);

export const hasWidgetPluginForType = (type: string) => widgetTypeToPluginId.has(type);

export const ensureTabPluginByTypeLoaded = async (type: string): Promise<boolean> => {
  const pluginId = tabTypeToPluginId.get(type);
  if (!pluginId) {
    return false;
  }
  const entry = pluginsById.get(pluginId);
  return entry ? loadPluginEntry(entry) : false;
};

export const ensureWidgetPluginByTypeLoaded = async (type: string): Promise<boolean> => {
  const pluginId = widgetTypeToPluginId.get(type);
  if (!pluginId) {
    return false;
  }
  const entry = pluginsById.get(pluginId);
  return entry ? loadPluginEntry(entry) : false;
};

export const preloadRemainingPluginsWhenIdle = (): (() => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  let cancelled = false;
  let idleHandle: IdleTaskHandle | null = null;
  let cleanupLoadListener: (() => void) | null = null;

  const scheduleNext = () => {
    if (cancelled) {
      return;
    }

    const nextEntry = pluginEntries.find((entry) => entry.loadState.status === 'idle');
    if (!nextEntry) {
      return;
    }

    idleHandle = scheduleBrowserIdleTask(() => {
      idleHandle = null;
      if (cancelled) {
        return;
      }

      void loadPluginEntry(nextEntry)
        .catch((error) => {
          console.error(`[plugin-system] Failed to preload plugin while idle: ${nextEntry.id}`, error);
        })
        .finally(() => {
          scheduleNext();
        });
    });
  };

  const start = () => {
    if (!cancelled) {
      scheduleNext();
    }
  };

  if (document.readyState === 'complete') {
    start();
  } else {
    const onLoad = () => {
      cleanupLoadListener?.();
      start();
    };
    window.addEventListener('load', onLoad, { once: true });
    cleanupLoadListener = () => {
      window.removeEventListener('load', onLoad);
      cleanupLoadListener = null;
    };
  }

  return () => {
    cancelled = true;
    if (idleHandle !== null) {
      cancelBrowserIdleTask(idleHandle);
      idleHandle = null;
    }
    cleanupLoadListener?.();
  };
};

export const getTabCatalog = (context?: TabContext): TabCatalogItem[] => getTabCatalogItems(pluginEntries, context);

export const getPluginManifest = (): PluginManifestItem[] => getPublicPluginManifest(pluginEntries);

export const getPluginManifestItemById = (pluginId: string): PluginManifestItem | undefined => pluginManifestById.get(pluginId);

export const getPluginIconById = (pluginId: string) => getPluginManifestItemById(pluginId)?.icon;

export const getWidgetCatalog = (context?: WidgetContext): WidgetCatalogItem[] => getWidgetCatalogItems(pluginEntries, context);

export const getTabCatalogItemByType = (type: string) => tabCatalogByType.get(type);

export const getWidgetCatalogItemByType = (type: string) => widgetCatalogByType.get(type);

export const getPluginIdByTabType = (type: string) => tabTypeToPluginId.get(type);

export const getPluginIdByWidgetType = (type: string) => widgetTypeToPluginId.get(type);

export const getResolvedTabMetadataByType = (type: string): ResolvedPluginMetadata => resolveCatalogMetadata(getTabCatalogItemByType(type));

export const getResolvedWidgetMetadataByType = (type: string): ResolvedPluginMetadata => resolveCatalogMetadata(getWidgetCatalogItemByType(type));

export const getResolvedWidgetLayoutByType = (type: string): WidgetLayoutDefinition | undefined => getWidgetCatalogItemByType(type)?.layout;

export { canAddTabCatalogItem, canAddWidgetCatalogItem };

export const getTabComponentByType = (type: string): FC<TabProps> | undefined => TabRegistry.getComponent(type);

export const getWidgetComponentByType = (type: string): FC<WidgetProps> | undefined => WidgetRegistry.getComponent(type);

export const getTabSettingsComponentByType = (type: string): FC<TabSettingsProps> | undefined => TabRegistry.get(type)?.SettingsComponent;

export const getWidgetSettingsComponentByType = (type: string): FC<WidgetSettingsProps> | undefined => WidgetRegistry.get(type)?.SettingsComponent;

export const getWidgetDefinitionByType = (type: string) => WidgetRegistry.get(type);

const getPluginDirectoryFromRuntimePath = (path: string): string | null => {
  const match = path.match(/^\.\.\/plugins\/([^/]+)\//);
  return match?.[1] ?? null;
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposePluginSystemState();
  });

  import.meta.hot.accept(runtimeHmrModulePaths, (updatedModules) => {
    const affectedEntries = new Set<PluginEntry>();
    runtimeHmrModulePaths.forEach((path, index) => {
      if (!updatedModules[index]) {
        return;
      }
      const directoryName = getPluginDirectoryFromRuntimePath(path);
      if (!directoryName) {
        return;
      }
      const entry = pluginsByDirectoryName.get(directoryName);
      if (!entry) {
        return;
      }
      affectedEntries.add(entry);
    });

    affectedEntries.forEach((entry) => {
      void forceReloadPluginEntry(entry).catch((error) => {
        console.error(`[plugin-system] Failed to hot-reload plugin runtime: ${entry.id}`, error);
      });
    });
  });

  import.meta.hot.accept(pluginModulePaths, () => {
    import.meta.hot?.invalidate('[plugin-system] plugin definition changed');
  });
}

export {
  getAllPluginSetupDefinitions,
  getPluginSetupDefinitionById,
  hasPluginSetupDefinition,
};
