"use no memo";

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
    onSettingsChange: (newSettings: any) => void;
}

/**
 * Props for plugin-level global settings component.
 * This settings component is shown in the Settings tab and applies to the plugin as a whole,
 * not to individual widget instances.
 */
export interface WidgetGlobalSettingsProps {
    semesterId?: string;
    courseId?: string;
    onRefresh: () => void;
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
    /** Optional settings component for individual widget instance. If provided, a settings button will be shown in the widget header. */
    SettingsComponent?: React.FC<WidgetSettingsProps>;
    /** 
     * Optional global settings component for the plugin as a whole.
     * This will be rendered in the Settings tab, regardless of how many widget instances exist.
     * Use this for settings that affect all instances or for plugin-level management (e.g., course management).
     */
    globalSettingsComponent?: React.FC<WidgetGlobalSettingsProps>;
    /** Called after widget is created. If throws, the widget will be rolled back (deleted). */
    onCreate?: (context: WidgetLifecycleContext) => Promise<void> | void;
    /** Called after widget is deleted. Errors are logged but don't affect deletion. */
    onDelete?: (context: WidgetLifecycleContext) => Promise<void> | void;
}

type Listener = () => void;

class WidgetRegistryClass {
    private widgets: Map<string, WidgetDefinition> = new Map();
    private listeners: Set<Listener> = new Set();

    register(definition: WidgetDefinition) {
        if (this.widgets.has(definition.type)) {
            console.warn(`Widget type ${definition.type} is already registered. Overwriting.`);
        }
        this.widgets.set(definition.type, definition);
        // Notify all subscribers when a new widget is registered
        this.notifyListeners();
    }

    private notifyListeners() {
        this.listeners.forEach(listener => listener());
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
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

/**
 * React Hook to subscribe to widget registry changes.
 * Automatically re-renders when new widgets are registered.
 */
export const useWidgetRegistry = (): WidgetDefinition[] => {
    const [widgets, setWidgets] = React.useState<WidgetDefinition[]>(() => WidgetRegistry.getAll());

    React.useEffect(() => {
        // Update immediately in case widgets were registered before subscription
        setWidgets(WidgetRegistry.getAll());

        // Subscribe to future changes
        const unsubscribe = WidgetRegistry.subscribe(() => {
            setWidgets(WidgetRegistry.getAll());
        });

        return unsubscribe;
    }, []);

    return widgets;
};
