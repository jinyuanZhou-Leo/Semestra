// input:  [plugin entries, catalog/max-instance utilities, and host-reserved tab/plugin guards]
// output: [catalog index builder plus catalog/filter helpers used by the plugin facade]
// pos:    [Internal catalog helper that centralizes manifest lookup, ownership maps, resolved metadata, and addability rules]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { isHostReservedPluginId, isHostReservedTabType } from '@/utils/homepageBuiltinTabs';
import type { TabContext, WidgetContext } from './public-types';
import type { PluginEntry } from './pluginRuntimeLoader';
import type {
  PluginManifestItem,
  ResolvedPluginMetadata,
  TabCatalogItem,
  WidgetCatalogItem,
} from './types';
import {
  DEFAULT_TAB_ALLOWED_CONTEXTS,
  DEFAULT_WIDGET_ALLOWED_CONTEXTS,
  isUnlimitedInstances,
} from './utils';

export interface PluginCatalogIndex {
  pluginManifestById: Map<string, PluginManifestItem>;
  tabTypeToPluginId: Map<string, string>;
  widgetTypeToPluginId: Map<string, string>;
  tabCatalogByType: Map<string, TabCatalogItem>;
  widgetCatalogByType: Map<string, WidgetCatalogItem>;
}

export const buildPluginCatalogIndex = (pluginEntries: PluginEntry[]): PluginCatalogIndex => {
  const pluginManifestById = new Map<string, PluginManifestItem>();
  const tabTypeToPluginId = new Map<string, string>();
  const widgetTypeToPluginId = new Map<string, string>();
  const tabCatalogByType = new Map<string, TabCatalogItem>();
  const widgetCatalogByType = new Map<string, WidgetCatalogItem>();

  pluginEntries.forEach((entry) => {
    pluginManifestById.set(entry.id, entry.manifest);
    entry.tabCatalog.forEach((item) => {
      tabTypeToPluginId.set(item.type, entry.id);
      tabCatalogByType.set(item.type, item);
    });
    entry.widgetCatalog.forEach((item) => {
      widgetTypeToPluginId.set(item.type, entry.id);
      widgetCatalogByType.set(item.type, item);
    });
  });

  return {
    pluginManifestById,
    tabTypeToPluginId,
    widgetTypeToPluginId,
    tabCatalogByType,
    widgetCatalogByType,
  };
};

export const getTabCatalogItems = (pluginEntries: PluginEntry[], context?: TabContext): TabCatalogItem[] => {
  const items = pluginEntries
    .flatMap((entry) => entry.tabCatalog)
    .filter((item) => !isHostReservedTabType(item.type));
  if (!context) {
    return items;
  }
  return items.filter((item) => (item.allowedContexts ?? DEFAULT_TAB_ALLOWED_CONTEXTS).includes(context));
};

export const getWidgetCatalogItems = (pluginEntries: PluginEntry[], context?: WidgetContext): WidgetCatalogItem[] => {
  const items = pluginEntries.flatMap((entry) => entry.widgetCatalog);
  if (!context) {
    return items;
  }
  return items.filter((item) => (item.allowedContexts ?? DEFAULT_WIDGET_ALLOWED_CONTEXTS).includes(context));
};

export const getPublicPluginManifest = (pluginEntries: PluginEntry[]): PluginManifestItem[] => {
  return pluginEntries
    .map((entry) => entry.manifest)
    .filter((manifest) => !isHostReservedPluginId(manifest.pluginId));
};

export const resolveCatalogMetadata = (
  catalogItem?: Pick<TabCatalogItem, 'name' | 'description' | 'icon'> | Pick<WidgetCatalogItem, 'name' | 'description' | 'icon'>,
): ResolvedPluginMetadata => ({
  name: catalogItem?.name,
  description: catalogItem?.description,
  icon: catalogItem?.icon,
});

export const canAddTabCatalogItem = (
  item: TabCatalogItem,
  context: TabContext,
  currentCount: number,
) => {
  const allowedContexts = item.allowedContexts ?? DEFAULT_TAB_ALLOWED_CONTEXTS;
  if (!allowedContexts.includes(context)) {
    return false;
  }
  return currentCount < 1;
};

export const canAddWidgetCatalogItem = (
  item: WidgetCatalogItem,
  context: WidgetContext,
  currentCount: number,
) => {
  const allowedContexts = item.allowedContexts ?? DEFAULT_WIDGET_ALLOWED_CONTEXTS;
  if (!allowedContexts.includes(context)) {
    return false;
  }
  if (isUnlimitedInstances(item.maxInstances)) {
    return true;
  }
  if (item.maxInstances === 0) {
    return currentCount < 1;
  }
  if (typeof item.maxInstances === 'number') {
    return currentCount < item.maxInstances;
  }
  return true;
};
