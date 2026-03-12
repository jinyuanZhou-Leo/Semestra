// input:  [Todo sort-mode/direction types and browser localStorage]
// output: [useTodoViewPreferences hook for scope-aware local Todo view preference persistence]
// pos:    [Todo tab local-preference hook that restores per-list sorting state across remounts without involving backend settings]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to
"use no memo";

import React from 'react';
import type { TodoSortDirection, TodoSortMode } from '../types';

interface TodoViewPreferences {
  sortDirection: TodoSortDirection;
  sortMode: TodoSortMode;
}

type TodoPreferencesStorage = Pick<Storage, 'getItem' | 'setItem'>;

const TODO_VIEW_PREFERENCES_STORAGE_KEY = 'semestra.todo.view-preferences.v1';
const memoryPreferencesMap: Record<string, TodoViewPreferences> = {};

const DEFAULT_TODO_VIEW_PREFERENCES: TodoViewPreferences = {
  sortMode: 'created',
  sortDirection: 'asc',
};

const isSortMode = (value: unknown): value is TodoSortMode => {
  return value === 'created' || value === 'due-date' || value === 'priority' || value === 'title';
};

const isSortDirection = (value: unknown): value is TodoSortDirection => {
  return value === 'asc' || value === 'desc';
};

const getStorage = (): TodoPreferencesStorage | null => {
  if (typeof window === 'undefined') return null;
  const candidate = window.localStorage as Partial<Storage> | undefined;
  if (!candidate) return null;
  if (typeof candidate.getItem !== 'function' || typeof candidate.setItem !== 'function') {
    return null;
  }
  return {
    getItem: (key) => candidate.getItem!(key),
    setItem: (key, value) => candidate.setItem!(key, value),
  };
};

const readStoredPreferencesMap = () => {
  const storage = getStorage();
  if (!storage) return memoryPreferencesMap;
  try {
    const rawValue = storage.getItem(TODO_VIEW_PREFERENCES_STORAGE_KEY);
    if (!rawValue) return {} as Record<string, TodoViewPreferences>;
    const parsed = JSON.parse(rawValue);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, TodoViewPreferences>
      : {} as Record<string, TodoViewPreferences>;
  } catch {
    return memoryPreferencesMap;
  }
};

const readScopePreferences = (scopeKey: string): TodoViewPreferences => {
  const storedValue = readStoredPreferencesMap()[scopeKey];
  return {
    sortMode: isSortMode(storedValue?.sortMode) ? storedValue.sortMode : DEFAULT_TODO_VIEW_PREFERENCES.sortMode,
    sortDirection: isSortDirection(storedValue?.sortDirection) ? storedValue.sortDirection : DEFAULT_TODO_VIEW_PREFERENCES.sortDirection,
  };
};

const writeScopePreferences = (scopeKey: string, preferences: TodoViewPreferences) => {
  const nextMap: Record<string, TodoViewPreferences> = {
    ...readStoredPreferencesMap(),
    [scopeKey]: preferences,
  };
  Object.assign(memoryPreferencesMap, nextMap);

  const storage = getStorage();
  if (!storage) return;
  storage.setItem(TODO_VIEW_PREFERENCES_STORAGE_KEY, JSON.stringify(nextMap));
};

export const useTodoViewPreferences = (scopeKey: string) => {
  const [preferences, setPreferences] = React.useState<TodoViewPreferences>(() => readScopePreferences(scopeKey));
  const skipNextWriteRef = React.useRef(true);

  React.useEffect(() => {
    skipNextWriteRef.current = true;
    setPreferences(readScopePreferences(scopeKey));
  }, [scopeKey]);

  React.useEffect(() => {
    if (skipNextWriteRef.current) {
      skipNextWriteRef.current = false;
      return;
    }
    writeScopePreferences(scopeKey, preferences);
  }, [preferences, scopeKey]);

  const setSortMode = React.useCallback((sortMode: TodoSortMode) => {
    setPreferences((previous) => ({ ...previous, sortMode }));
  }, []);

  const setSortDirection = React.useCallback((sortDirection: TodoSortDirection) => {
    setPreferences((previous) => ({ ...previous, sortDirection }));
  }, []);

  return {
    sortMode: preferences.sortMode,
    sortDirection: preferences.sortDirection,
    setSortMode,
    setSortDirection,
  };
};
