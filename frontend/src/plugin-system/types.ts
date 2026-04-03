// input:  [plugin SDK runtime-context types plus icon node typing from React]
// output: [`PluginManifestItem`, `TabCatalogItem`, `WidgetCatalogItem`, `WidgetLayoutDefinition`, and `ResolvedPluginMetadata` interfaces]
// pos:    [Internal runtime catalog contracts derived from descriptor-backed plugin definitions plus host-only plugin policy]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { ReactNode } from 'react';
import type { PluginWorkspaceContext } from '@/plugin-sdk';
import type { MaxInstances as WidgetMaxInstances } from './utils';

/** Workspace contexts supported by tabs and widgets — both are the same underlying type. */
type WorkspaceContext = PluginWorkspaceContext;
type TabContext = WorkspaceContext;
type WidgetContext = WorkspaceContext;

export type PluginKind = 'host-shell' | 'builtin' | 'external';
export type PluginManifestVisibility = 'public' | 'hidden';

export interface PluginManifestItem {
    pluginId: string;
    displayName: string;
    author: string;
    description: string;
    longDescription: string;
    kind: PluginKind;
    visibility: PluginManifestVisibility;
    icon: ReactNode;
}

export interface WidgetLayoutDefinition {
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
}

export interface TabCatalogItem {
    pluginId: string;
    type: string;
    name: string;
    description?: string;
    icon?: ReactNode;
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
