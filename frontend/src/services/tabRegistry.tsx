// input:  [tab plugin definitions from runtime modules, React memo/subscription utilities]
// output: [tab prop/definition types, singleton `TabRegistry`, and tab registry hooks/helpers]
// pos:    [In-memory registry controlling tab availability, limits, and render components]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useSyncExternalStore } from 'react';
import { jsonDeepEqual } from '../plugin-system/utils';

export interface TabProps<S = any> {
    tabId: string;
    settings: S;
    semesterId?: string;
    courseId?: string;
    updateSettings: (newSettings: S) => void | Promise<void>;
}

export interface TabSettingsProps<S = any> {
    tabId: string;
    settings: S;
    semesterId?: string;
    courseId?: string;
    updateSettings: (newSettings: S) => void | Promise<void>;
}

export interface TabLifecycleContext {
    tabId: string;
    semesterId?: string;
    courseId?: string;
    settings: any;
}

export type TabContext = 'semester' | 'course';
export type { MaxInstances } from '../plugin-system/utils';

export interface TabDefinition {
    type: string;
    component: React.FC<TabProps>;
    defaultSettings?: any;
    SettingsComponent?: React.FC<TabSettingsProps>;
    onCreate?: (context: TabLifecycleContext) => Promise<void> | void;
    onDelete?: (context: TabLifecycleContext) => Promise<void> | void;
}

type Listener = () => void;

class TabRegistryClass {
    private tabs: Map<string, TabDefinition> = new Map();
    private memoizedComponents: Map<string, React.FC<TabProps>> = new Map();
    private listeners: Set<Listener> = new Set();
    private snapshot: TabDefinition[] = [];

    register(definition: TabDefinition) {
        if (this.tabs.has(definition.type)) {
            console.warn(`Tab type ${definition.type} is already registered. Overwriting.`);
            // Clear cached memoized components when re-registering
            this.memoizedComponents.delete(definition.type);
        }
        this.tabs.set(definition.type, definition);
        this.snapshot = Array.from(this.tabs.values());
        // Notify all subscribers when a new tab is registered
        this.notifyListeners();
    }

    unregister(type: string) {
        const existed = this.tabs.delete(type);
        this.memoizedComponents.delete(type);
        if (existed) {
            this.snapshot = Array.from(this.tabs.values());
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

    get(type: string): TabDefinition | undefined {
        return this.tabs.get(type);
    }

    getAll(): TabDefinition[] {
        return this.snapshot;
    }

    getComponent(type: string): React.FC<TabProps> | undefined {
        const definition = this.tabs.get(type);
        if (!definition) return undefined;

        // Return cached memoized component if available
        if (this.memoizedComponents.has(type)) {
            return this.memoizedComponents.get(type);
        }

        // Create memoized version with custom comparison
        const MemoizedComponent = React.memo(definition.component, (prevProps, nextProps) => {
            // Only re-render if these specific props change
            return (
                prevProps.tabId === nextProps.tabId &&
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

export const TabRegistry = new TabRegistryClass();

/**
 * React Hook to subscribe to tab registry changes.
 * Automatically re-renders when new tabs are registered.
 */
export const useTabRegistry = (): TabDefinition[] => {
    return useSyncExternalStore(
        (listener) => TabRegistry.subscribe(listener),
        () => TabRegistry.getAll(),
        () => TabRegistry.getAll()
    );
};
