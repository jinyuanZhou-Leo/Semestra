// input:  [registry context/max-instance types and icon node typing from React]
// output: [`TabCatalogItem`, `WidgetCatalogItem`, `WidgetLayoutDefinition`, and `ResolvedPluginMetadata` interfaces]
// pos:    [Shared type contracts for plugin metadata catalogs, widget layout metadata, and resolver outputs]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { ReactNode } from 'react';
import type { MaxInstances as TabMaxInstances, TabContext } from '../services/tabRegistry';
import type { MaxInstances as WidgetMaxInstances, WidgetContext } from '../services/widgetRegistry';

export interface WidgetLayoutDefinition {
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
    aspectRatio?: number;
}

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
    layout?: WidgetLayoutDefinition;
    maxInstances?: WidgetMaxInstances;
    allowedContexts?: WidgetContext[];
}

export interface ResolvedPluginMetadata {
    name?: string;
    description?: string;
    icon?: ReactNode;
}
