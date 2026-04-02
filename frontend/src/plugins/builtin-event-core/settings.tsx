// input:  [event-core tab settings sections, public plugin-system settings contracts, Program detail query data, and shared todo settings component]
// output: [calendar, course-schedule, and todo tab settings components plus Program and Semester scoped plugin settings sections]
// pos:    [settings entry that centralizes builtin-event-core tab settings UI while exposing Program-level todo defaults and Semester-level event-type defaults through the shared settings-section contract]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { getProgramDetailQueryOptions, invalidateProgramDetailQuery } from '@/data/resources';
import { definePluginSettings, type PluginSettingsSectionProps } from '@/plugin-sdk';
import api from '@/services/api';
import type { TabSettingsProps } from '@/services/tabRegistry';

import { CalendarSettingsSection } from './tabs/calendar/CalendarSettingsSection';
import { CourseScheduleSettings } from './tabs/course-schedule';
import { TodoSettingsSection } from './tabs/todo/TodoSettingsSection';
import { getApiErrorMessage } from '../builtin-gradebook/shared';
import { BUILTIN_TIMETABLE_TODO_TAB_TYPE } from './shared/constants';

export const BuiltinAcademicCalendarTabSettings: React.FC<TabSettingsProps> = ({
  semesterId,
  settings,
  settingsMeta,
  updateSettings,
  resetSetting,
}) => {
  if (!semesterId) return null;
  return (
    <CalendarSettingsSection
      semesterId={semesterId}
      settings={settings}
      settingsMeta={settingsMeta}
      updateSettings={updateSettings}
      resetSetting={resetSetting}
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
  onRefresh,
}) => {
  const queryClient = useQueryClient();
  const programId = scope.kind === 'program' ? scope.programId : undefined;
  const programQuery = getProgramDetailQueryOptions(programId ?? '__missing__');
  const program = queryClient.getQueryData<Awaited<ReturnType<typeof api.getProgram>>>(programQuery.queryKey);

  const initialSettings = React.useMemo(() => {
    if (!programId || !program?.tab_settings) {
      return {};
    }
    const todoTabSetting = program.tab_settings.find((setting) => setting.settings_key === BUILTIN_TIMETABLE_TODO_TAB_TYPE);
    if (!todoTabSetting?.resolved_settings && !todoTabSetting?.settings) {
      return {};
    }
    if (typeof todoTabSetting.resolved_settings === 'object' && todoTabSetting.resolved_settings !== null) {
      return todoTabSetting.resolved_settings;
    }
    try {
      return JSON.parse(todoTabSetting.settings || '{}');
    } catch {
      return {};
    }
  }, [program?.tab_settings, programId]);
  const todoTabSetting = React.useMemo(() => {
    if (!programId || !program?.tab_settings) {
      return null;
    }
    return program.tab_settings.find((setting) => setting.settings_key === BUILTIN_TIMETABLE_TODO_TAB_TYPE) ?? null;
  }, [program?.tab_settings, programId]);

  const handleUpdateSettings = React.useCallback(async (nextSettings: Record<string, unknown>) => {
    if (!programId) return;
    try {
      await api.updateProgramTabSettings(programId, BUILTIN_TIMETABLE_TODO_TAB_TYPE, {
        settings: JSON.stringify(nextSettings),
      });
      await invalidateProgramDetailQuery(queryClient, programId);
      onRefresh();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error));
    }
  }, [onRefresh, programId, queryClient]);

    if (!programId) {
      return null;
    }

  return (
    <TodoSettingsSection
      tabId={BUILTIN_TIMETABLE_TODO_TAB_TYPE}
      settings={initialSettings}
      settingsMeta={todoTabSetting ? {
        scopeSettings: todoTabSetting.scope_settings ?? {},
        inheritedSettings: todoTabSetting.inherited_settings ?? {},
        settingSources: todoTabSetting.setting_sources ?? {},
      } : undefined}
      updateSettings={handleUpdateSettings}
      resetSetting={async (key) => {
        if (!programId) return;
        const nextSettings = {
          ...(todoTabSetting?.scope_settings ?? {}),
        };
        delete nextSettings[key];
        await handleUpdateSettings(nextSettings);
      }}
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
