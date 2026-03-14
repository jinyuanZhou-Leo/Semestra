// input:  [plugin facade helpers, lazy runtime loading, idle background preloading, and Vitest assertions]
// output: [test suite covering runtime instance settings resolution, eager plugin-global settings exposure, and idle preload behavior]
// pos:    [integration tests for the decoupled plugin-system public settings API and idle runtime warmup path]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it } from 'vitest';

import {
  canAddTabCatalogItem,
  ensureTabPluginByTypeLoaded,
  ensureWidgetPluginByTypeLoaded,
  getPluginSettingsSections,
  getTabComponentByType,
  getTabSettingsComponentByType,
  getTabCatalog,
  getWidgetSettingsComponentByType,
  preloadRemainingPluginsWhenIdle,
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

  it('treats maxInstances=0 builtin tabs as a single allowed instance', () => {
    const gradebookItem = getTabCatalog('course').find((item) => item.type === 'builtin-gradebook');
    expect(gradebookItem).toBeDefined();
    expect(canAddTabCatalogItem(gradebookItem!, 'course', 0)).toBe(true);
    expect(canAddTabCatalogItem(gradebookItem!, 'course', 1)).toBe(false);
  });

  it('preloads still-idle plugin runtimes after the page becomes idle', async () => {
    expect(getTabComponentByType('dashboard')).toBeUndefined();

    const stopPreloading = preloadRemainingPluginsWhenIdle();
    window.dispatchEvent(new Event('load'));
    await new Promise<void>((resolve) => setTimeout(resolve, 600));
    stopPreloading();

    expect(getTabComponentByType('dashboard')).toBeTruthy();
  });
});
