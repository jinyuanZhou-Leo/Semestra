// input:  [gradebook descriptor, existing settings sections export, frontend plugin SDK, and lazy runtime loader]
// output: [default-exported descriptor-backed gradebook plugin definition]
// pos:    [builtin plugin entry that binds JSON metadata to runtime loading and course settings sections]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { definePlugin, defineSettingsSection, type PluginDescriptor } from '@/plugin-sdk';

import descriptorJson from './plugin.json';
import settingsDefinition from './settings';

const descriptor = descriptorJson as PluginDescriptor;

export default definePlugin({
  descriptor,
  loadRuntime: async () => (await import('./index')).default,
  settingsSections: (settingsDefinition.pluginSettings ?? []).map((definition) => defineSettingsSection(definition)),
});
