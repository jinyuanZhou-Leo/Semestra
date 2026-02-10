import type { ReactNode } from 'react';
import type { MaxInstances as TabMaxInstances, TabContext } from '../../services/tabRegistry';
import type { MaxInstances as WidgetMaxInstances, WidgetContext, WidgetDefinition } from '../../services/widgetRegistry';

export interface TabCatalogItem {
    pluginId: string;
    type: string;
    name: string;
    description?: string;
    icon?: ReactNode;
    maxInstances?: TabMaxInstances;
    allowedContexts?: TabContext[];
}

export interface WidgetCatalogItem {
    pluginId: string;
    type: string;
    name: string;
    description?: string;
    icon?: ReactNode;
    layout?: NonNullable<WidgetDefinition['layout']>;
    maxInstances?: WidgetMaxInstances;
    allowedContexts?: WidgetContext[];
}

export interface ResolvedPluginMetadata {
    name?: string;
    description?: string;
    icon?: ReactNode;
}
