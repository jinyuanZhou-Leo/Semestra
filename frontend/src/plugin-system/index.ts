// input:  [plugin metadata/settings/runtime modules via `import.meta.glob`, tab/widget registries, Vite HMR updates]
// output: [plugin catalog accessors, metadata resolvers, `ensure*PluginByTypeLoaded` helpers, and dev hot-reload registration]
// pos:    [Core plugin orchestration module that registers runtime definitions on demand and refreshes plugin definitions during HMR]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { TabContext, TabDefinition } from '../services/tabRegistry';
import { TabRegistry } from '../services/tabRegistry';
import type { WidgetContext, WidgetDefinition } from '../services/widgetRegistry';
import { WidgetRegistry } from '../services/widgetRegistry';
import {
    PluginSettingsRegistry,
    type TabSettingsDefinition,
    type WidgetGlobalSettingsDefinition,
} from '../services/pluginSettingsRegistry';
import type { ResolvedPluginMetadata, TabCatalogItem, WidgetCatalogItem } from './types';
import {
    isUnlimitedInstances,
    DEFAULT_TAB_ALLOWED_CONTEXTS,
    DEFAULT_WIDGET_ALLOWED_CONTEXTS,
} from './utils';

export type { ResolvedPluginMetadata, TabCatalogItem, WidgetCatalogItem } from './types';

type PluginModule = {
    tabDefinition?: TabDefinition;
    tabDefinitions?: TabDefinition[];
    widgetDefinition?: WidgetDefinition;
    widgetDefinitions?: WidgetDefinition[];
};

interface PluginEntry {
    id: string;
    directoryName: string;
    loader: () => Promise<PluginModule>;
    tabCatalog: TabCatalogItem[];
    widgetCatalog: WidgetCatalogItem[];
    loaded: boolean;
    loadPromise: Promise<void> | null;
    error: Error | null;
}

interface PluginMetadataModule {
    pluginId: string;
    tabCatalog?: TabCatalogItem[];
    widgetCatalog?: WidgetCatalogItem[];
}

interface PluginSettingsModule {
    tabSettingsDefinitions?: TabSettingsDefinition[];
    widgetGlobalSettingsDefinitions?: WidgetGlobalSettingsDefinition[];
}

const createPluginEntry = (entry: Omit<PluginEntry, 'loaded' | 'loadPromise' | 'error'>): PluginEntry => ({
    ...entry,
    loaded: false,
    loadPromise: null,
    error: null,
});

// Eagerly load lightweight metadata so names/icons are available before runtime modules are loaded.
const metadataModules = import.meta.glob('../plugins/*/metadata.ts', { eager: true }) as Record<string, unknown>;
// Eagerly load plugin settings modules so settings panels are available without loading runtime UI modules.
const settingsModules = {
    ...import.meta.glob('../plugins/*/settings.ts', { eager: true }),
    ...import.meta.glob('../plugins/*/settings.tsx', { eager: true }),
} as Record<string, unknown>;
// Keep plugin runtime code lazy and load it only when a plugin is actually needed.
const pluginLoaders = import.meta.glob('../plugins/*/index.ts') as Record<string, () => Promise<PluginModule>>;

const getPluginDirectoryName = (path: string): string | null => {
    const match = path.match(/^\.\.\/plugins\/([^/]+)\/metadata\.ts$/);
    return match?.[1] ?? null;
};

const asPluginMetadataModule = (value: unknown): PluginMetadataModule | null => {
    if (!value || typeof value !== 'object') return null;
    const module = value as Partial<PluginMetadataModule>;
    if (typeof module.pluginId !== 'string' || !module.pluginId) return null;
    return {
        pluginId: module.pluginId,
        tabCatalog: Array.isArray(module.tabCatalog) ? module.tabCatalog : [],
        widgetCatalog: Array.isArray(module.widgetCatalog) ? module.widgetCatalog : [],
    };
};

const asPluginSettingsModule = (value: unknown): PluginSettingsModule => {
    if (!value || typeof value !== 'object') return {};
    const module = value as Partial<PluginSettingsModule>;
    return {
        tabSettingsDefinitions: Array.isArray(module.tabSettingsDefinitions) ? module.tabSettingsDefinitions : [],
        widgetGlobalSettingsDefinitions: Array.isArray(module.widgetGlobalSettingsDefinitions)
            ? module.widgetGlobalSettingsDefinitions
            : [],
    };
};

