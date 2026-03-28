// input:  [runtime governance helpers, plugin ownership lookups, and Vitest assertions]
// output: [test suite covering tab/widget filtering against enabled plugin ids]
// pos:    [unit tests for Program/Semester runtime governance helper behavior]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it, vi } from 'vitest';

import * as pluginSystem from './index';
import { filterTabItemsByEnabledPlugins, filterWidgetItemsByEnabledPlugins } from './runtimeGovernance';

describe('runtimeGovernance filtering', () => {
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
});
