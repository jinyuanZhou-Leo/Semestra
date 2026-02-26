"use no memo";

import React from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { TabDefinition, TabProps } from '@/services/tabRegistry';
import {
  BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
  BUILTIN_TIMETABLE_COURSE_SCHEDULE_TAB_TYPE,
  BUILTIN_TIMETABLE_TODO_TAB_TYPE,
} from './shared/constants';
import { CalendarTab } from './tabs/calendar';
import { CourseScheduleTab } from './tabs/course-schedule';
import { TodoTab } from './tabs/todo';

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

export const BuiltinAcademicCalendarTabDefinition: TabDefinition = {
  type: BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
  component: BuiltinAcademicCalendarTab,
};

export const BuiltinCourseScheduleTabDefinition: TabDefinition = {
  type: BUILTIN_TIMETABLE_COURSE_SCHEDULE_TAB_TYPE,
  component: BuiltinCourseScheduleTab,
};

export const BuiltinTodoTabDefinition: TabDefinition = {
  type: BUILTIN_TIMETABLE_TODO_TAB_TYPE,
  component: BuiltinTodoTab,
};

export const BuiltinTimetableTabDefinitions: TabDefinition[] = [
  BuiltinAcademicCalendarTabDefinition,
  BuiltinCourseScheduleTabDefinition,
  BuiltinTodoTabDefinition,
];
