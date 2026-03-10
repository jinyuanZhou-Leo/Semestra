// input:  [plugin settings registry class, React component stubs, and Vitest assertions]
// output: [test suite covering plugin-global settings ordering, filtering, and replacement behavior]
// pos:    [unit tests for the plugin-global settings registry after the API decoupling cleanup]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from 'react';
import { describe, expect, it } from 'vitest';

import { PluginSettingsRegistryClass } from './pluginSettingsRegistry';

const NullSettingsSection: React.FC = () => null;

describe('PluginSettingsRegistryClass', () => {
  it('returns stable cached snapshot references for the same context', () => {
    const registry = new PluginSettingsRegistryClass();

    registry.registerPluginSettingsMany('plugin-alpha', [
      {
        id: 'shared',
        component: NullSettingsSection,
      },
      {
        id: 'semester-only',
        component: NullSettingsSection,
        allowedContexts: ['semester'],
      },
    ]);

    const firstAll = registry.getAllPluginSettingsSections();
    const secondAll = registry.getAllPluginSettingsSections();
    const firstSemester = registry.getAllPluginSettingsSections('semester');
    const secondSemester = registry.getAllPluginSettingsSections('semester');
    const firstCourse = registry.getAllPluginSettingsSections('course');
    const secondCourse = registry.getAllPluginSettingsSections('course');

    expect(secondAll).toBe(firstAll);
    expect(secondSemester).toBe(firstSemester);
    expect(secondCourse).toBe(firstCourse);
  });

  it('preserves plugin and section order while filtering by context', () => {
    const registry = new PluginSettingsRegistryClass();

    registry.registerPluginSettingsMany('plugin-alpha', [
      {
        id: 'shared',
        component: NullSettingsSection,
      },
      {
        id: 'semester-only',
        component: NullSettingsSection,
        allowedContexts: ['semester'],
      },
    ]);
    registry.registerPluginSettingsMany('plugin-beta', [
      {
        id: 'course-only',
        component: NullSettingsSection,
        allowedContexts: ['course'],
      },
    ]);

    expect(
      registry.getAllPluginSettingsSections('semester').map(({ pluginId, id }) => `${pluginId}:${id}`)
    ).toEqual([
      'plugin-alpha:shared',
      'plugin-alpha:semester-only',
    ]);

    expect(
      registry.getAllPluginSettingsSections('course').map(({ pluginId, id }) => `${pluginId}:${id}`)
    ).toEqual([
      'plugin-alpha:shared',
      'plugin-beta:course-only',
    ]);
  });

  it('replaces earlier registrations for the same plugin, including clearing sections', () => {
    const registry = new PluginSettingsRegistryClass();

    registry.registerPluginSettingsMany('plugin-alpha', [
      {
        id: 'first',
        component: NullSettingsSection,
      },
    ]);
    registry.registerPluginSettingsMany('plugin-alpha', [
      {
        id: 'second',
        component: NullSettingsSection,
      },
    ]);

    expect(
      registry.getAllPluginSettingsSections().map(({ pluginId, id }) => `${pluginId}:${id}`)
    ).toEqual(['plugin-alpha:second']);

    registry.registerPluginSettingsMany('plugin-alpha', []);

    expect(registry.getAllPluginSettingsSections()).toEqual([]);
  });
});
