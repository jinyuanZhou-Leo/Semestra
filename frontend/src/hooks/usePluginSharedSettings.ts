// input:  [plugin id/context ids, plugin settings REST APIs, auto-save scheduler, and JSON equality helpers]
// output: [`usePluginSharedSettings()` hook exposing framework-managed plugin-global settings state and debounced sync]
// pos:    [Shared plugin-settings persistence hook that loads one plugin/context record and syncs it through framework autosave]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import { useCallback, useEffect, useRef, useState } from 'react';

import { jsonDeepEqual } from '@/plugin-system/utils';
import api from '@/services/api';
import { reportError } from '@/services/appStatus';
import type { PluginSettingsSaveState } from '@/services/pluginSettingsRegistry';

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
  const [settings, setSettings] = useState<Record<string, unknown>>(EMPTY_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<Record<string, unknown>>(EMPTY_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (!pluginId || (!semesterId && !courseId)) {
      requestSeqRef.current += 1;
      setSettings(EMPTY_SETTINGS);
      setSavedSettings(EMPTY_SETTINGS);
      setIsLoading(false);
      return;
    }

    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    setIsLoading(true);

    const loadSettings = async () => {
      try {
        const records = semesterId
          ? await api.getPluginSettingsForSemester(semesterId)
          : await api.getPluginSettingsForCourse(courseId!);
        if (requestSeqRef.current !== requestSeq) return;
        const match = records.find((record) => record.plugin_id === pluginId);
        const parsed = parsePluginSettings(match?.settings);
        setSettings(parsed);
        setSavedSettings(parsed);
      } catch (error) {
        if (requestSeqRef.current !== requestSeq) return;
        console.error(`Failed to load plugin shared settings for ${pluginId}`, error);
        reportError('Failed to load plugin settings. Please retry.');
        setSettings(EMPTY_SETTINGS);
        setSavedSettings(EMPTY_SETTINGS);
      } finally {
        if (requestSeqRef.current === requestSeq) {
          setIsLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      requestSeqRef.current += 1;
    };
  }, [courseId, pluginId, semesterId]);

  const updateSettings = useCallback((nextSettings: Record<string, unknown>) => {
    setSettings(nextSettings ?? EMPTY_SETTINGS);
  }, []);

  const { saveState, hasPendingChanges, flush } = useAutoSave({
    value: settings,
    savedValue: savedSettings,
    isEqual: jsonDeepEqual,
    enabled: !isLoading && Boolean(pluginId) && Boolean(semesterId || courseId),
    debounceMs: DEBOUNCE_MS,
    maxWaitMs: MAX_WAIT_MS,
    onSave: async (snapshot) => {
      const payload = { settings: JSON.stringify(snapshot ?? EMPTY_SETTINGS) };
      const response = semesterId
        ? await api.upsertPluginSettingsForSemester(semesterId, pluginId, payload)
        : await api.upsertPluginSettingsForCourse(courseId!, pluginId, payload);
      setSavedSettings(parsePluginSettings(response.settings));
    },
    onError: async (error) => {
      console.error(`Failed to sync plugin shared settings for ${pluginId}`, error);
      reportError('Failed to sync plugin settings. Please retry.');
    },
  });

  const flushRef = useRef(flush);

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
    isLoading,
  };
};
