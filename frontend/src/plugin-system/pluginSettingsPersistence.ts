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

type TabSettingsUpdater = (current: TabSetting[] | null | undefined) => TabSetting[] | null | undefined;

interface ScopeStrategy {
  upsert: (settingsKey: string, payload: { settings: string }) => Promise<TabSetting>;
  setQueryData: (queryClient: QueryClient, updater: TabSettingsUpdater) => void;
  queryKey: readonly unknown[];
}

// Per-scope plumbing collected in one place so the CRUD helpers below stay free
// of repeated `scope.kind` branching. Each branch wires the scope's own id into
// the matching API call, cache setter, and query key.
const getScopeStrategy = (scope: PluginSettingsScope): ScopeStrategy => {
  switch (scope.kind) {
    case "program":
      return {
        upsert: (settingsKey, payload) => api.upsertProgramTabSettings(scope.programId, settingsKey, payload),
        setQueryData: (queryClient, updater) => setProgramTabSettingsQueryData(queryClient, scope.programId, updater),
        queryKey: programKeys.tabSettings(scope.programId),
      };
    case "semester":
      return {
        upsert: (settingsKey, payload) => api.upsertSemesterTabSettings(scope.semesterId, settingsKey, payload),
        setQueryData: (queryClient, updater) => setSemesterTabSettingsQueryData(queryClient, scope.semesterId, updater),
        queryKey: semesterKeys.tabSettings(scope.semesterId),
      };
    case "course":
      return {
        upsert: (settingsKey, payload) => api.upsertCourseTabSettings(scope.courseId, settingsKey, payload),
        setQueryData: (queryClient, updater) => setCourseTabSettingsQueryData(queryClient, scope.courseId, updater),
        queryKey: courseKeys.tabSettings(scope.courseId),
      };
  }
};

export const applyScopeEntityUpdate = (
  queryClient: QueryClient,
  scope: PluginSettingsScope,
  nextTabSetting: TabSetting,
) => {
  getScopeStrategy(scope).setQueryData(queryClient, (current) => upsertTabSetting(current, nextTabSetting));
};

export const persistScopeSettings = async (
  scope: PluginSettingsScope,
  settingsKey: string,
  nextSettings: Record<string, unknown>,
): Promise<TabSetting> => {
  const payload = { settings: JSON.stringify(nextSettings) };
  return getScopeStrategy(scope).upsert(settingsKey, payload);
};

export const invalidateScopeQuery = (
  queryClient: QueryClient,
  scope: PluginSettingsScope,
): void => {
  // Mark stale so the next mount/focus refetch picks up the change, but do NOT trigger
  // an immediate background refetch. applyScopeEntityUpdate already wrote the API response
  // into the cache, so the UI is already up-to-date.
  queryClient.invalidateQueries({ queryKey: getScopeStrategy(scope).queryKey, refetchType: 'none' });
};

export const refetchScopeTabSettings = (
  queryClient: QueryClient,
  scope: PluginSettingsScope,
): void => {
  // Force an active refetch to roll back the cache to server truth after a failed write.
  queryClient.invalidateQueries({ queryKey: getScopeStrategy(scope).queryKey, refetchType: 'active' });
};
