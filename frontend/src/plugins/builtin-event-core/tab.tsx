// input:  [event-core tab modules, tab registry contracts, and shared built-in tab type constants]
// output: [event-core tab components and `BuiltinTimetableTabDefinitions` runtime registrations]
// pos:    [tab-definition entry that keeps generic tab instance settings inside runtime definitions]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { TabDefinition, TabProps, TabSettingsProps } from '@/services/tabRegistry';
import {
  BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
  BUILTIN_TIMETABLE_COURSE_SCHEDULE_TAB_TYPE,
  BUILTIN_TIMETABLE_TODO_TAB_TYPE,
} from './shared/constants';
import { CalendarSettingsSection, CalendarTab } from './tabs/calendar';
import { CourseScheduleSettings, CourseScheduleTab } from './tabs/course-schedule';
import { TodoTab } from './tabs/todo';
import { TodoSettingsSection } from './tabs/todo/TodoSettingsSection';

const UnsupportedContextCard: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
  </Card>
);

const BuiltinAcademicCalendarTab: React.FC<TabProps> = ({ tabId, semesterId, settings, updateSettings }) => {
  if (!semesterId) {
    return (
      <UnsupportedContextCard
        title="Calendar"
        description="Semester context is required for the calendar tab."
      />
    );
  }

  return (
    <CalendarTab
      tabId={tabId}
      semesterId={semesterId}
      settings={settings}
      updateSettings={updateSettings}
    />
  );
};

const BuiltinCourseScheduleTab: React.FC<TabProps> = ({ courseId }) => {
  if (!courseId) {
    return (
      <UnsupportedContextCard
        title="Course Schedule"
        description="Course context is required for this tab."
      />
    );
  }

  return <CourseScheduleTab courseId={courseId} />;
};

const BuiltinTodoTab: React.FC<TabProps> = ({ settings, updateSettings, semesterId, courseId }) => {
  return (
    <TodoTab
      settings={settings}
      updateSettings={updateSettings}
      semesterId={semesterId}
      courseId={courseId}
    />
  );
};

const BuiltinAcademicCalendarTabSettings: React.FC<TabSettingsProps> = ({ semesterId, settings, updateSettings }) => {
  if (!semesterId) return null;
  return (
    <CalendarSettingsSection
      semesterId={semesterId}
      settings={settings}
      updateSettings={updateSettings}
    />
  );
};

const BuiltinCourseScheduleTabSettings: React.FC<TabSettingsProps> = ({ courseId }) => {
  if (!courseId) return null;
  return <CourseScheduleSettings courseId={courseId} />;
};

export const BuiltinAcademicCalendarTabDefinition: TabDefinition = {
  type: BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
  component: BuiltinAcademicCalendarTab,
  SettingsComponent: BuiltinAcademicCalendarTabSettings,
};

export const BuiltinCourseScheduleTabDefinition: TabDefinition = {
  type: BUILTIN_TIMETABLE_COURSE_SCHEDULE_TAB_TYPE,
  component: BuiltinCourseScheduleTab,
  SettingsComponent: BuiltinCourseScheduleTabSettings,
};

export const BuiltinTodoTabDefinition: TabDefinition = {
  type: BUILTIN_TIMETABLE_TODO_TAB_TYPE,
  component: BuiltinTodoTab,
  SettingsComponent: TodoSettingsSection,
};

export const BuiltinTimetableTabDefinitions: TabDefinition[] = [
  BuiltinAcademicCalendarTabDefinition,
  BuiltinCourseScheduleTabDefinition,
  BuiltinTodoTabDefinition,
];
