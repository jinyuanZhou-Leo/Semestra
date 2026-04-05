// input:  [event-core tab modules, public plugin-system tab contracts, settings entry exports, and shared built-in tab type constants]
// output: [event-core tab components and `BuiltinTimetableTabDefinitions` runtime registrations]
// pos:    [tab-definition entry that wires event-core tabs to settings owned by the plugin settings entry]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { TabDefinition, TabProps } from '@/plugin-system';
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

const BuiltinAcademicCalendarTab: React.FC<TabProps> = (props) => {
  const { semesterId } = props;
  if (!semesterId) {
    return (
      <UnsupportedContextCard
        title="Calendar"
        description="Semester context is required for the calendar tab."
      />
    );
  }

  // CalendarTab reads its own settings via usePluginSettingsBucketWithScope — no
  // settings/updateSettings forwarding required. The host TabProps.settings value
  // (from useDashboardTabs runtime-tabs state) is intentionally ignored here; the
  // plugin bucket is the single source of truth for calendar settings.
  return <CalendarTab {...props} />;
};

const BuiltinCourseScheduleTab: React.FC<TabProps> = ({ courseId, semesterId }) => {
  if (!courseId) {
    return (
      <UnsupportedContextCard
        title="Course Schedule"
        description="Course context is required for this tab."
      />
    );
  }

  return <CourseScheduleTab courseId={courseId} semesterId={semesterId} />;
};

const BuiltinTodoTab: React.FC<TabProps> = ({ semesterId, courseId }) => {
  return (
    <TodoTab
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
