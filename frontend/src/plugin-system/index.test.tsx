// input:  [plugin facade helpers, lazy runtime loading, idle background preloading, and Vitest assertions]
// output: [test suite covering plugin manifest icons, runtime instance settings resolution, eager plugin-global settings exposure, and idle preload behavior]
// pos:    [integration tests for the decoupled plugin-system public API and idle runtime warmup path]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it } from 'vitest';

import {
  canAddTabCatalogItem,
  ensureTabPluginByTypeLoaded,
  getTabPluginLoadState,
  getWidgetCatalog,
  getWidgetPluginLoadState,
  ensureWidgetPluginByTypeLoaded,
  getPluginSettingsSections,
  getPluginIconById,
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

  it('exposes plugin-level manifest icons without reading tab or widget catalogs', () => {
    expect(getPluginIconById('builtin-event-core')).toBeTruthy();
    expect(getPluginIconById('world-clock')).toBeTruthy();
  });

  it('treats maxInstances=0 builtin tabs as a single allowed instance', () => {
    const gradebookItem = getTabCatalog('course').find((item) => item.type === 'builtin-gradebook');
    expect(gradebookItem).toBeDefined();
    expect(canAddTabCatalogItem(gradebookItem!, 'course', 0)).toBe(true);
    expect(canAddTabCatalogItem(gradebookItem!, 'course', 1)).toBe(false);
  });

  it('preloads still-idle plugin runtimes after the page becomes idle', async () => {
    const idleTabTypes = getTabCatalog().map((item) => item.type);
    const idleWidgetTypes = getWidgetCatalog().map((item) => item.type);

    const stopPreloading = preloadRemainingPluginsWhenIdle();
    window.dispatchEvent(new Event('load'));
    await new Promise<void>((resolve) => setTimeout(resolve, 1200));
    stopPreloading();

    const loadedTab = idleTabTypes.some((type) => getTabPluginLoadState(type).status === 'loaded');
    const loadedWidget = idleWidgetTypes.some((type) => getWidgetPluginLoadState(type).status === 'loaded');

    expect(loadedTab || loadedWidget).toBe(true);
  });
});
