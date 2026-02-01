import React from 'react';

export interface HeaderButtonContext {
    widgetId: string;
    settings: any;
    semesterId?: string;
    courseId?: string;
    updateSettings: (newSettings: any) => void | Promise<void>;
}

export interface HeaderButton {
    id: string;
    icon: React.ReactNode;
    title: string;
    onClick: (context: HeaderButtonContext) => void;
}

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
    updateCourse?: (updates: any) => void;
}

export interface WidgetLifecycleContext {
    widgetId: string;
    semesterId?: string;
    courseId?: string;
    settings: any;
}

export type WidgetContext = 'semester' | 'course';
export type MaxInstances = number | 'unlimited';

export interface WidgetSettingsProps {
    settings: any;
    onSave: (newSettings: any) => void;
    onClose: () => void;
}

export interface WidgetDefinition {
    type: string;
    name: string;
    description?: string;
    icon?: React.ReactNode;
    component: React.FC<WidgetProps>;
    defaultSettings?: any;
    layout?: { w: number, h: number, minW?: number, minH?: number, maxW?: number, maxH?: number };
    /** Limit how many instances can be added. Use a number or 'unlimited' for no limit. */
    maxInstances?: MaxInstances;
    /** Limit where this widget can be added. Defaults to both contexts. */
    allowedContexts?: WidgetContext[];
    /** Custom buttons to display in the widget header */
    headerButtons?: HeaderButton[];
    /** Optional settings component. If provided, a settings button will be shown in the widget header. */
    SettingsComponent?: React.FC<WidgetSettingsProps>;
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

const DEFAULT_ALLOWED_CONTEXTS: WidgetContext[] = ['semester', 'course'];

export const resolveAllowedContexts = (definition: WidgetDefinition) => {
    return definition.allowedContexts ?? DEFAULT_ALLOWED_CONTEXTS;
};

export const isUnlimitedInstances = (maxInstances?: MaxInstances) => {
    if (maxInstances === undefined || maxInstances === 'unlimited') return true;
    if (typeof maxInstances === 'number' && !Number.isFinite(maxInstances)) return true;
    return false;
};

export const canAddWidget = (definition: WidgetDefinition, context: WidgetContext, currentCount: number) => {
    if (!resolveAllowedContexts(definition).includes(context)) return false;
    if (isUnlimitedInstances(definition.maxInstances)) return true;
    if (typeof definition.maxInstances === 'number') return currentCount < definition.maxInstances;
    return true;
};

export const WidgetRegistry = new WidgetRegistryClass();
