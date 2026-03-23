// input:  [Todo section ids, plugin UI-state cache helpers, and Todo tab consumers]
// output: [useTodoSectionOpenMap hook for persisted per-list section visibility]
// pos:    [Todo tab local visibility state that keeps section open/closed choices across remounts]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { usePluginUiState } from '@/plugin-system';
import { COMPLETED_SECTION_ID } from '../shared';

type TodoSectionOpenMap = Record<string, boolean>;

const buildSectionOpenKey = (listId: string, sectionId: string) => `${listId}:${sectionId}`;

export const useTodoSectionOpenMap = () => {
  const {
    state: sectionOpenMap,
    setState: setSectionOpenMap,
  } = usePluginUiState<TodoSectionOpenMap>('todo-section-open-map', {});

  const isSectionOpen = React.useCallback((listId: string, sectionId: string) => {
    const key = buildSectionOpenKey(listId, sectionId);
    const fromState = sectionOpenMap[key];
    if (typeof fromState === 'boolean') return fromState;
    return sectionId !== COMPLETED_SECTION_ID;
  }, [sectionOpenMap]);

  const setSectionOpen = React.useCallback((listId: string, sectionId: string, open: boolean) => {
    const key = buildSectionOpenKey(listId, sectionId);
    setSectionOpenMap((previous) => ({ ...previous, [key]: open }));
  }, [setSectionOpenMap]);

  return {
    isSectionOpen,
    setSectionOpen,
  };
};