const pluginEntries: PluginEntry[] = Object.entries(metadataModules)
    .map(([metadataPath, moduleValue]) => {
        const metadata = asPluginMetadataModule(moduleValue);
        const directoryName = getPluginDirectoryName(metadataPath);
        if (!metadata || !directoryName) {
            console.warn('[plugin-system] Ignored invalid metadata module:', metadataPath);
            return null;
        }

        const loaderPath = `../plugins/${directoryName}/index.ts`;
        const loader = pluginLoaders[loaderPath];
        if (!loader) {
            console.warn('[plugin-system] Missing runtime index module for plugin:', metadata.pluginId);
            return null;
        }

        return createPluginEntry({
            id: metadata.pluginId,
            directoryName,
            loader,
            tabCatalog: metadata.tabCatalog ?? [],
            widgetCatalog: metadata.widgetCatalog ?? [],
        });
    })
    .filter((entry): entry is PluginEntry => entry !== null)
    .sort((a, b) => a.id.localeCompare(b.id));

const LEGACY_HIDDEN_TAB_TYPES = new Set<string>(['builtin-semester-schedule']);
const pluginRuntimeModulePaths = Object.keys(
    import.meta.glob('../plugins/*/**/*.{ts,tsx}')
).filter((path) => !path.endsWith('.test.tsx'));

const pluginsById = new Map(pluginEntries.map((entry) => [entry.id, entry]));
const pluginsByDirectoryName = new Map(pluginEntries.map((entry) => [entry.directoryName, entry]));
const tabTypeToPluginId = new Map<string, string>();
const widgetTypeToPluginId = new Map<string, string>();
const tabCatalogByType = new Map<string, TabCatalogItem>();
const widgetCatalogByType = new Map<string, WidgetCatalogItem>();

pluginEntries.forEach((entry) => {
    entry.tabCatalog.forEach((item) => {
        if (LEGACY_HIDDEN_TAB_TYPES.has(item.type)) return;
        tabTypeToPluginId.set(item.type, entry.id);
        tabCatalogByType.set(item.type, item);
    });
    entry.widgetCatalog.forEach((item) => {
        widgetTypeToPluginId.set(item.type, entry.id);
        widgetCatalogByType.set(item.type, item);
    });
});

Object.values(settingsModules).forEach((moduleValue) => {
    const settingsModule = asPluginSettingsModule(moduleValue);
    if (settingsModule.tabSettingsDefinitions?.length) {
        PluginSettingsRegistry.registerTabSettingsMany(settingsModule.tabSettingsDefinitions);
    }
    if (settingsModule.widgetGlobalSettingsDefinitions?.length) {
        PluginSettingsRegistry.registerWidgetGlobalSettingsMany(settingsModule.widgetGlobalSettingsDefinitions);
    }
});

const registerPluginModule = (module: PluginModule) => {
    if (module.tabDefinition) {
        TabRegistry.register(module.tabDefinition);
    }
    if (module.tabDefinitions?.length) {
        module.tabDefinitions.forEach((definition) => TabRegistry.register(definition));
    }
    if (module.widgetDefinition) {
        WidgetRegistry.register(module.widgetDefinition);
    }
    if (module.widgetDefinitions?.length) {
        module.widgetDefinitions.forEach((definition) => WidgetRegistry.register(definition));
    }
};

const loadPluginEntry = async (entry: PluginEntry): Promise<void> => {
    if (entry.loaded) return;
    if (entry.loadPromise) {
        await entry.loadPromise;
        return;
    }

    entry.loadPromise = entry.loader()
        .then((module) => {
            registerPluginModule(module);
            entry.loaded = true;
            entry.error = null;
        })
        .catch((error) => {
            console.error(`[plugin-system] Failed to load plugin: ${entry.id}`, error);
            entry.error = error instanceof Error ? error : new Error(String(error));
        })
        .finally(() => {
            entry.loadPromise = null;
        });

    await entry.loadPromise;
};

