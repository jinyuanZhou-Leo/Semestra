// input:  [plugin-level manifest icon shape, runtime/settings shapes, and tab/widget registry types]
// output: [plugin declaration interfaces and `definePlugin*` helpers for plugin authors]
// pos:    [Authoring contracts layer that keeps plugin-level manifest data and contribution catalogs normalized without depending on plugin loader runtime]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { ReactNode } from 'react';
import type { TabDefinition } from '../services/tabRegistry';
import type { WidgetDefinition } from '../services/widgetRegistry';
import type { PluginSettingsSectionDefinition } from '../services/pluginSettingsRegistry';
import type { TabCatalogItem, WidgetCatalogItem } from './types';

export interface PluginMetadataDefinition {
    pluginId: string;
    icon: ReactNode;
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

export const definePluginMetadata = (definition: PluginMetadataDefinition): PluginMetadataDefinition => ({
    pluginId: definition.pluginId,
    icon: definition.icon,
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
