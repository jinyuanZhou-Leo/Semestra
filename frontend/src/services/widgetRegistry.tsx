// input:  [createPluginRegistry factory, widget plugin definitions, header-button render contracts]
// output: [widget prop/definition types, singleton `WidgetRegistry`, and helper hooks]
// pos:    [Runtime registry for widget components, instance settings UIs, constraints, and lifecycle callbacks]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { createPluginRegistry } from './createPluginRegistry';

export interface HeaderButtonContext {
    widgetId: string;
    settings: unknown;
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
    settings: unknown;
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
    defaultSettings?: unknown;
    /** Custom buttons to display in the widget header */
    headerButtons?: HeaderButton[];
    /** Optional settings component for individual widget instance. If provided, a settings button will be shown in the widget header. */
    SettingsComponent?: React.FC<WidgetSettingsProps>;
    /** Called after widget is created. If throws, the widget will be rolled back (deleted). */
    onCreate?: (context: WidgetLifecycleContext) => Promise<void> | void;
    /** Called after widget is deleted. Errors are logged but don't affect deletion. */
    onDelete?: (context: WidgetLifecycleContext) => Promise<void> | void;
}

const { registry, useRegistry } = createPluginRegistry<WidgetDefinition, WidgetProps>(
    'Widget',
    'widgetId',
);

export const WidgetRegistry = registry;

/**
 * React Hook to subscribe to widget registry changes.
 * Automatically re-renders when new widgets are registered.
 */
export const useWidgetRegistry = useRegistry;