const forceReloadPluginEntry = async (entry: PluginEntry): Promise<void> => {
    entry.loaded = false;
    entry.loadPromise = null;
    await loadPluginEntry(entry);
};

const getPluginDirectoryFromRuntimePath = (path: string): string | null => {
    const match = path.match(/^\.\.\/plugins\/([^/]+)\//);
    return match?.[1] ?? null;
};

if (import.meta.hot) {
    import.meta.hot.accept(pluginRuntimeModulePaths, (updatedModules) => {
        const affectedEntries = new Set<PluginEntry>();
        pluginRuntimeModulePaths.forEach((path, index) => {
            if (!updatedModules[index]) return;
            const directoryName = getPluginDirectoryFromRuntimePath(path);
            if (!directoryName) return;
            const entry = pluginsByDirectoryName.get(directoryName);
            if (!entry) return;
            affectedEntries.add(entry);
        });

        if (!affectedEntries.size) return;

        affectedEntries.forEach((entry) => {
            // Re-register updated plugin runtime so tab/widget style and behavior edits apply immediately in dev.
            void forceReloadPluginEntry(entry).catch((error) => {
                console.error(`[plugin-system] Failed to hot-reload plugin: ${entry.id}`, error);
            });
        });
    });
}

const ensurePluginByIdLoaded = async (pluginId: string): Promise<boolean> => {
    const entry = pluginsById.get(pluginId);
    if (!entry) return false;
    await loadPluginEntry(entry);
    return true;
};


export const hasTabPluginForType = (type: string) => tabTypeToPluginId.has(type);

export const hasWidgetPluginForType = (type: string) => widgetTypeToPluginId.has(type);

export const ensureTabPluginByTypeLoaded = async (type: string): Promise<boolean> => {
    const pluginId = tabTypeToPluginId.get(type);
    if (!pluginId) return false;
    return ensurePluginByIdLoaded(pluginId);
};

export const ensureWidgetPluginByTypeLoaded = async (type: string): Promise<boolean> => {
    const pluginId = widgetTypeToPluginId.get(type);
    if (!pluginId) return false;
    return ensurePluginByIdLoaded(pluginId);
};

export const getTabCatalog = (context?: TabContext): TabCatalogItem[] => {
    const items = pluginEntries
        .flatMap((entry) => entry.tabCatalog)
        .filter((item) => !LEGACY_HIDDEN_TAB_TYPES.has(item.type));
    if (!context) return items;
    return items.filter((item) => (item.allowedContexts ?? DEFAULT_TAB_ALLOWED_CONTEXTS).includes(context));
};

export const getWidgetCatalog = (context?: WidgetContext): WidgetCatalogItem[] => {
    const items = pluginEntries.flatMap((entry) => entry.widgetCatalog);
    if (!context) return items;
    return items.filter((item) => (item.allowedContexts ?? DEFAULT_WIDGET_ALLOWED_CONTEXTS).includes(context));
};

export const getTabCatalogItemByType = (type: string) => {
    if (LEGACY_HIDDEN_TAB_TYPES.has(type)) return undefined;
    return tabCatalogByType.get(type);
};

export const getWidgetCatalogItemByType = (type: string) => widgetCatalogByType.get(type);

export const getResolvedTabMetadataByType = (type: string): ResolvedPluginMetadata => {
    const definition = TabRegistry.get(type);
    const catalogItem = getTabCatalogItemByType(type);
    return {
        name: definition?.name ?? catalogItem?.name,
        description: definition?.description ?? catalogItem?.description,
        icon: definition?.icon ?? catalogItem?.icon,
    };
};

export const getResolvedWidgetMetadataByType = (type: string): ResolvedPluginMetadata => {
    const definition = WidgetRegistry.get(type);
    const catalogItem = getWidgetCatalogItemByType(type);
    return {
        name: definition?.name ?? catalogItem?.name,
        description: definition?.description ?? catalogItem?.description,
        icon: definition?.icon ?? catalogItem?.icon,
    };
};

export const getResolvedWidgetLayoutByType = (type: string): NonNullable<WidgetDefinition['layout']> | undefined => {
    const definition = WidgetRegistry.get(type);
    const catalogItem = getWidgetCatalogItemByType(type);
    return definition?.layout ?? catalogItem?.layout;
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
