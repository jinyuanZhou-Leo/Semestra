// input:  [plugin metadata/settings/runtime modules via `import.meta.glob`, tab/widget registries, settings registry, and Vite HMR updates]
// output: [plugin facade helpers for catalogs, load state, metadata resolution, settings resolution, and lazy runtime registration]
// pos:    [Central plugin manager facade that validates plugin declarations, keeps metadata/settings eager, and loads runtime definitions on demand]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useSyncExternalStore } from 'react';
import type { FC } from 'react';

import type { TabContext, TabProps } from '../services/tabRegistry';
import { TabRegistry } from '../services/tabRegistry';
import type { WidgetContext, WidgetProps, WidgetSettingsProps } from '../services/widgetRegistry';
import { WidgetRegistry } from '../services/widgetRegistry';
import {
    PluginSettingsRegistry,
    type TabSettingsDefinition,
    type WidgetGlobalSettingsDefinition,
} from '../services/pluginSettingsRegistry';
import type {
    PluginMetadataDefinition,
    PluginRuntimeDefinition,
    PluginSettingsDefinition,
} from './contracts';
import {
    definePluginMetadata,
    definePluginRuntime,
    definePluginSettings,
} from './contracts';
import type { ResolvedPluginMetadata, TabCatalogItem, WidgetCatalogItem, WidgetLayoutDefinition } from './types';
import {
    isUnlimitedInstances,
    DEFAULT_TAB_ALLOWED_CONTEXTS,
    DEFAULT_WIDGET_ALLOWED_CONTEXTS,
} from './utils';
export { PluginContentFadeIn, PluginTabSkeleton, PluginWidgetSkeleton } from './PluginLoadSkeleton';

export type { PluginMetadataDefinition, PluginRuntimeDefinition, PluginSettingsDefinition } from './contracts';
export { definePluginMetadata, definePluginRuntime, definePluginSettings } from './contracts';
export type { ResolvedPluginMetadata, TabCatalogItem, WidgetCatalogItem } from './types';

type PluginRuntimeModule = {
    default?: PluginRuntimeDefinition;
};

type PluginMetadataModule = {
    default?: PluginMetadataDefinition;
};

type PluginSettingsModule = {
    default?: PluginSettingsDefinition;
};

export type PluginLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface PluginLoadState {
    status: PluginLoadStatus;
    error: Error | null;
}

interface PluginEntry {
    id: string;
    directoryName: string;
    loader: () => Promise<PluginRuntimeModule>;
    tabCatalog: TabCatalogItem[];
    widgetCatalog: WidgetCatalogItem[];
    loadState: PluginLoadState;
    loadPromise: Promise<boolean> | null;
    registeredTabTypes: Set<string>;
    registeredWidgetTypes: Set<string>;
}

const IDLE_LOAD_STATE: PluginLoadState = { status: 'idle', error: null };

const listeners = new Set<() => void>();

const notifyListeners = () => {
    listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
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
    if (!definition || typeof definition.pluginId !== 'string' || !definition.pluginId) {
        failValidation(`[plugin-system] Invalid metadata module: ${path}`);
        return null;
    }
    return definePluginMetadata(definition);
};

const asSettingsDefinition = (value: PluginSettingsModule | undefined): PluginSettingsDefinition => {
    return definePluginSettings(value?.default ?? {});
};

const createPluginEntry = (
    id: string,
    directoryName: string,
    loader: () => Promise<PluginRuntimeModule>,
    tabCatalog: TabCatalogItem[],
    widgetCatalog: WidgetCatalogItem[]
): PluginEntry => ({
    id,
    directoryName,
    loader,
    tabCatalog,
    widgetCatalog,
    loadState: { status: 'idle', error: null },
    loadPromise: null,
    registeredTabTypes: new Set(),
    registeredWidgetTypes: new Set(),
});

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
        metadata.pluginId,
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
const tabTypeToPluginId = new Map<string, string>();
const widgetTypeToPluginId = new Map<string, string>();
const tabCatalogByType = new Map<string, TabCatalogItem>();
const widgetCatalogByType = new Map<string, WidgetCatalogItem>();

pluginEntries.forEach((entry) => {
    entry.tabCatalog.forEach((item) => {
        tabTypeToPluginId.set(item.type, entry.id);
        tabCatalogByType.set(item.type, item);
    });
    entry.widgetCatalog.forEach((item) => {
        widgetTypeToPluginId.set(item.type, entry.id);
        widgetCatalogByType.set(item.type, item);
    });
});

settingsModulePaths.forEach((path) => {
    const directoryName = getDirectoryName(path, 'settings\\.tsx?');
    const entry = directoryName ? pluginsByDirectoryName.get(directoryName) : undefined;
    if (!entry) return;

    const settings = asSettingsDefinition(settingsModules[path]);
    const invalidTabSetting = settings.tabSettings?.find((definition) => tabTypeToPluginId.get(definition.type) !== entry.id);
    if (invalidTabSetting) {
        failValidation(`[plugin-system] Invalid tab settings type "${invalidTabSetting.type}" in plugin "${entry.id}"`);
        return;
    }
    const invalidWidgetSetting = settings.widgetGlobalSettings?.find((definition) => widgetTypeToPluginId.get(definition.type) !== entry.id);
    if (invalidWidgetSetting) {
        failValidation(`[plugin-system] Invalid widget settings type "${invalidWidgetSetting.type}" in plugin "${entry.id}"`);
        return;
    }

    if (settings.tabSettings?.length) {
        PluginSettingsRegistry.registerTabSettingsMany(settings.tabSettings);
    }
    if (settings.widgetGlobalSettings?.length) {
        PluginSettingsRegistry.registerWidgetGlobalSettingsMany(settings.widgetGlobalSettings);
    }
});

