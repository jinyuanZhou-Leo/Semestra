// input:  [runtime availability helpers, plugin ownership lookups, and Vitest assertions]
// output: [test suite covering tab/widget filtering against enabled plugin ids]
// pos:    [unit tests for Program/Semester runtime availability helper behavior]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it, vi } from 'vitest';

import * as pluginSystem from './index';
import {
  filterTabItemsByEnabledPlugins,
  filterWidgetItemsByEnabledPlugins,
  resolveEnabledPluginIds,
  resolveRuntimeTabs,
} from './runtimeAvailability';

describe('runtimeAvailability filtering', () => {
  it('hides plugin-owned tabs when their plugin is disabled', () => {
    vi.spyOn(pluginSystem, 'getPluginIdByTabType').mockImplementation((type: string) => (
      type === 'governed-tab' ? 'mock-plugin' : undefined
    ));

    const tabs = [
      { id: 'tab-1', type: 'governed-tab' },
      { id: 'tab-2', type: 'legacy-tab' },
    ];

    expect(filterTabItemsByEnabledPlugins(tabs, new Set())).toEqual([
      { id: 'tab-2', type: 'legacy-tab' },
    ]);

    expect(filterTabItemsByEnabledPlugins(tabs, new Set(['mock-plugin']))).toEqual(tabs);
  });

  it('hides plugin-owned widgets when their plugin is disabled', () => {
    const widgets = [
      { id: 'world-clock-1', type: 'world-clock' },
      { id: 'legacy-1', type: 'unknown-widget-type' },
    ];

    expect(filterWidgetItemsByEnabledPlugins(widgets, new Set())).toEqual([
      { id: 'legacy-1', type: 'unknown-widget-type' },
    ]);

    expect(filterWidgetItemsByEnabledPlugins(widgets, new Set(['world-clock']))).toEqual(widgets);
  });

  it('consumes the normalized runtime payload without legacy field fallbacks', () => {
    expect(resolveRuntimeTabs({
      runtime_tabs: [
        {
          id: 'tab-1',
          type: 'world-clock',
          title: 'Clock',
          settings: { timezone: 'UTC' },
          order_index: 2,
          plugin_id: 'world-clock',
          availability: { state: 'available' },
        },
      ],
      tab_catalog_items: [],
      widget_catalog_items: [],
      enabled_plugin_ids: [],
      enabled_plugins: [
        {
          plugin_id: 'world-clock',
          available_tab_types: [],
          available_widget_types: ['world-clock'],
          settings: {},
          resolved_settings: {},
        },
      ],
      available_widget_types: ['world-clock'],
    }, 'semester:1')).toEqual([
      {
        id: 'tab-1',
        type: 'world-clock',
        title: 'Clock',
        settings: { timezone: 'UTC' },
        order_index: 2,
        plugin_id: 'world-clock',
        availability: { state: 'available' },
      },
    ]);

    expect(resolveEnabledPluginIds({
      runtime_tabs: [],
      tab_catalog_items: [],
      widget_catalog_items: [],
      enabled_plugin_ids: [],
      enabled_plugins: [
        {
          plugin_id: 'world-clock',
          available_tab_types: [],
          available_widget_types: ['world-clock'],
          settings: {},
          resolved_settings: {},
        },
      ],
      available_widget_types: [],
    })).toEqual(new Set(['world-clock']));
  });
});
