// input:  [plugin id/context ids, plugin settings REST APIs, TanStack Query cache/mutations, auto-save scheduler, and JSON equality helpers]
// output: [`usePluginSharedSettings()` hook exposing framework-managed plugin-global settings state, shared caching, and debounced sync]
// pos:    [Shared plugin-settings persistence hook that loads one plugin/context record from query cache and syncs it through framework autosave]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { jsonDeepEqual } from '@/plugin-system/utils';
import api from '@/services/api';
import { reportError } from '@/services/appStatus';
import type { PluginSettingsSaveState } from '@/services/pluginSettingsRegistry';
import { queryKeys } from '@/services/queryKeys';

import { useAutoSave } from './useAutoSave';

interface UsePluginSharedSettingsOptions {
  pluginId: string;
  semesterId?: string;
  courseId?: string;
}

const EMPTY_SETTINGS: Record<string, unknown> = {};
const DEBOUNCE_MS = 300;
const MAX_WAIT_MS = 1500;

const parsePluginSettings = (rawSettings: string | undefined): Record<string, unknown> => {
  if (!rawSettings) return EMPTY_SETTINGS;
  try {
    const parsed = JSON.parse(rawSettings);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : EMPTY_SETTINGS;
  } catch (error) {
    console.warn('Failed to parse plugin shared settings', error);
    return EMPTY_SETTINGS;
  }
};

export const usePluginSharedSettings = ({
  pluginId,
  semesterId,
  courseId,
}: UsePluginSharedSettingsOptions) => {
  const queryClient = useQueryClient();
  const queryKey = semesterId
    ? queryKeys.semesters.pluginSettings(semesterId)
    : courseId
      ? queryKeys.courses.pluginSettings(courseId)
      : ['plugin-settings', 'disabled'] as const;

  const [settings, setSettings] = useState<Record<string, unknown>>(EMPTY_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<Record<string, unknown>>(EMPTY_SETTINGS);
  const [isDirty, setIsDirty] = useState(false);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  const pluginSettingsQuery = useQuery({
    queryKey,
    queryFn: async () => (
      semesterId
        ? api.getPluginSettingsForSemester(semesterId)
        : api.getPluginSettingsForCourse(courseId!)
    ),
    enabled: Boolean(pluginId) && Boolean(semesterId || courseId),
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async (snapshot: Record<string, unknown>) => {
      const payload = { settings: JSON.stringify(snapshot ?? EMPTY_SETTINGS) };
      return semesterId
        ? api.upsertPluginSettingsForSemester(semesterId, pluginId, payload)
        : api.upsertPluginSettingsForCourse(courseId!, pluginId, payload);
    },
  });

  useEffect(() => {
    if (!pluginId || (!semesterId && !courseId)) {
      setSettings(EMPTY_SETTINGS);
      setSavedSettings(EMPTY_SETTINGS);
      setIsDirty(false);
      return;
    }

    if (!pluginSettingsQuery.data) return;

    const match = pluginSettingsQuery.data.find((record) => record.plugin_id === pluginId);
    const parsed = parsePluginSettings(match?.settings);

    if (isDirty) return;

    setSavedSettings(parsed);
    setSettings(parsed);
  }, [courseId, isDirty, pluginId, pluginSettingsQuery.data, semesterId]);

  useEffect(() => {
    if (pluginSettingsQuery.error) {
      console.error(`Failed to load plugin shared settings for ${pluginId}`, pluginSettingsQuery.error);
      reportError('Failed to load plugin settings. Please retry.');
    }
  }, [pluginId, pluginSettingsQuery.error]);

  const updateQueryCache = useCallback((nextSettings: Record<string, unknown>) => {
    queryClient.setQueryData<Awaited<ReturnType<typeof api.getPluginSettingsForSemester>>>(queryKey, (current = []) => {
      const serialized = JSON.stringify(nextSettings ?? EMPTY_SETTINGS);
      const matchIndex = current.findIndex((record) => record.plugin_id === pluginId);

      if (matchIndex >= 0) {
        return current.map((record, index) => (
          index === matchIndex
            ? { ...record, settings: serialized }
            : record
        ));
      }

      return [
        ...current,
        {
          id: `optimistic:${pluginId}:${semesterId ?? courseId ?? 'context'}`,
          plugin_id: pluginId,
          settings: serialized,
          semester_id: semesterId,
          course_id: courseId,
        },
      ];
    });
  }, [courseId, pluginId, queryClient, queryKey, semesterId]);

  const updateSettings = useCallback((nextSettings: Record<string, unknown>) => {
    const normalized = nextSettings ?? EMPTY_SETTINGS;
    setSettings(normalized);
    setIsDirty(true);
    updateQueryCache(normalized);
  }, [updateQueryCache]);

  const { saveState, hasPendingChanges, flush } = useAutoSave({
    value: settings,
    savedValue: savedSettings,
    isEqual: jsonDeepEqual,
    enabled: !pluginSettingsQuery.isLoading && Boolean(pluginId) && Boolean(semesterId || courseId),
    debounceMs: DEBOUNCE_MS,
    maxWaitMs: MAX_WAIT_MS,
    onSave: async (snapshot) => {
      const response = await mutation.mutateAsync(snapshot ?? EMPTY_SETTINGS);
      queryClient.setQueryData<Awaited<ReturnType<typeof api.getPluginSettingsForSemester>>>(queryKey, (current = []) => {
        const withoutOptimistic = current.filter((record) => record.plugin_id !== pluginId);
        return [...withoutOptimistic, response].sort((left, right) => left.plugin_id.localeCompare(right.plugin_id));
      });
      setSavedSettings(parsePluginSettings(response.settings));
      setIsDirty(false);
    },
    onError: async (error) => {
      console.error(`Failed to sync plugin shared settings for ${pluginId}`, error);
      updateQueryCache(savedSettings);
      setSettings(savedSettings);
      setIsDirty(false);
      reportError('Failed to sync plugin settings. Please retry.');
    },
  });

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    return () => {
      void flushRef.current();
    };
  }, []);

  return {
    settings,
    updateSettings,
    saveState: saveState as PluginSettingsSaveState,
    hasPendingChanges,
    isLoading: pluginSettingsQuery.isLoading,
  };
};
