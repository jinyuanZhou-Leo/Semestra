// input:  [createPluginRegistry factory, widget plugin definitions, header-button render contracts]
// output: [widget prop/definition types, singleton `WidgetRegistry`, and helper hooks]
// pos:    [Runtime registry for widget components, instance settings UIs, constraints, and lifecycle callbacks]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React from 'react';
import { jsonDeepEqual } from '../plugin-system/utils';
import { createPluginRegistry } from './createPluginRegistry';

export interface HeaderButtonContext {
    widgetId: string;
    settings: unknown;
    semesterId?: string;
    courseId?: string;
    updateSettings: (newSettings: unknown) => void | Promise<void>;
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

export type WidgetUpdateData = {
    settings?: string | Record<string, unknown>;
    layout_config?: string | Record<string, unknown>;
    [key: string]: unknown;
};

export interface WidgetProps<S = unknown> {
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
    updateCourse?: (updates: Record<string, unknown>) => void;
}

export interface WidgetLifecycleContext {
    widgetId: string;
    semesterId?: string;
    courseId?: string;
    settings: unknown;
}

export type WidgetContext = 'semester' | 'course';
export type { MaxInstances } from '../plugin-system/utils';

export interface WidgetSettingsProps<S = unknown> {
    widgetId?: string;
    semesterId?: string;
    courseId?: string;
    settings: S;
    onSettingsChange: (newSettings: S) => void;
}

type WidgetComponent<S = unknown> = {
    bivarianceHack(props: WidgetProps<S>): ReturnType<React.FC<WidgetProps<S>>>;
}['bivarianceHack'];

type WidgetSettingsComponent<S = unknown> = {
    bivarianceHack(props: WidgetSettingsProps<S>): ReturnType<React.FC<WidgetSettingsProps<S>>>;
}['bivarianceHack'];

export interface WidgetDefinition<S = unknown> {
    type: string;
    component: WidgetComponent<S>;
    defaultSettings?: S;
    /** Custom buttons to display in the widget header */
    headerButtons?: HeaderButton[];
    /** Optional settings component for individual widget instance. If provided, a settings button will be shown in the widget header. */
    SettingsComponent?: WidgetSettingsComponent<S>;
    /** Called after widget is created. If throws, the widget will be rolled back (deleted). */
    onCreate?: (context: WidgetLifecycleContext) => Promise<void> | void;
    /** Called after widget is deleted. Errors are logged but don't affect deletion. */
    onDelete?: (context: WidgetLifecycleContext) => Promise<void> | void;
}

const { registry, useRegistry } = createPluginRegistry<WidgetDefinition, WidgetProps>(
    'Widget',
    'widgetId',
    (prevProps, nextProps, idPropKey) => (
        prevProps[idPropKey] === nextProps[idPropKey] &&
        prevProps.semesterId === nextProps.semesterId &&
        prevProps.courseId === nextProps.courseId &&
        prevProps.updateSettings === nextProps.updateSettings &&
        prevProps.updateCourse === nextProps.updateCourse &&
        jsonDeepEqual(prevProps.settings, nextProps.settings)
    ),
);

export const WidgetRegistry = registry;

/**
 * React Hook to subscribe to widget registry changes.
 * Automatically re-renders when new widgets are registered.
 */
export const useWidgetRegistry = useRegistry;
