// input:  [plugin id/context ids, plugin settings REST APIs, Program plugin-installation settings snapshots, TanStack Query cache/mutations, auto-save scheduler, and JSON equality helpers]
// output: [`usePluginSharedSettings()` hook exposing framework-managed plugin-global settings state, shared caching, and debounced sync]
// pos:    [Shared plugin-settings persistence hook that seeds from resolved runtime config, loads one plugin/context record from query cache, and syncs editable state through framework autosave for Program, Semester, and Course settings]
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
  programId?: string;
  semesterId?: string;
  courseId?: string;
  initialSettings?: Record<string, unknown>;
}

const EMPTY_SETTINGS: Record<string, unknown> = {};
const DEBOUNCE_MS = 300;
const MAX_WAIT_MS = 1500;

type ProgramPluginInstallationRecord = Awaited<ReturnType<typeof api.getProgramPluginInstallations>>[number];
type ContextPluginSettingRecord = Awaited<ReturnType<typeof api.getPluginSettingsForSemester>>[number];

const parsePluginSettings = (rawSettings: string | Record<string, unknown> | undefined): Record<string, unknown> => {
  if (!rawSettings) return EMPTY_SETTINGS;
  if (Array.isArray(rawSettings)) {
    return EMPTY_SETTINGS;
  }
  if (typeof rawSettings === 'object' && !Array.isArray(rawSettings)) {
    return rawSettings;
  }
  if (typeof rawSettings !== 'string') {
    return EMPTY_SETTINGS;
  }
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
  programId,
  semesterId,
  courseId,
  initialSettings,
}: UsePluginSharedSettingsOptions) => {
  const queryClient = useQueryClient();
  const queryKey = programId
    ? queryKeys.programs.pluginInstallations(programId)
    : semesterId
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
      programId
        ? api.getProgramPluginInstallations(programId)
        : semesterId
        ? api.getPluginSettingsForSemester(semesterId)
        : api.getPluginSettingsForCourse(courseId!)
    ),
    enabled: Boolean(pluginId) && Boolean(programId || semesterId || courseId),
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async (snapshot: Record<string, unknown>) => {
      if (programId) {
        return api.upsertProgramPluginInstallation(programId, pluginId, {
          program_settings: snapshot ?? EMPTY_SETTINGS,
        });
      }
      const payload = { settings: JSON.stringify(snapshot ?? EMPTY_SETTINGS) };
      return semesterId
        ? api.upsertPluginSettingsForSemester(semesterId, pluginId, payload)
        : api.upsertPluginSettingsForCourse(courseId!, pluginId, payload);
    },
  });

  useEffect(() => {
    if (!pluginId || (!programId && !semesterId && !courseId)) {
      setSettings(EMPTY_SETTINGS);
      setSavedSettings(EMPTY_SETTINGS);
      setIsDirty(false);
      return;
    }

    if (!pluginSettingsQuery.data) return;

    const match = pluginSettingsQuery.data.find((record) => record.plugin_id === pluginId);
    const parsed = programId
      ? parsePluginSettings(
        (match as ProgramPluginInstallationRecord | undefined)?.resolved_program_settings
          ?? (match as ProgramPluginInstallationRecord | undefined)?.program_settings,
      )
      : parsePluginSettings(
        (match as ContextPluginSettingRecord | undefined)?.resolved_settings
          ?? (match as ContextPluginSettingRecord | undefined)?.settings,
      );

    if (isDirty) return;

    setSavedSettings(parsed);
    setSettings(parsed);
  }, [courseId, isDirty, pluginId, pluginSettingsQuery.data, programId, semesterId]);

  useEffect(() => {
    if (!pluginId || isDirty) return;
    if (pluginSettingsQuery.data && pluginSettingsQuery.data.some((record) => record.plugin_id === pluginId)) {
      return;
    }
    if (!initialSettings) return;

    setSavedSettings(initialSettings);
    setSettings(initialSettings);
  }, [initialSettings, isDirty, pluginId, pluginSettingsQuery.data]);

  useEffect(() => {
    if (pluginSettingsQuery.error) {
      console.error(`Failed to load plugin shared settings for ${pluginId}`, pluginSettingsQuery.error);
      reportError('Failed to load plugin settings. Please retry.');
    }
  }, [pluginId, pluginSettingsQuery.error]);

  const updateQueryCache = useCallback((nextSettings: Record<string, unknown>) => {
      if (programId) {
        queryClient.setQueryData<Awaited<ReturnType<typeof api.getProgramPluginInstallations>>>(queryKey, (current = []) => (
          current.map((record): ProgramPluginInstallationRecord => (
            record.plugin_id === pluginId
              ? {
                ...record,
                program_settings: nextSettings,
                resolved_program_settings: nextSettings,
            }
            : record
        ))
      ));
      return;
    }

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
  }, [courseId, pluginId, programId, queryClient, queryKey, semesterId]);

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
    enabled: !pluginSettingsQuery.isLoading && Boolean(pluginId) && Boolean(programId || semesterId || courseId),
    debounceMs: DEBOUNCE_MS,
    maxWaitMs: MAX_WAIT_MS,
    onSave: async (snapshot) => {
      const response = await mutation.mutateAsync(snapshot ?? EMPTY_SETTINGS);
      if (programId) {
        queryClient.setQueryData<Awaited<ReturnType<typeof api.getProgramPluginInstallations>>>(queryKey, (current = []) => (
          current.map((record): ProgramPluginInstallationRecord => (
            record.plugin_id === pluginId ? response as ProgramPluginInstallationRecord : record
          ))
        ));
        setSavedSettings(parsePluginSettings((response as ProgramPluginInstallationRecord).program_settings));
      } else {
        queryClient.setQueryData<Awaited<ReturnType<typeof api.getPluginSettingsForSemester>>>(queryKey, (current = []) => {
          const withoutOptimistic = current.filter((record) => record.plugin_id !== pluginId);
          return [...withoutOptimistic, response as ContextPluginSettingRecord].sort((left, right) => left.plugin_id.localeCompare(right.plugin_id));
        });
        setSavedSettings(parsePluginSettings((response as ContextPluginSettingRecord).settings));
      }
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
