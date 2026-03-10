// input:  [plugin facade helpers, lazy runtime loading, and Vitest assertions]
// output: [test suite covering runtime instance settings resolution and eager plugin-global settings exposure]
// pos:    [integration tests for the decoupled plugin-system public settings API]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it } from 'vitest';

import {
  ensureTabPluginByTypeLoaded,
  ensureWidgetPluginByTypeLoaded,
  getPluginSettingsSections,
  getTabSettingsComponentByType,
  getWidgetSettingsComponentByType,
} from './index';

describe('plugin-system settings API', () => {
  it('resolves tab and widget instance settings components from runtime definitions', async () => {
    await expect(ensureTabPluginByTypeLoaded('tab-template')).resolves.toBe(true);
    await expect(ensureWidgetPluginByTypeLoaded('world-clock')).resolves.toBe(true);

    expect(getTabSettingsComponentByType('tab-template')).toBeTypeOf('function');
    expect(getWidgetSettingsComponentByType('world-clock')).toBeTypeOf('function');
  });

  it('exposes eager plugin-global settings sections through the facade', () => {
    expect(
      getPluginSettingsSections('semester').map(({ pluginId, id }) => `${pluginId}:${id}`)
    ).toContain('course-list:course-list-management');

    expect(
      getPluginSettingsSections('course').map(({ pluginId, id }) => `${pluginId}:${id}`)
    ).not.toContain('course-list:course-list-management');
  });
});
