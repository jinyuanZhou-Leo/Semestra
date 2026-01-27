import React from 'react';

export interface WidgetProps {
    widgetId: string;
    settings: any;
    semesterId?: string;
    courseId?: string;
    /**
     * Update widget settings - framework handles debouncing automatically
     * Plugin developers just call this function, no need to implement debouncing
     * Returns void since framework debounces API calls (Optimistic UI pattern)
     */
    updateSettings: (newSettings: any) => void | Promise<void>;
    title?: string;
    pluginName?: string;
    updateCourseField?: (field: string, value: any) => void;
}

export interface WidgetLifecycleContext {
    widgetId: string;
    semesterId?: string;
    courseId?: string;
    settings: any;
}

export interface WidgetDefinition {
    type: string;
    name: string;
    description?: string;
    icon?: string;
    component: React.FC<WidgetProps>;
    defaultSettings?: any;
    defaultLayout?: { w: number, h: number, minW?: number, minH?: number };
    /** Called after widget is created. If throws, the widget will be rolled back (deleted). */
    onCreate?: (context: WidgetLifecycleContext) => Promise<void> | void;
    /** Called after widget is deleted. Errors are logged but don't affect deletion. */
    onDelete?: (context: WidgetLifecycleContext) => Promise<void> | void;
}

class WidgetRegistryClass {
    private widgets: Map<string, WidgetDefinition> = new Map();

    register(definition: WidgetDefinition) {
        if (this.widgets.has(definition.type)) {
            console.warn(`Widget type ${definition.type} is already registered. Overwriting.`);
        }
        this.widgets.set(definition.type, definition);
    }

    get(type: string): WidgetDefinition | undefined {
        return this.widgets.get(type);
    }

    getAll(): WidgetDefinition[] {
        return Array.from(this.widgets.values());
    }

    getComponent(type: string): React.FC<WidgetProps> | undefined {
        return this.widgets.get(type)?.component;
    }
}

export const WidgetRegistry = new WidgetRegistryClass();
