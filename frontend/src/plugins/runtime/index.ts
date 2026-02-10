import type { ReactNode } from 'react';
import type { MaxInstances as TabMaxInstances, TabContext, TabDefinition } from '../../services/tabRegistry';
import { TabRegistry } from '../../services/tabRegistry';
import type { MaxInstances as WidgetMaxInstances, WidgetContext, WidgetDefinition } from '../../services/widgetRegistry';
import { WidgetRegistry } from '../../services/widgetRegistry';

type PluginModule = {
    tabDefinition?: TabDefinition;
    tabDefinitions?: TabDefinition[];
    widgetDefinition?: WidgetDefinition;
    widgetDefinitions?: WidgetDefinition[];
};

export interface TabCatalogItem {
    pluginId: string;
    type: string;
    name: string;
    description?: string;
    icon?: ReactNode;
    maxInstances?: TabMaxInstances;
    allowedContexts?: TabContext[];
}

export interface WidgetCatalogItem {
    pluginId: string;
    type: string;
    name: string;
    description?: string;
    icon?: ReactNode;
    maxInstances?: WidgetMaxInstances;
    allowedContexts?: WidgetContext[];
}

interface PluginEntry {
    id: string;
    loader: () => Promise<PluginModule>;
    tabCatalog: TabCatalogItem[];
    widgetCatalog: WidgetCatalogItem[];
    loaded: boolean;
    loadPromise: Promise<void> | null;
}

const pluginEntries: PluginEntry[] = [
    {
        id: 'builtin-dashboard',
        loader: () => import('../builtin-dashboard'),
        tabCatalog: [
            {
                pluginId: 'builtin-dashboard',
                type: 'dashboard',
                name: 'Dashboard',
                description: 'Dashboard overview and widget container',
                icon: 'D',
                maxInstances: 0,
                allowedContexts: ['semester', 'course'],
            },
        ],
        widgetCatalog: [],
        loaded: false,
        loadPromise: null,
    },
    {
        id: 'builtin-settings',
        loader: () => import('../builtin-settings'),
        tabCatalog: [
            {
                pluginId: 'builtin-settings',
                type: 'settings',
                name: 'Settings',
                description: 'Built-in settings tab',
                icon: 'S',
                maxInstances: 0,
                allowedContexts: ['semester', 'course'],
            },
        ],
        widgetCatalog: [],
        loaded: false,
        loadPromise: null,
    },
    {
        id: 'builtin-timetable',
        loader: () => import('../builtin-timetable'),
        tabCatalog: [
            {
                pluginId: 'builtin-timetable',
                type: 'builtin-academic-timetable',
                name: 'Timetable',
                description: 'Academic timetable planner for course and semester schedules',
                icon: 'T',
                maxInstances: 1,
                allowedContexts: ['semester', 'course'],
            },
        ],
        widgetCatalog: [],
        loaded: false,
        loadPromise: null,
    },
    {
        id: 'tab-template',
        loader: () => import('../tab-template'),
        tabCatalog: [
            {
                pluginId: 'tab-template',
                type: 'tab-template',
                name: 'Tab Template',
                description: 'Starter tab with editable settings and layout scaffolding.',
                icon: 'P',
                maxInstances: 'unlimited',
                allowedContexts: ['semester', 'course'],
            },
        ],
        widgetCatalog: [],
        loaded: false,
        loadPromise: null,
    },
    {
        id: 'counter',
        loader: () => import('../counter'),
        tabCatalog: [],
        widgetCatalog: [
            {
                pluginId: 'counter',
                type: 'counter',
                name: 'Counter',
                description: 'A simple counter widget with controls.',
                icon: '#',
                maxInstances: 'unlimited',
                allowedContexts: ['semester', 'course'],
            },
        ],
        loaded: false,
        loadPromise: null,
    },
    {
        id: 'course-list',
        loader: () => import('../course-list'),
        tabCatalog: [],
        widgetCatalog: [
            {
                pluginId: 'course-list',
                type: 'course-list',
                name: 'Course List',
                description: 'Display a list of courses in this semester.',
                icon: 'C',
                maxInstances: 1,
                allowedContexts: ['semester'],
            },
        ],
        loaded: false,
        loadPromise: null,
    },
    {
        id: 'grade-calculator',
        loader: () => import('../grade-calculator'),
        tabCatalog: [],
        widgetCatalog: [
            {
                pluginId: 'grade-calculator',
                type: 'grade-calculator',
                name: 'Grade Calculator',
                description: 'Calculate course grade based on assessment weights.',
                icon: 'G',
                maxInstances: 1,
                allowedContexts: ['course'],
            },
        ],
        loaded: false,
        loadPromise: null,
    },
    {
        id: 'world-clock',
        loader: () => import('../world-clock'),
        tabCatalog: [],
        widgetCatalog: [
            {
                pluginId: 'world-clock',
                type: 'world-clock',
                name: 'World Clock',
                description: 'Displays current time in a specific timezone.',
                icon: 'W',
                maxInstances: 'unlimited',
                allowedContexts: ['semester', 'course'],
            },
        ],
        loaded: false,
        loadPromise: null,
    },
];

const BUILTIN_TAB_PLUGIN_IDS = ['builtin-dashboard', 'builtin-settings', 'builtin-timetable'] as const;
const DEFAULT_TAB_ALLOWED_CONTEXTS: TabContext[] = ['semester', 'course'];
const DEFAULT_WIDGET_ALLOWED_CONTEXTS: WidgetContext[] = ['semester', 'course'];

const pluginsById = new Map(pluginEntries.map((entry) => [entry.id, entry]));
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
        })
        .finally(() => {
            entry.loadPromise = null;
        });

    await entry.loadPromise;
};

const ensurePluginByIdLoaded = async (pluginId: string): Promise<boolean> => {
    const entry = pluginsById.get(pluginId);
    if (!entry) return false;
    await loadPluginEntry(entry);
    return true;
};

const isUnlimitedInstances = (maxInstances?: TabMaxInstances | WidgetMaxInstances) => {
    if (maxInstances === undefined || maxInstances === 'unlimited') return true;
    if (typeof maxInstances === 'number' && !Number.isFinite(maxInstances)) return true;
    return false;
};

export const hasTabPluginForType = (type: string) => tabTypeToPluginId.has(type);

export const hasWidgetPluginForType = (type: string) => widgetTypeToPluginId.has(type);

export const ensureBuiltinTabPluginsLoaded = async () => {
    await Promise.all(BUILTIN_TAB_PLUGIN_IDS.map((pluginId) => ensurePluginByIdLoaded(pluginId)));
};

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
    const items = pluginEntries.flatMap((entry) => entry.tabCatalog);
    if (!context) return items;
    return items.filter((item) => (item.allowedContexts ?? DEFAULT_TAB_ALLOWED_CONTEXTS).includes(context));
};

export const getWidgetCatalog = (context?: WidgetContext): WidgetCatalogItem[] => {
    const items = pluginEntries.flatMap((entry) => entry.widgetCatalog);
    if (!context) return items;
    return items.filter((item) => (item.allowedContexts ?? DEFAULT_WIDGET_ALLOWED_CONTEXTS).includes(context));
};

export const getTabCatalogItemByType = (type: string) => tabCatalogByType.get(type);

export const getWidgetCatalogItemByType = (type: string) => widgetCatalogByType.get(type);

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
