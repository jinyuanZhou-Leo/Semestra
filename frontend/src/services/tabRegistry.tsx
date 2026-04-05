// input:  [createPluginRegistry factory, React memo/subscription utilities]
// output: [tab prop/definition types, singleton `TabRegistry`, and tab registry hooks/helpers]
// pos:    [In-memory registry controlling tab availability, limits, and render components]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from 'react';
import { createPluginRegistry } from './createPluginRegistry';

export interface TabProps {
    tabId: string;
    semesterId?: string;
    courseId?: string;
}

export interface TabLifecycleContext {
    tabId: string;
    semesterId?: string;
    courseId?: string;
}

export type TabContext = 'semester' | 'course';

export interface TabDefinition {
    type: string;
    component: React.FC<TabProps>;
    onCreate?: (context: TabLifecycleContext) => Promise<void> | void;
    onDelete?: (context: TabLifecycleContext) => Promise<void> | void;
}

const { registry, useRegistry } = createPluginRegistry<TabDefinition, TabProps>(
    'Tab',
    'tabId',
);

export const TabRegistry = registry;

/**
 * React Hook to subscribe to tab registry changes.
 * Automatically re-renders when new tabs are registered.
 */
export const useTabRegistry = useRegistry;
