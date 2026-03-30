// input:  [plugin SDK settings helper and plugin settings section type]
// output: [empty plugin-global settings declaration for tab-template]
// pos:    [settings-section bundle kept alongside the plugin entry while tab instance settings live in runtime]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { definePluginSettings, type PluginSettingsSectionDefinition } from '@/plugin-sdk';

export default definePluginSettings({
  pluginSettings: [] satisfies PluginSettingsSectionDefinition[],
});
