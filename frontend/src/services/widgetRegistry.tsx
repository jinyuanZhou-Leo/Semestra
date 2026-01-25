import React from 'react';

export interface WidgetProps {
    widgetId: string;
    settings: any;
    semesterId?: string;
    courseId?: string;
    updateSettings: (newSettings: any) => Promise<void>;
    setIsSaving: (isSaving: boolean) => void;
    title?: string;
    pluginName?: string;
    updateCourseField?: (field: string, value: any) => void;
}

export interface WidgetDefinition {
    type: string;
    name: string;
    description?: string;
    icon?: string;
    component: React.FC<WidgetProps>;
    defaultSettings?: any;
    defaultLayout?: { w: number, h: number, minW?: number, minH?: number };
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
