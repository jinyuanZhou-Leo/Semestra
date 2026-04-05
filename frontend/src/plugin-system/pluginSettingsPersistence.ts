// input:  [TanStack Query cache, tab-settings APIs, scope helpers, and dedicated tab-settings cache setters]
// output: [persistence utilities for plugin settings CRUD — scope-aware API calls and query cache updates]
// pos:    [Internal plumbing layer for pluginSettingsFields.tsx that handles the settings read/write lifecycle]

import type { QueryClient } from "@tanstack/react-query";
import { setCourseTabSettingsQueryData } from "@/data/resources/courses";
import { setProgramTabSettingsQueryData } from "@/data/resources/programs";
import { setSemesterTabSettingsQueryData } from "@/data/resources/semesters";
import { courseKeys } from "@/data/keys/courses";
import { programKeys } from "@/data/keys/programs";
import { semesterKeys } from "@/data/keys/semesters";
import api, { type TabSetting } from "@/services/api";
import type { PluginSettingsScope } from "@/services/pluginSettingsRegistry";
import type { TabSettingsMeta } from "./tabSettingsMeta";

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
  current: TabSetting[] | null | undefined,
  nextTabSetting: TabSetting,
): TabSetting[] => {
  const list = [...(current ?? [])];
  const index = list.findIndex((entry) => entry.settings_key === nextTabSetting.settings_key);
  if (index >= 0) {
    list[index] = nextTabSetting;
    return list;
  }
  list.push(nextTabSetting);
  return list;
};

export const applyScopeEntityUpdate = (
  queryClient: QueryClient,
  scope: PluginSettingsScope,
  nextTabSetting: TabSetting,
) => {
  if (scope.kind === "program") {
    setProgramTabSettingsQueryData(queryClient, scope.programId, (current) => upsertTabSetting(current, nextTabSetting));
    return;
  }
  if (scope.kind === "semester") {
    setSemesterTabSettingsQueryData(queryClient, scope.semesterId, (current) => upsertTabSetting(current, nextTabSetting));
    return;
  }
  setCourseTabSettingsQueryData(queryClient, scope.courseId, (current) => upsertTabSetting(current, nextTabSetting));
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

export const invalidateScopeQuery = (
  queryClient: QueryClient,
  scope: PluginSettingsScope,
): void => {
  // Mark stale so the next mount/focus refetch picks up the change, but do NOT trigger
  // an immediate background refetch. applyScopeEntityUpdate already wrote the API response
  // into the cache, so the UI is already up-to-date.
  if (scope.kind === "program") {
    queryClient.invalidateQueries({ queryKey: programKeys.tabSettings(scope.programId), refetchType: 'none' });
    return;
  }
  if (scope.kind === "semester") {
    queryClient.invalidateQueries({ queryKey: semesterKeys.tabSettings(scope.semesterId), refetchType: 'none' });
    return;
  }
  queryClient.invalidateQueries({ queryKey: courseKeys.tabSettings(scope.courseId), refetchType: 'none' });
};

export const refetchScopeTabSettings = (
  queryClient: QueryClient,
  scope: PluginSettingsScope,
): void => {
  // Force an active refetch to roll back the cache to server truth after a failed write.
  if (scope.kind === "program") {
    queryClient.invalidateQueries({ queryKey: programKeys.tabSettings(scope.programId), refetchType: 'active' });
    return;
  }
  if (scope.kind === "semester") {
    queryClient.invalidateQueries({ queryKey: semesterKeys.tabSettings(scope.semesterId), refetchType: 'active' });
    return;
  }
  queryClient.invalidateQueries({ queryKey: courseKeys.tabSettings(scope.courseId), refetchType: 'active' });
};