const validateRuntimeDefinition = (entry: PluginEntry, runtime: PluginRuntimeDefinition) => {
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

const unregisterEntryRuntime = (entry: PluginEntry) => {
    entry.registeredTabTypes.forEach((type) => TabRegistry.unregister(type));
    entry.registeredWidgetTypes.forEach((type) => WidgetRegistry.unregister(type));
    entry.registeredTabTypes.clear();
    entry.registeredWidgetTypes.clear();
};

const registerEntryRuntime = (entry: PluginEntry, runtime: PluginRuntimeDefinition) => {
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

const loadPluginEntry = async (entry: PluginEntry): Promise<boolean> => {
    if (entry.loadState.status === 'loaded') return true;
    if (entry.loadPromise) {
        return entry.loadPromise;
    }

    entry.loadState = { status: 'loading', error: null };
    notifyListeners();

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
            notifyListeners();
        });

    return entry.loadPromise;
};

const forceReloadPluginEntry = async (entry: PluginEntry) => {
    entry.loadState = { status: 'idle', error: null };
    entry.loadPromise = null;
    notifyListeners();
    return loadPluginEntry(entry);
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
        (listener) => subscribe(listener),
        () => type ? getTabPluginLoadState(type) : IDLE_LOAD_STATE,
        () => type ? getTabPluginLoadState(type) : IDLE_LOAD_STATE
    );
};

export const useWidgetPluginLoadState = (type?: string): PluginLoadState => {
    return useSyncExternalStore(
        (listener) => subscribe(listener),
        () => type ? getWidgetPluginLoadState(type) : IDLE_LOAD_STATE,
        () => type ? getWidgetPluginLoadState(type) : IDLE_LOAD_STATE
    );
};

export const usePluginTabSettingsRegistry = (): TabSettingsDefinition[] => {
    return useSyncExternalStore(
        (listener) => PluginSettingsRegistry.subscribe(listener),
        () => PluginSettingsRegistry.getAllTabSettingsDefinitions(),
        () => PluginSettingsRegistry.getAllTabSettingsDefinitions()
    );
};

export const usePluginWidgetGlobalSettingsRegistry = (): WidgetGlobalSettingsDefinition[] => {
    return useSyncExternalStore(
        (listener) => PluginSettingsRegistry.subscribe(listener),
        () => PluginSettingsRegistry.getAllWidgetGlobalSettingsDefinitions(),
        () => PluginSettingsRegistry.getAllWidgetGlobalSettingsDefinitions()
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

export const getTabCatalog = (context?: TabContext): TabCatalogItem[] => {
    const items = pluginEntries.flatMap((entry) => entry.tabCatalog);
    if (!context) return items;
    return items.filter((item) => (item.allowedContexts ?? DEFAULT_TAB_ALLOWED_CONTEXTS).includes(context));
};

export const getWidgetCatalog = (context?: WidgetContext): WidgetCatalogItem[] => {
    const items = pluginEntries.flatMap((entry) => entry.widgetCatalog);
    if (!context) return items;
    return items.filter((item) => (item.allowedContexts ?? DEFAULT_WIDGET_ALLOWED_CONTEXTS).includes(context));
};

export const getTabCatalogItemByType = (type: string) => {
    return tabCatalogByType.get(type);
};

export const getWidgetCatalogItemByType = (type: string) => widgetCatalogByType.get(type);

export const getResolvedTabMetadataByType = (type: string): ResolvedPluginMetadata => {
    const catalogItem = getTabCatalogItemByType(type);
    return {
        name: catalogItem?.name,
        description: catalogItem?.description,
        icon: catalogItem?.icon,
    };
};

export const getResolvedWidgetMetadataByType = (type: string): ResolvedPluginMetadata => {
    const catalogItem = getWidgetCatalogItemByType(type);
    return {
        name: catalogItem?.name,
        description: catalogItem?.description,
        icon: catalogItem?.icon,
    };
};

export const getResolvedWidgetLayoutByType = (type: string): WidgetLayoutDefinition | undefined => {
    return getWidgetCatalogItemByType(type)?.layout;
};

export const canAddTabCatalogItem = (
    item: TabCatalogItem,
    context: TabContext,
    currentCount: number
) => {
    const allowedContexts = item.allowedContexts ?? DEFAULT_TAB_ALLOWED_CONTEXTS;
    if (!allowedContexts.includes(context)) return false;
    if (isUnlimitedInstances(item.maxInstances)) return true;
    if (typeof item.maxInstances === 'number') return currentCount < item.maxInstances;
    return true;
};

export const canAddWidgetCatalogItem = (
    item: WidgetCatalogItem,
    context: WidgetContext,
    currentCount: number
) => {
    const allowedContexts = item.allowedContexts ?? DEFAULT_WIDGET_ALLOWED_CONTEXTS;
    if (!allowedContexts.includes(context)) return false;
    if (isUnlimitedInstances(item.maxInstances)) return true;
    if (typeof item.maxInstances === 'number') return currentCount < item.maxInstances;
    return true;
};

export const getTabComponentByType = (type: string): FC<TabProps> | undefined => {
    return TabRegistry.getComponent(type);
};

export const getWidgetComponentByType = (type: string): FC<WidgetProps> | undefined => {
    return WidgetRegistry.getComponent(type);
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
