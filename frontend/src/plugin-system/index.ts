// input:  [plugin manifests/settings/runtime modules via `import.meta.glob`, validated plugin setup registry facade, tab/widget registries, settings registry, internal catalog/load-state/runtime-loader helpers, and Vite HMR updates]
// output: [plugin facade helpers for runtime loading, contribution catalogs, setup-registry access, load state, metadata resolution, host-reserved catalog filtering, tab/widget ownership lookups, and idle background preloading, plus curated re-exports from thin authoring/host/settings-section/type surfaces]
// pos:    [Central plugin loader and facade core that orchestrates module discovery and HMR while delegating stable public types, catalog indexing, runtime registration, and load-state bookkeeping to narrower internal helpers]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useSyncExternalStore } from 'react';
import type { FC } from 'react';

import type { TabContext, TabProps, TabSettingsProps } from '../services/tabRegistry';
import { TabRegistry } from '../services/tabRegistry';
import type { WidgetContext, WidgetProps, WidgetSettingsProps } from '../services/widgetRegistry';
import { WidgetRegistry } from '../services/widgetRegistry';
import {
    PluginSettingsRegistry,
} from '../services/pluginSettingsRegistry';
import type {
    PluginMetadataDefinition,
    PluginSettingsDefinition,
} from './contracts';
import {
    definePluginMetadata,
    definePluginSettings,
} from './contracts';
export {
    getAllPluginSetupDefinitions,
    getPluginSetupDefinitionById,
    hasPluginSetupDefinition,
} from './setupRegistry';
import {
    buildPluginCatalogIndex,
    canAddTabCatalogItem as canAddTabCatalogItemInternal,
    canAddWidgetCatalogItem as canAddWidgetCatalogItemInternal,
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
    type PluginRuntimeModule,
} from './pluginRuntimeLoader';
import type { PluginManifestItem, ResolvedPluginMetadata, TabCatalogItem, WidgetCatalogItem, WidgetLayoutDefinition } from './types';
export type { PluginManifestItem, ResolvedPluginMetadata, TabCatalogItem, WidgetCatalogItem } from './types';
export * from './authoring';
export * from './host-api';
export * from './public-types';
export * from './settings-sections';
export type { PluginLoadState, PluginLoadStatus } from './pluginLoadState';

type PluginMetadataModule = {
    default?: PluginMetadataDefinition;
};

type PluginSettingsModule = {
    default?: PluginSettingsDefinition;
};

const metadataModules = import.meta.glob('../plugins/*/metadata.ts', { eager: true }) as Record<string, PluginMetadataModule>;
const settingsModules = {
    ...import.meta.glob('../plugins/*/settings.ts', { eager: true }),
    ...import.meta.glob('../plugins/*/settings.tsx', { eager: true }),
} as Record<string, PluginSettingsModule>;
const pluginLoaders = import.meta.glob('../plugins/*/index.ts') as Record<string, () => Promise<PluginRuntimeModule>>;

const metadataModulePaths = Object.keys(metadataModules);
const settingsModulePaths = Object.keys(settingsModules);
const runtimeHmrModulePaths = Object.keys(
    import.meta.glob('../plugins/*/**/*.{ts,tsx}')
).filter((path) => {
    if (path.endsWith('.test.tsx') || path.endsWith('.test.ts') || path.endsWith('.spec.tsx') || path.endsWith('.spec.ts')) {
        return false;
    }
    if (metadataModulePaths.includes(path) || settingsModulePaths.includes(path)) {
        return false;
    }
    return true;
});

const isDev = import.meta.env.DEV;
const loadStateStore = createPluginLoadStateStore();

const getDirectoryName = (path: string, suffixPattern: string): string | null => {
    const match = path.match(new RegExp(`^\\.\\.\\/plugins\\/([^/]+)\\/${suffixPattern}$`));
    return match?.[1] ?? null;
};

const toError = (error: unknown) => error instanceof Error ? error : new Error(String(error));

const failValidation = (message: string) => {
    if (isDev) {
        throw new Error(message);
    }
    console.error(message);
};

