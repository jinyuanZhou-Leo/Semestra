import React from 'react';
import { CalendarDays } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { TabDefinition, TabProps, TabSettingsProps } from '@/services/tabRegistry';
import { BUILTIN_TIMETABLE_TAB_TYPE } from './shared/constants';
import { CalendarTab } from './tabs/calendar';
import { CalendarSettingsSection } from './tabs/calendar/CalendarSettingsSection';
import { CourseScheduleSettings, CourseScheduleTab } from './tabs/course-schedule';

const BuiltinAcademicTimetableTabComponent: React.FC<TabProps> = ({ courseId, semesterId, settings, updateSettings, tabId }) => {
  if (courseId) {
    return <CourseScheduleTab courseId={courseId} />;
  }

  if (semesterId) {
    return (
      <CalendarTab
        tabId={tabId}
        settings={settings}
        semesterId={semesterId}
        updateSettings={updateSettings}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Academic Timetable</CardTitle>
        <CardDescription>No context available for this tab.</CardDescription>
      </CardHeader>
    </Card>
  );
};

const BuiltinAcademicTimetableSettingsComponent: React.FC<TabSettingsProps> = ({
  courseId,
  semesterId,
  settings,
  updateSettings,
}) => {
  if (courseId) {
    return <CourseScheduleSettings courseId={courseId} />;
  }
  if (semesterId) {
    return (
      <CalendarSettingsSection
        semesterId={semesterId}
        settings={settings}
        updateSettings={updateSettings}
      />
    );
  }
  return null;
};

export const BuiltinAcademicTimetableTabDefinition: TabDefinition = {
  type: BUILTIN_TIMETABLE_TAB_TYPE,
  name: 'Timetable',
  description: 'Academic timetable planner for course and semester schedules',
  icon: <CalendarDays className="h-4 w-4" />,
  component: BuiltinAcademicTimetableTabComponent,
  settingsComponent: BuiltinAcademicTimetableSettingsComponent,
  maxInstances: 1,
  allowedContexts: ['semester', 'course'],
};

export const BuiltinAcademicTimetableTab = BuiltinAcademicTimetableTabComponent;
