// input:  [widget plugin definitions, header-button render contracts, and React subscriptions]
// output: [widget prop/definition types, singleton `WidgetRegistry`, and helper hooks]
// pos:    [Runtime registry for widget components, instance settings UIs, constraints, and lifecycle callbacks]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useSyncExternalStore } from 'react';
import { jsonDeepEqual } from '../plugin-system/utils';

export interface HeaderButtonContext {
    widgetId: string;
    settings: any;
    semesterId?: string;
    courseId?: string;
    updateSettings: (newSettings: any) => void | Promise<void>;
}

export interface HeaderActionButtonProps {
    title: string;
    icon: React.ReactNode;
    onClick: () => void | Promise<void>;
    variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
}

export interface HeaderConfirmActionButtonProps extends HeaderActionButtonProps {
    dialogTitle: string;
    dialogDescription?: string;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
}

export interface HeaderButtonRenderHelpers {
    ActionButton: React.FC<HeaderActionButtonProps>;
    ConfirmActionButton: React.FC<HeaderConfirmActionButtonProps>;
}

export interface HeaderButton {
    id: string;
    render: (context: HeaderButtonContext, helpers: HeaderButtonRenderHelpers) => React.ReactNode;
}

export interface WidgetProps<S = any> {
    widgetId: string;
    settings: S;
    semesterId?: string;
    courseId?: string;
    /**
     * Update widget settings - framework handles debouncing automatically
     * Plugin developers just call this function, no need to implement debouncing
     * Returns void since framework debounces API calls (Optimistic UI pattern)
     */
    updateSettings: (newSettings: S) => void | Promise<void>;
    updateCourse?: (updates: any) => void;
}

export interface WidgetLifecycleContext {
    widgetId: string;
    semesterId?: string;
    courseId?: string;
    settings: any;
}

export type WidgetContext = 'semester' | 'course';
export type { MaxInstances } from '../plugin-system/utils';

export interface WidgetSettingsProps<S = any> {
    widgetId?: string;
    semesterId?: string;
    courseId?: string;
    settings: S;
    onSettingsChange: (newSettings: S) => void;
}

export interface WidgetDefinition {
    type: string;
    component: React.FC<WidgetProps>;
    defaultSettings?: any;
    /** Custom buttons to display in the widget header */
    headerButtons?: HeaderButton[];
    /** Optional settings component for individual widget instance. If provided, a settings button will be shown in the widget header. */
    SettingsComponent?: React.FC<WidgetSettingsProps>;
    /** Called after widget is created. If throws, the widget will be rolled back (deleted). */
    onCreate?: (context: WidgetLifecycleContext) => Promise<void> | void;
    /** Called after widget is deleted. Errors are logged but don't affect deletion. */
    onDelete?: (context: WidgetLifecycleContext) => Promise<void> | void;
}

type Listener = () => void;

class WidgetRegistryClass {
    private widgets: Map<string, WidgetDefinition> = new Map();
    private memoizedComponents: Map<string, React.FC<WidgetProps>> = new Map();
    private listeners: Set<Listener> = new Set();
    private snapshot: WidgetDefinition[] = [];

    register(definition: WidgetDefinition) {
        if (this.widgets.has(definition.type)) {
            console.warn(`Widget type ${definition.type} is already registered. Overwriting.`);
            this.memoizedComponents.delete(definition.type);
        }
        this.widgets.set(definition.type, definition);
        this.snapshot = Array.from(this.widgets.values());
        // Notify all subscribers when a new widget is registered
        this.notifyListeners();
    }

    unregister(type: string) {
        const existed = this.widgets.delete(type);
        this.memoizedComponents.delete(type);
        if (existed) {
            this.snapshot = Array.from(this.widgets.values());
            this.notifyListeners();
        }
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
        return this.snapshot;
    }

    getComponent(type: string): React.FC<WidgetProps> | undefined {
        const definition = this.widgets.get(type);
        if (!definition) return undefined;

        // Return cached memoized component if available
        if (this.memoizedComponents.has(type)) {
            return this.memoizedComponents.get(type);
        }

        // Create memoized version with custom comparison
        const MemoizedComponent = React.memo(definition.component, (prevProps, nextProps) => {
            return (
                prevProps.widgetId === nextProps.widgetId &&
                prevProps.semesterId === nextProps.semesterId &&
                prevProps.courseId === nextProps.courseId &&
                jsonDeepEqual(prevProps.settings, nextProps.settings)
            );
        });

        // Cache and return
        this.memoizedComponents.set(type, MemoizedComponent);
        return MemoizedComponent;
    }
}

export const WidgetRegistry = new WidgetRegistryClass();

/**
 * React Hook to subscribe to widget registry changes.
 * Automatically re-renders when new widgets are registered.
 */
export const useWidgetRegistry = (): WidgetDefinition[] => {
    return useSyncExternalStore(
        (listener) => WidgetRegistry.subscribe(listener),
        () => WidgetRegistry.getAll(),
        () => WidgetRegistry.getAll()
    );
};
