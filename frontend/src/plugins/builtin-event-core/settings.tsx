import React from 'react';

import type { TabSettingsProps } from '@/services/tabRegistry';
import type { TabSettingsDefinition, WidgetGlobalSettingsDefinition } from '@/services/pluginSettingsRegistry';

import {
  BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
  BUILTIN_TIMETABLE_COURSE_SCHEDULE_TAB_TYPE,
} from './shared/constants';
import { CalendarSettingsSection } from './tabs/calendar/CalendarSettingsSection';
import { CourseScheduleSettings } from './tabs/course-schedule';

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

export const tabSettingsDefinitions: TabSettingsDefinition[] = [
  {
    type: BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
    component: BuiltinAcademicCalendarSettings,
  },
  {
    type: BUILTIN_TIMETABLE_COURSE_SCHEDULE_TAB_TYPE,
    component: BuiltinCourseScheduleSettings,
  },
];

export const widgetGlobalSettingsDefinitions: WidgetGlobalSettingsDefinition[] = [];

