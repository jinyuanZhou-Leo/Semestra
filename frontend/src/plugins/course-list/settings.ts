import type { TabSettingsDefinition, WidgetGlobalSettingsDefinition } from '@/services/pluginSettingsRegistry';

import { CourseListGlobalSettings } from './globalSettings';

export const tabSettingsDefinitions: TabSettingsDefinition[] = [];

export const widgetGlobalSettingsDefinitions: WidgetGlobalSettingsDefinition[] = [
  {
    type: 'course-list',
    component: CourseListGlobalSettings,
  },
];

