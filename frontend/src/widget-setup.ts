import { WidgetRegistry, type WidgetDefinition } from './services/widgetRegistry';

type PluginModule = {
    widgetDefinition?: WidgetDefinition;
};

// Lazy load plugins - only loaded when actually needed
const pluginModules = import.meta.glob('./plugins/**/index.ts') as Record<string, () => Promise<PluginModule>>;

// Register widgets asynchronously
const initWidgets = async () => {
    const loadPromises = Object.entries(pluginModules).map(async ([path, loader]) => {
        try {
            const module = await loader();
            if (module.widgetDefinition) {
                WidgetRegistry.register(module.widgetDefinition);
            }
        } catch (error) {
            console.error(`Failed to load widget plugin: ${path}`, error);
        }
    });

    await Promise.all(loadPromises);
    console.log('Widgets registered:', WidgetRegistry.getAll().map(w => w.type));
};

// Export for potential await usage
export const widgetsReady = initWidgets();