const asMetadataDefinition = (value: PluginMetadataModule | undefined, path: string): PluginMetadataDefinition | null => {
    const definition = value?.default;
    if (!definition || typeof definition.pluginId !== 'string' || !definition.pluginId || definition.icon == null) {
        failValidation(`[plugin-system] Invalid metadata module: ${path}`);
        return null;
    }
    return definePluginMetadata(definition);
};

const asSettingsDefinition = (value: PluginSettingsModule | undefined): PluginSettingsDefinition => {
    return definePluginSettings(value?.default ?? {});
};

const rawEntries = metadataModulePaths.map((path) => {
    const metadata = asMetadataDefinition(metadataModules[path], path);
    const directoryName = getDirectoryName(path, 'metadata\\.ts');
    if (!metadata || !directoryName) return null;
    const loaderPath = `../plugins/${directoryName}/index.ts`;
    const loader = pluginLoaders[loaderPath];
    if (!loader) {
        failValidation(`[plugin-system] Missing runtime index module for plugin: ${metadata.pluginId}`);
        return null;
    }
    return createPluginEntry(
        {
            pluginId: metadata.pluginId,
            displayName: metadata.displayName,
            author: metadata.author,
            description: metadata.description,
            longDescription: metadata.longDescription,
            icon: metadata.icon,
        },
        directoryName,
        loader,
        metadata.tabCatalog ?? [],
        metadata.widgetCatalog ?? []
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

settingsModulePaths.forEach((path) => {
    const directoryName = getDirectoryName(path, 'settings\\.tsx?');
    const entry = directoryName ? pluginsByDirectoryName.get(directoryName) : undefined;
    if (!entry) return;

    const settings = asSettingsDefinition(settingsModules[path]);
    const sectionIds = new Set<string>();
    const invalidPluginSetting = settings.pluginSettings?.find((definition) => {
        if (typeof definition.id !== 'string' || definition.id.trim().length === 0) {
            return true;
        }
        if (sectionIds.has(definition.id)) {
            return true;
        }
        sectionIds.add(definition.id);
        return false;
    });
    if (invalidPluginSetting) {
        failValidation(`[plugin-system] Invalid plugin settings section in plugin "${entry.id}"`);
        return;
    }

    if (settings.pluginSettings?.length) {
        PluginSettingsRegistry.registerPluginSettingsMany(entry.id, settings.pluginSettings);
    }
});

const loadPluginEntry = async (entry: PluginEntry): Promise<boolean> => {
    if (entry.loadState.status === 'loaded') return true;
    if (entry.loadPromise) {
        return entry.loadPromise;
    }

    entry.loadState = { status: 'loading', error: null };
    loadStateStore.notify();

    entry.loadPromise = entry.loader()
        .then((module) => {
            const runtime = validateRuntimeDefinition(entry, module.default ?? {});
            registerEntryRuntime(entry, runtime);
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

export const useTabPluginLoadState = (type?: string): PluginLoadState => {
    return useSyncExternalStore(
        (listener) => loadStateStore.subscribe(listener),
        () => type ? getTabPluginLoadState(type) : IDLE_LOAD_STATE,
        () => type ? getTabPluginLoadState(type) : IDLE_LOAD_STATE
    );
};

export const useWidgetPluginLoadState = (type?: string): PluginLoadState => {
    return useSyncExternalStore(
        (listener) => loadStateStore.subscribe(listener),
        () => type ? getWidgetPluginLoadState(type) : IDLE_LOAD_STATE,
        () => type ? getWidgetPluginLoadState(type) : IDLE_LOAD_STATE
    );
};

export const usePluginLoadStateVersion = (): number => {
    return useSyncExternalStore(
        (listener) => loadStateStore.subscribe(listener),
        () => loadStateStore.getVersion(),
        () => loadStateStore.getVersion()
    );
};

export const hasTabPluginForType = (type: string) => tabTypeToPluginId.has(type);

export const hasWidgetPluginForType = (type: string) => widgetTypeToPluginId.has(type);

export const ensureTabPluginByTypeLoaded = async (type: string): Promise<boolean> => {
    const pluginId = tabTypeToPluginId.get(type);
    if (!pluginId) return false;
    const entry = pluginsById.get(pluginId);
    return entry ? loadPluginEntry(entry) : false;
};

export const ensureWidgetPluginByTypeLoaded = async (type: string): Promise<boolean> => {
    const pluginId = widgetTypeToPluginId.get(type);
    if (!pluginId) return false;
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
        if (cancelled) return;

        const nextEntry = pluginEntries.find((entry) => entry.loadState.status === 'idle');
        if (!nextEntry) return;

        idleHandle = scheduleBrowserIdleTask(() => {
            idleHandle = null;
            if (cancelled) return;

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
        if (cancelled) return;
        scheduleNext();
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

export const getTabCatalog = (context?: TabContext): TabCatalogItem[] => {
    return getTabCatalogItems(pluginEntries, context);
};

export const getPluginManifest = (): PluginManifestItem[] => {
    return getPublicPluginManifest(pluginEntries);
};

export const getPluginManifestItemById = (pluginId: string): PluginManifestItem | undefined => {
    return pluginManifestById.get(pluginId);
};

export const getPluginIconById = (pluginId: string) => {
    return getPluginManifestItemById(pluginId)?.icon;
};

export const getWidgetCatalog = (context?: WidgetContext): WidgetCatalogItem[] => {
    return getWidgetCatalogItems(pluginEntries, context);
};

export const getTabCatalogItemByType = (type: string) => {
    return tabCatalogByType.get(type);
};

export const getWidgetCatalogItemByType = (type: string) => widgetCatalogByType.get(type);

export const getPluginIdByTabType = (type: string) => tabTypeToPluginId.get(type);

export const getPluginIdByWidgetType = (type: string) => widgetTypeToPluginId.get(type);

export const getResolvedTabMetadataByType = (type: string): ResolvedPluginMetadata => {
    return resolveCatalogMetadata(getTabCatalogItemByType(type));
};

export const getResolvedWidgetMetadataByType = (type: string): ResolvedPluginMetadata => {
    return resolveCatalogMetadata(getWidgetCatalogItemByType(type));
};

export const getResolvedWidgetLayoutByType = (type: string): WidgetLayoutDefinition | undefined => {
    return getWidgetCatalogItemByType(type)?.layout;
};

export const canAddTabCatalogItem = (
    item: TabCatalogItem,
    context: TabContext,
    currentCount: number
) => {
    return canAddTabCatalogItemInternal(item, context, currentCount);
};

export const canAddWidgetCatalogItem = (
    item: WidgetCatalogItem,
    context: WidgetContext,
    currentCount: number
) => {
    return canAddWidgetCatalogItemInternal(item, context, currentCount);
};

export const getTabComponentByType = (type: string): FC<TabProps> | undefined => {
    return TabRegistry.getComponent(type);
};

export const getWidgetComponentByType = (type: string): FC<WidgetProps> | undefined => {
    return WidgetRegistry.getComponent(type);
};

export const getTabSettingsComponentByType = (type: string): FC<TabSettingsProps> | undefined => {
    return TabRegistry.get(type)?.SettingsComponent;
};

export const getWidgetSettingsComponentByType = (type: string): FC<WidgetSettingsProps> | undefined => {
    return WidgetRegistry.get(type)?.SettingsComponent;
};

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
            if (!updatedModules[index]) return;
            const directoryName = getPluginDirectoryFromRuntimePath(path);
            if (!directoryName) return;
            const entry = pluginsByDirectoryName.get(directoryName);
            if (!entry) return;
            affectedEntries.add(entry);
        });

        affectedEntries.forEach((entry) => {
            void forceReloadPluginEntry(entry).catch((error) => {
                console.error(`[plugin-system] Failed to hot-reload plugin runtime: ${entry.id}`, error);
            });
        });
    });

    const invalidatePluginSystem = () => {
        import.meta.hot?.invalidate('[plugin-system] metadata/settings changed');
    };

    import.meta.hot.accept(metadataModulePaths, invalidatePluginSystem);
    import.meta.hot.accept(settingsModulePaths, invalidatePluginSystem);
}
