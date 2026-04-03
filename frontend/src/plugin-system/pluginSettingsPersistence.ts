// input:  [TanStack Query cache, tab-settings APIs, scope helpers]
// output: [persistence utilities for plugin settings CRUD — scope-aware API calls and query cache updates]
// pos:    [Internal plumbing layer for pluginSettingsFields.tsx that handles the settings read/write lifecycle]

import type { QueryClient } from "@tanstack/react-query";
import { setCourseDetailQueryData } from "@/data/resources/courses";
import { invalidateProgramDetailQuery, setProgramDetailQueryData } from "@/data/resources/programs";
import { setSemesterDetailQueryData } from "@/data/resources/semesters";
import api, { type Course, type Program, type Semester, type TabSetting } from "@/services/api";
import type { PluginSettingsScope } from "@/services/pluginSettingsRegistry";
import type { TabSettingsMeta } from "./tabSettingsMeta";

export type SettingsEntity = Program | Semester | Course;

export const parseSettingsObject = (value: unknown): Record<string, unknown> => {
  if (!value) {
    return {};
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
};

export const buildSettingsMeta = (tabSetting: TabSetting | null): TabSettingsMeta => ({
  scopeSettings: tabSetting?.scope_settings ?? {},
  inheritedSettings: tabSetting?.inherited_settings ?? {},
  settingSources: tabSetting?.setting_sources ?? {},
});

const upsertTabSetting = (
  tabSettings: TabSetting[] | undefined,
  nextTabSetting: TabSetting,
): TabSetting[] => {
  const current = [...(tabSettings ?? [])];
  const index = current.findIndex((entry) => entry.settings_key === nextTabSetting.settings_key);
  if (index >= 0) {
    current[index] = nextTabSetting;
    return current;
  }
  current.push(nextTabSetting);
  return current;
};

const updateSettingsEntity = (
  entity: SettingsEntity | null | undefined,
  nextTabSetting: TabSetting,
): SettingsEntity | null | undefined => {
  if (!entity) {
    return entity;
  }
  return {
    ...entity,
    tab_settings: upsertTabSetting(entity.tab_settings, nextTabSetting),
  };
};



export const applyScopeEntityUpdate = (
  queryClient: QueryClient,
  scope: PluginSettingsScope,
  nextTabSetting: TabSetting,
) => {
  if (scope.kind === "program") {
    setProgramDetailQueryData(queryClient, scope.programId, (current) => updateSettingsEntity(current, nextTabSetting) as Program | null | undefined);
    return;
  }
  if (scope.kind === "semester") {
    setSemesterDetailQueryData(queryClient, scope.semesterId, (current) => updateSettingsEntity(current, nextTabSetting) as Semester | null | undefined);
    return;
  }
  setCourseDetailQueryData(queryClient, scope.courseId, (current) => updateSettingsEntity(current, nextTabSetting) as Course | null | undefined);
};

export const persistScopeSettings = async (
  scope: PluginSettingsScope,
  settingsKey: string,
  nextSettings: Record<string, unknown>,
): Promise<TabSetting> => {
  const payload = { settings: JSON.stringify(nextSettings) };
  if (scope.kind === "program") {
    return api.upsertProgramTabSettings(scope.programId, settingsKey, payload);
  }
  if (scope.kind === "semester") {
    return api.upsertSemesterTabSettings(scope.semesterId, settingsKey, payload);
  }
  return api.upsertCourseTabSettings(scope.courseId, settingsKey, payload);
};

export const invalidateScopeQuery = async (
  queryClient: QueryClient,
  scope: PluginSettingsScope,
) => {
  if (scope.kind === "program") {
    await invalidateProgramDetailQuery(queryClient, scope.programId);
    return;
  }
  if (scope.kind === "semester") {
    await queryClient.invalidateQueries({ queryKey: ["semesters", "detail", scope.semesterId] });
    return;
  }
  await queryClient.invalidateQueries({ queryKey: ["courses", "detail", scope.courseId] });
};
