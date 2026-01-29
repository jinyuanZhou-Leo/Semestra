import { WidgetRegistry, type WidgetDefinition } from './services/widgetRegistry';

type PluginModule = {
    widgetDefinition?: WidgetDefinition;
};

const pluginModules = import.meta.glob('./plugins/**/index.ts', { eager: true }) as Record<string, PluginModule>;

Object.values(pluginModules).forEach((module) => {
    if (module.widgetDefinition) {
        WidgetRegistry.register(module.widgetDefinition);
    }
});

console.log('Widgets registered:', WidgetRegistry.getAll().map(w => w.type));
