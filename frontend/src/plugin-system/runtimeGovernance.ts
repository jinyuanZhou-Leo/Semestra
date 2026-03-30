// input:  [normalized runtime workspace payloads returned by semester/course APIs]
// output: [helpers that normalize Program/Semester-governed runtime contribution availability, runtime tabs, and widget catalogs]
// pos:    [Runtime governance adapter that consumes the single frontend runtime workspace contract exposed by the API layer, including V2 contribution-level availability and widget visibility filtering]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { getPluginIdByTabType, getPluginIdByWidgetType } from './index';
import type { ContributionAvailability, RuntimeWorkspacePayload } from '@/services/api';

type JsonObject = Record<string, unknown>;
type AvailabilityLike = ContributionAvailability;

export interface GovernedRuntimeTab {
  id: string;
  type: string;
  title: string;
  settings: JsonObject;
  order_index: number;
  is_draggable?: boolean;
  is_removable?: boolean;
  plugin_id?: string | null;
  availability: AvailabilityLike;
}

type RuntimeWidgetLike = {
  type?: string;
};

type RuntimeTabItemLike = {
  type?: string;
};

const isContributionAvailable = (availability: AvailabilityLike | undefined): boolean => {
  return availability?.state === 'available';
};

export const resolveGovernedRuntimeTabs = (
  runtime: RuntimeWorkspacePayload | null | undefined,
  scopeKey: string
): GovernedRuntimeTab[] => {
  const resolvedTabs: GovernedRuntimeTab[] = [];

  (runtime?.runtime_tabs ?? []).forEach((tab, index) => {
      const type = tab.type;
      if (!type) return;

      resolvedTabs.push({
        id: tab.id ?? `${scopeKey}:${type}`,
        type,
        title: tab.title ?? type,
        settings: (tab.settings ?? {}) as JsonObject,
        order_index: typeof tab.order_index === 'number' ? tab.order_index : index,
        is_draggable: tab.is_draggable,
        is_removable: tab.is_removable,
        plugin_id: tab.plugin_id,
        availability: tab.availability ?? { state: 'available' },
      });
    });

  return resolvedTabs.sort((left, right) => left.order_index - right.order_index);
};

export const resolveEnabledPluginIds = (entity: RuntimeWorkspacePayload | null | undefined): Set<string> => {
  const ids = new Set<string>();

  (entity?.tab_catalog_items ?? []).forEach((item) => {
    if (!isContributionAvailable(item.availability)) return;
    if (typeof item.plugin_id === 'string' && item.plugin_id.length > 0) {
      ids.add(item.plugin_id);
    }
  });

  (entity?.widget_catalog_items ?? []).forEach((item) => {
    if (!isContributionAvailable(item.availability)) return;
    if (typeof item.plugin_id === 'string' && item.plugin_id.length > 0) {
      ids.add(item.plugin_id);
    }
  });

  entity?.enabled_plugin_ids.forEach((pluginId) => {
    if (typeof pluginId === 'string' && pluginId.length > 0) {
      ids.add(pluginId);
    }
  });

  entity?.enabled_plugins.forEach((plugin) => {
    const pluginId = plugin.plugin_id;
    if (typeof pluginId === 'string' && pluginId.length > 0) {
      ids.add(pluginId);
    }
  });

  entity?.runtime_tabs.forEach((tab) => {
    if (!isContributionAvailable(tab.availability)) {
      return;
    }
    if (typeof tab.plugin_id === 'string' && tab.plugin_id.length > 0) {
      ids.add(tab.plugin_id);
    }
  });

  return ids;
};

export const resolveAvailableWidgetTypes = (entity: RuntimeWorkspacePayload | null | undefined): Set<string> => {
  const widgetTypes = new Set<string>();

  (entity?.widget_catalog_items ?? []).forEach((item) => {
    if (!isContributionAvailable(item.availability)) return;
    if (typeof item.widget_type === 'string' && item.widget_type.length > 0) {
      widgetTypes.add(item.widget_type);
    }
  });

  entity?.available_widget_types.forEach((widgetType) => {
    if (typeof widgetType === 'string' && widgetType.length > 0) {
      widgetTypes.add(widgetType);
    }
  });

  entity?.enabled_plugins.forEach((plugin) => {
    plugin.available_widget_types?.forEach((widgetType) => {
      if (typeof widgetType === 'string' && widgetType.length > 0) {
        widgetTypes.add(widgetType);
      }
    });
  });

  return widgetTypes;
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
