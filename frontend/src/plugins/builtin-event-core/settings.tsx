// input:  [event-core tab settings sections, public plugin-system settings contracts, Program detail query data, and shared todo settings component]
// output: [calendar, course-schedule, and todo tab settings components plus Program and Semester scoped plugin settings sections]
// pos:    [settings entry that centralizes builtin-event-core tab settings UI while exposing Program-level todo defaults and Semester-level event-type defaults through the shared settings-section contract]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from 'react';

import { definePluginSettings, usePluginSettingsBucket, type PluginSettingsSectionProps } from '@/plugin-sdk';
import type { TabSettingsProps } from '@/services/tabRegistry';

import { CalendarSettingsSection } from './tabs/calendar/CalendarSettingsSection';
import { CourseScheduleSettings } from './tabs/course-schedule';
import { TodoSettingsSection } from './tabs/todo/TodoSettingsSection';
import { BUILTIN_TIMETABLE_TODO_TAB_TYPE } from './shared/constants';

export const BuiltinAcademicCalendarTabSettings: React.FC<TabSettingsProps> = ({
  semesterId,
  settings,
  updateSettings,
}) => {
  if (!semesterId) return null;
  return (
    <CalendarSettingsSection
      semesterId={semesterId}
      settings={settings}
      updateSettings={updateSettings}
    />
  );
};

export const BuiltinCourseScheduleTabSettings: React.FC<TabSettingsProps> = ({ courseId }) => {
  if (!courseId) return null;
  return <CourseScheduleSettings courseId={courseId} />;
};

const SemesterEventTypesSettingsSection: React.FC<PluginSettingsSectionProps> = ({
  scope,
}) => {
  if (scope.kind !== 'semester') {
    return null;
  }
  return <CourseScheduleSettings semesterId={scope.semesterId} />;
};

const ProgramTodoDefaultsSettingsSection: React.FC<PluginSettingsSectionProps> = ({
  scope,
}) => {
  const programId = scope.kind === 'program' ? scope.programId : undefined;
  const bucket = usePluginSettingsBucket(BUILTIN_TIMETABLE_TODO_TAB_TYPE);

  const handleUpdateSettings = React.useCallback(async (nextSettings: Record<string, unknown>) => {
    if (!programId) return;
    try {
      await bucket.setSettings(nextSettings);
    } catch (error: unknown) {
      // toast is already shown by the bucket's setSettings
      console.error('Failed to update todo defaults', error);
    }
  }, [bucket, programId]);

  if (!programId) {
    return null;
  }

  return (
    <TodoSettingsSection
      tabId={BUILTIN_TIMETABLE_TODO_TAB_TYPE}
      settings={bucket.resolvedSettings}
      updateSettings={handleUpdateSettings}
    />
  );
};

export { TodoSettingsSection };

export default definePluginSettings({
  pluginSettings: [
    {
      id: 'todo-defaults',
      component: ProgramTodoDefaultsSettingsSection,
      allowedContexts: ['program'],
    },
    {
      id: 'semester-event-types',
      component: SemesterEventTypesSettingsSection,
      allowedContexts: ['semester'],
    },
  ],
});
