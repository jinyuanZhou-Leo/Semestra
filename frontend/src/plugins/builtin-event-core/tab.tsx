import React from 'react';
import { CalendarDays, ListTodo, NotebookPen } from 'lucide-react';
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

const BuiltinTodoTab: React.FC<TabProps> = () => {
  return <TodoTab />;
};

export const BuiltinAcademicCalendarTabDefinition: TabDefinition = {
  type: BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
  name: 'Calendar',
  description: 'Semester calendar with schedule visualization',
  icon: <CalendarDays className="h-4 w-4" />,
  component: BuiltinAcademicCalendarTab,
  maxInstances: 1,
  allowedContexts: ['semester'],
};

export const BuiltinCourseScheduleTabDefinition: TabDefinition = {
  type: BUILTIN_TIMETABLE_COURSE_SCHEDULE_TAB_TYPE,
  name: 'Course Schedule',
  description: 'Manage course sections, event types, and recurring slot rules',
  icon: <NotebookPen className="h-4 w-4" />,
  component: BuiltinCourseScheduleTab,
  maxInstances: 1,
  allowedContexts: ['course'],
};

export const BuiltinTodoTabDefinition: TabDefinition = {
  type: BUILTIN_TIMETABLE_TODO_TAB_TYPE,
  name: 'Todo',
  description: 'Todo integration surface reserved for the upcoming phase',
  icon: <ListTodo className="h-4 w-4" />,
  component: BuiltinTodoTab,
  maxInstances: 1,
  allowedContexts: ['semester', 'course'],
};

export const BuiltinTimetableTabDefinitions: TabDefinition[] = [
  BuiltinAcademicCalendarTabDefinition,
  BuiltinCourseScheduleTabDefinition,
  BuiltinTodoTabDefinition,
];
