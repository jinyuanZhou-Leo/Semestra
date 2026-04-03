// input:  [React memo utilities, deep-equality helper]
// output: [Generic `createPluginRegistry<TDef, TProps>` factory function]
// pos:    [Shared registry class builder to eliminate identical logic in TabRegistry and WidgetRegistry]

import React, { useSyncExternalStore } from 'react';
import { jsonDeepEqual } from '../plugin-system/utils';

type Listener = () => void;

/**
 * A generic plugin component registry with:
 * - Register/unregister with change notification
 * - React-aware `useSyncExternalStore` hook
 * - Memoized component caching with deep settings comparison
 */
export interface PluginRegistry<TDefinition extends { type: string; component: React.FC<TProps> }, TProps extends { settings: unknown }> {
    register(definition: TDefinition): void;
    unregister(type: string): void;
    subscribe(listener: Listener): () => void;
    get(type: string): TDefinition | undefined;
    getAll(): TDefinition[];
    getComponent(type: string): React.FC<TProps> | undefined;
}

export interface PluginRegistryResult<TDefinition extends { type: string; component: React.FC<TProps> }, TProps extends { settings: unknown }> {
    registry: PluginRegistry<TDefinition, TProps>;
    useRegistry: () => TDefinition[];
}

/**
 * Creates a type-safe plugin registry with built-in React subscription support.
 *
 * @param name  — Human-readable label used in console warnings (e.g. "Tab", "Widget")
 * @param idPropKey — The key on TProps that holds the instance ID (e.g. "tabId", "widgetId"), used for memo comparison
 */
export function createPluginRegistry<
    TDefinition extends { type: string; component: React.FC<TProps> },
    TProps extends { settings: unknown; semesterId?: string; courseId?: string },
>(
    name: string,
    idPropKey: keyof TProps,
): PluginRegistryResult<TDefinition, TProps> {
    const items = new Map<string, TDefinition>();
    const memoizedComponents = new Map<string, React.FC<TProps>>();
    const listeners = new Set<Listener>();
    let snapshot: TDefinition[] = [];

    const notifyListeners = () => {
        listeners.forEach(listener => listener());
    };

    const registry: PluginRegistry<TDefinition, TProps> = {
        register(definition: TDefinition) {
            if (items.has(definition.type)) {
                console.warn(`${name} type ${definition.type} is already registered. Overwriting.`);
                memoizedComponents.delete(definition.type);
            }
            items.set(definition.type, definition);
            snapshot = Array.from(items.values());
            notifyListeners();
        },

        unregister(type: string) {
            const existed = items.delete(type);
            memoizedComponents.delete(type);
            if (existed) {
                snapshot = Array.from(items.values());
                notifyListeners();
            }
        },

        subscribe(listener: Listener): () => void {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },

        get(type: string): TDefinition | undefined {
            return items.get(type);
        },

        getAll(): TDefinition[] {
            return snapshot;
        },

        getComponent(type: string): React.FC<TProps> | undefined {
            const definition = items.get(type);
            if (!definition) return undefined;

            if (memoizedComponents.has(type)) {
                return memoizedComponents.get(type);
            }

            const MemoizedComponent = React.memo(definition.component, (prevProps, nextProps) => {
                return (
                    prevProps[idPropKey] === nextProps[idPropKey] &&
                    prevProps.semesterId === nextProps.semesterId &&
                    prevProps.courseId === nextProps.courseId &&
                    jsonDeepEqual(prevProps.settings, nextProps.settings)
                );
            });

            memoizedComponents.set(type, MemoizedComponent);
            return MemoizedComponent;
        },
    };

    const useRegistry = (): TDefinition[] => {
        return useSyncExternalStore(
            (listener) => registry.subscribe(listener),
            () => registry.getAll(),
            () => registry.getAll()
        );
    };

    return { registry, useRegistry };
}
