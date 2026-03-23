// input:  [Todo sort-mode/direction types and plugin UI-state cache helpers]
// output: [useTodoViewPreferences hook for scope-aware local Todo view preference persistence]
// pos:    [Todo tab local-preference hook that restores per-list sorting state across remounts without involving backend settings]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to
"use no memo";

import React from 'react';
import { usePluginUiState } from '@/plugin-system';
import type { TodoSortDirection, TodoSortMode } from '../types';

interface TodoViewPreferences {
  sortDirection: TodoSortDirection;
  sortMode: TodoSortMode;
}

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

const normalizePreferences = (value: unknown): TodoViewPreferences => {
  const candidate = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<TodoViewPreferences>
    : {};
  return {
    sortMode: isSortMode(candidate.sortMode) ? candidate.sortMode : DEFAULT_TODO_VIEW_PREFERENCES.sortMode,
    sortDirection: isSortDirection(candidate.sortDirection)
      ? candidate.sortDirection
      : DEFAULT_TODO_VIEW_PREFERENCES.sortDirection,
  };
};

export const useTodoViewPreferences = (scopeKey: string) => {
  const {
    state,
    setState,
  } = usePluginUiState<TodoViewPreferences>(
    `todo-view:${scopeKey}`,
    DEFAULT_TODO_VIEW_PREFERENCES,
  );
  const preferences = React.useMemo(() => normalizePreferences(state), [state]);

  const setSortMode = React.useCallback((sortMode: TodoSortMode) => {
    setState((previous) => ({
      ...normalizePreferences(previous),
      sortMode,
    }));
  }, [setState]);

  const setSortDirection = React.useCallback((sortDirection: TodoSortDirection) => {
    setState((previous) => ({
      ...normalizePreferences(previous),
      sortDirection,
    }));
  }, [setState]);

  return {
    sortMode: preferences.sortMode,
    sortDirection: preferences.sortDirection,
    setSortMode,
    setSortDirection,
  };
};
