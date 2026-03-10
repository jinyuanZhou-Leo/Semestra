// input:  [plugin settings contract, plugin settings section type, and course-list plugin settings UI]
// output: [default plugin-global settings declaration for course-list]
// pos:    [eager settings entry that registers semester-scoped shared course management panels]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { definePluginSettings } from '@/plugin-system/contracts';
import type { PluginSettingsSectionDefinition } from '@/services/pluginSettingsRegistry';

import { CourseListGlobalSettings } from './globalSettings';

export default definePluginSettings({
  pluginSettings: [
    {
      id: 'course-list-management',
      component: CourseListGlobalSettings,
      allowedContexts: ['semester'],
    },
  ] satisfies PluginSettingsSectionDefinition[],
});
