// input:  [plugin settings registry helpers, builtin calendar source registration, and tab settings components]
// output: [default plugin settings declaration for builtin-event-core]
// pos:    [settings entrypoint that exposes builtin tab settings while ensuring Calendar sources are registered]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';

import { definePluginSettings } from '@/plugin-system/contracts';
import type { TabSettingsProps } from '@/services/tabRegistry';
import type { TabSettingsDefinition, WidgetGlobalSettingsDefinition } from '@/services/pluginSettingsRegistry';

import {
  BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
  BUILTIN_TIMETABLE_COURSE_SCHEDULE_TAB_TYPE,
  BUILTIN_TIMETABLE_TODO_TAB_TYPE,
} from './shared/constants';
import { CalendarSettingsSection } from './tabs/calendar/CalendarSettingsSection';
import { ensureBuiltinCalendarSourcesRegistered } from './tabs/calendar/sources/registerBuiltinCalendarSources';
import { CourseScheduleSettings } from './tabs/course-schedule';
import { TodoSettingsSection } from './tabs/todo/TodoSettingsSection';

ensureBuiltinCalendarSourcesRegistered();

const BuiltinAcademicCalendarSettings: React.FC<TabSettingsProps> = ({ semesterId, settings, updateSettings }) => {
  if (!semesterId) return null;
  return (
    <CalendarSettingsSection
      semesterId={semesterId}
      settings={settings}
      updateSettings={updateSettings}
    />
  );
};

const BuiltinCourseScheduleSettings: React.FC<TabSettingsProps> = ({ courseId }) => {
  if (!courseId) return null;
  return <CourseScheduleSettings courseId={courseId} />;
};

export default definePluginSettings({
  tabSettings: [
    {
      type: BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
      component: BuiltinAcademicCalendarSettings,
    },
    {
      type: BUILTIN_TIMETABLE_COURSE_SCHEDULE_TAB_TYPE,
      component: BuiltinCourseScheduleSettings,
    },
    {
      type: BUILTIN_TIMETABLE_TODO_TAB_TYPE,
      component: TodoSettingsSection,
    },
  ] satisfies TabSettingsDefinition[],
  widgetGlobalSettings: [] satisfies WidgetGlobalSettingsDefinition[],
});
