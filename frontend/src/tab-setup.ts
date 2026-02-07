import { TabRegistry, type TabDefinition } from './services/tabRegistry';

type PluginModule = {
    tabDefinition?: TabDefinition;
    tabDefinitions?: TabDefinition[];
};

// Lazy load plugins - only loaded when actually needed
const pluginModules = import.meta.glob('./plugins/**/index.ts') as Record<string, () => Promise<PluginModule>>;

// Register tabs asynchronously
const initTabs = async () => {
    const loadPromises = Object.entries(pluginModules).map(async ([path, loader]) => {
        try {
            const module = await loader();
            if (module.tabDefinition) {
                TabRegistry.register(module.tabDefinition);
            }
            if (module.tabDefinitions) {
                module.tabDefinitions.forEach((definition) => TabRegistry.register(definition));
            }
        } catch (error) {
            console.error(`Failed to load tab plugin: ${path}`, error);
        }
    });

    await Promise.all(loadPromises);
    console.log('Tabs registered:', TabRegistry.getAll().map(t => t.type));
};

// Export for potential await usage
export const tabsReady = initTabs();
