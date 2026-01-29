import { TabRegistry, type TabDefinition } from './services/tabRegistry';

type PluginModule = {
    tabDefinition?: TabDefinition;
};

const pluginModules = import.meta.glob('./plugins/**/index.ts', { eager: true }) as Record<string, PluginModule>;

Object.values(pluginModules).forEach((module) => {
    if (module.tabDefinition) {
        TabRegistry.register(module.tabDefinition);
    }
});

console.log('Tabs registered:', TabRegistry.getAll().map(t => t.type));
