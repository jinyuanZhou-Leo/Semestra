// input:  [plugin-level manifest icon shape, runtime/settings/setup shapes, and tab/widget registry types]
// output: [plugin declaration interfaces and `definePlugin*` helpers for plugin authors, including the unassigned-Course capability flag]
// pos:    [Authoring contracts layer that keeps plugin-level manifest data plus runtime/settings/setup declarations normalized without depending on plugin loader runtime, including `supportsUnassignedCourse` metadata]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { ReactNode } from 'react';
import type { TabDefinition } from '../services/tabRegistry';
import type { WidgetDefinition } from '../services/widgetRegistry';
import type { PluginSettingsSectionDefinition } from '../services/pluginSettingsRegistry';
import type { TabCatalogItem, WidgetCatalogItem } from './types';
import type { PluginSetupDefinition } from './setup';

export interface PluginMetadataDefinition {
    pluginId: string;
    displayName: string;
    author: string;
    description: string;
    longDescription: string;
    icon: ReactNode;
    supportsUnassignedCourse?: boolean;
    tabCatalog?: TabCatalogItem[];
    widgetCatalog?: WidgetCatalogItem[];
}

export interface PluginRuntimeDefinition {
    tabDefinitions?: TabDefinition[];
    widgetDefinitions?: WidgetDefinition[];
}

export interface PluginSettingsDefinition {
    pluginSettings?: PluginSettingsSectionDefinition[];
}

export type { PluginSetupDefinition };

export const definePluginMetadata = (definition: PluginMetadataDefinition): PluginMetadataDefinition => ({
    pluginId: definition.pluginId,
    displayName: definition.displayName,
    author: definition.author,
    description: definition.description,
    longDescription: definition.longDescription,
    icon: definition.icon,
    supportsUnassignedCourse: definition.supportsUnassignedCourse ?? false,
    tabCatalog: definition.tabCatalog ?? [],
    widgetCatalog: definition.widgetCatalog ?? [],
});

export const definePluginRuntime = (definition: PluginRuntimeDefinition): PluginRuntimeDefinition => ({
    tabDefinitions: definition.tabDefinitions ?? [],
    widgetDefinitions: definition.widgetDefinitions ?? [],
});

export const definePluginSettings = (definition: PluginSettingsDefinition): PluginSettingsDefinition => ({
    pluginSettings: definition.pluginSettings ?? [],
});
