// input:  [runtime entity payloads returned by semester/course APIs]
// output: [helpers that normalize Program/Semester-governed runtime plugin availability into tab/widget/settings state]
// pos:    [Runtime governance adapter that decouples homepage/plugin pages from backend field-shape churn during the Program->Semester plugin hierarchy refactor, including widget visibility filtering against enabled plugin ids]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { getPluginIdByTabType, getPluginIdByWidgetType } from './index';

type JsonObject = Record<string, unknown>;

type RuntimePluginLike = {
  plugin_id?: string;
  id?: string;
  available_tab_types?: string[];
  available_widget_types?: string[];
};

type RuntimeTabLike = {
  id?: string;
  type?: string;
  tab_type?: string;
  title?: string;
  settings?: unknown;
  resolved_settings?: unknown;
  order_index?: number;
  is_draggable?: boolean;
  is_removable?: boolean;
  plugin_id?: string;
};

type RuntimePluginSettingsLike = {
  plugin_id?: string;
  id?: string;
  settings?: unknown;
  resolved_settings?: unknown;
};

type RuntimeEntityLike = {
  tabs?: RuntimeTabLike[];
  runtime_tabs?: RuntimeTabLike[];
  resolved_tabs?: RuntimeTabLike[];
  enabled_plugin_ids?: string[];
  enabled_plugins?: RuntimePluginLike[];
  runtime_plugins?: RuntimePluginLike[];
  available_widget_types?: string[];
  plugin_settings?: RuntimePluginSettingsLike[];
  resolved_plugin_settings?: RuntimePluginSettingsLike[];
  runtime_plugin_settings?: RuntimePluginSettingsLike[];
};

export interface GovernedRuntimeTab {
  id: string;
  type: string;
  title: string;
  settings: JsonObject;
  order_index: number;
  is_draggable?: boolean;
  is_removable?: boolean;
  plugin_id?: string;
}

type RuntimeWidgetLike = {
  type?: string;
};

type RuntimeTabItemLike = {
  type?: string;
};

const EMPTY_OBJECT: JsonObject = {};

const parseJsonObject = (value: unknown): JsonObject => {
  if (!value) return EMPTY_OBJECT;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as JsonObject
        : EMPTY_OBJECT;
    } catch (error) {
      console.warn('Failed to parse runtime governance JSON payload', error);
      return EMPTY_OBJECT;
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return EMPTY_OBJECT;
};

const readRuntimeTabs = (entity: RuntimeEntityLike | null | undefined): RuntimeTabLike[] => {
  if (!entity) return [];
  return entity.runtime_tabs ?? entity.resolved_tabs ?? entity.tabs ?? [];
};

const readRuntimePlugins = (entity: RuntimeEntityLike | null | undefined): RuntimePluginLike[] => {
  if (!entity) return [];
  return entity.enabled_plugins ?? entity.runtime_plugins ?? [];
};

const readRuntimePluginSettings = (
  entity: RuntimeEntityLike | null | undefined
): RuntimePluginSettingsLike[] => {
  if (!entity) return [];
  return entity.resolved_plugin_settings ?? entity.runtime_plugin_settings ?? entity.plugin_settings ?? [];
};

export const hasRuntimeGovernanceShape = (entity: RuntimeEntityLike | null | undefined): boolean => {
  if (!entity) return false;
  return (
    Array.isArray(entity.runtime_tabs) ||
    Array.isArray(entity.resolved_tabs) ||
    Array.isArray(entity.enabled_plugin_ids) ||
    Array.isArray(entity.enabled_plugins) ||
    Array.isArray(entity.runtime_plugins) ||
    Array.isArray(entity.available_widget_types) ||
    Array.isArray(entity.resolved_plugin_settings) ||
    Array.isArray(entity.runtime_plugin_settings)
  );
};

export const resolveGovernedRuntimeTabs = (
  entity: RuntimeEntityLike | null | undefined,
  scopeKey: string
): GovernedRuntimeTab[] => {
  const resolvedTabs: GovernedRuntimeTab[] = [];

  readRuntimeTabs(entity).forEach((tab, index) => {
      const type = tab.type ?? tab.tab_type ?? '';
      if (!type) return;

      resolvedTabs.push({
        id: tab.id ?? `${scopeKey}:${type}`,
        type,
        title: tab.title ?? type,
        settings: parseJsonObject(tab.resolved_settings ?? tab.settings),
        order_index: typeof tab.order_index === 'number' ? tab.order_index : index,
        is_draggable: tab.is_draggable,
        is_removable: tab.is_removable,
        plugin_id: tab.plugin_id,
      });
    });

  return resolvedTabs.sort((left, right) => left.order_index - right.order_index);
};

export const resolveEnabledPluginIds = (entity: RuntimeEntityLike | null | undefined): Set<string> => {
  const ids = new Set<string>();

  entity?.enabled_plugin_ids?.forEach((pluginId) => {
    if (typeof pluginId === 'string' && pluginId.length > 0) {
      ids.add(pluginId);
    }
  });

  readRuntimePlugins(entity).forEach((plugin) => {
    const pluginId = plugin.plugin_id ?? plugin.id;
    if (typeof pluginId === 'string' && pluginId.length > 0) {
      ids.add(pluginId);
    }
  });

  readRuntimePluginSettings(entity).forEach((pluginSetting) => {
    const pluginId = pluginSetting.plugin_id ?? pluginSetting.id;
    if (typeof pluginId === 'string' && pluginId.length > 0) {
      ids.add(pluginId);
    }
  });

  readRuntimeTabs(entity).forEach((tab) => {
    if (typeof tab.plugin_id === 'string' && tab.plugin_id.length > 0) {
      ids.add(tab.plugin_id);
    }
  });

  return ids;
};

export const resolveAvailableWidgetTypes = (entity: RuntimeEntityLike | null | undefined): Set<string> => {
  const widgetTypes = new Set<string>();

  entity?.available_widget_types?.forEach((widgetType) => {
    if (typeof widgetType === 'string' && widgetType.length > 0) {
      widgetTypes.add(widgetType);
    }
  });

  readRuntimePlugins(entity).forEach((plugin) => {
    plugin.available_widget_types?.forEach((widgetType) => {
      if (typeof widgetType === 'string' && widgetType.length > 0) {
        widgetTypes.add(widgetType);
      }
    });
  });

  return widgetTypes;
};

export const resolvePluginSettingsMap = (
  entity: RuntimeEntityLike | null | undefined
): Map<string, JsonObject> => {
  const settingsMap = new Map<string, JsonObject>();

  readRuntimePluginSettings(entity).forEach((pluginSetting) => {
    const pluginId = pluginSetting.plugin_id ?? pluginSetting.id;
    if (typeof pluginId !== 'string' || pluginId.length === 0) {
      return;
    }
    settingsMap.set(pluginId, parseJsonObject(pluginSetting.resolved_settings ?? pluginSetting.settings));
  });

  return settingsMap;
};

export const filterWidgetItemsByEnabledPlugins = <T extends RuntimeWidgetLike>(
  widgets: T[],
  enabledPluginIds: Set<string>
): T[] => {
  return widgets.filter((widget) => {
    const pluginId = getPluginIdByWidgetType(widget.type ?? '');
    return !pluginId || enabledPluginIds.has(pluginId);
  });
};

export const filterTabItemsByEnabledPlugins = <T extends RuntimeTabItemLike>(
  tabs: T[],
  enabledPluginIds: Set<string>
): T[] => {
  return tabs.filter((tab) => {
    const pluginId = getPluginIdByTabType(tab.type ?? '');
    return !pluginId || enabledPluginIds.has(pluginId);
  });
};
