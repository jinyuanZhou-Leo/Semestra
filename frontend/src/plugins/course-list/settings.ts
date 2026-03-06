import { definePluginSettings } from '@/plugin-system/contracts';
import type { TabSettingsDefinition, WidgetGlobalSettingsDefinition } from '@/services/pluginSettingsRegistry';

import { CourseListGlobalSettings } from './globalSettings';

export default definePluginSettings({
  tabSettings: [] satisfies TabSettingsDefinition[],
  widgetGlobalSettings: [
    {
      type: 'course-list',
      component: CourseListGlobalSettings,
    },
  ] satisfies WidgetGlobalSettingsDefinition[],
});
