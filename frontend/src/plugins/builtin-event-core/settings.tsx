// input:  [plugin settings contract and plugin settings section type]
// output: [empty plugin-global settings declaration for builtin-event-core]
// pos:    [eager settings entry kept for stable plugin discovery without exposing host-coupled built-in behavior]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { definePluginSettings } from '@/plugin-system/contracts';
import type { PluginSettingsSectionDefinition } from '@/services/pluginSettingsRegistry';

export default definePluginSettings({
  pluginSettings: [] satisfies PluginSettingsSectionDefinition[],
});
