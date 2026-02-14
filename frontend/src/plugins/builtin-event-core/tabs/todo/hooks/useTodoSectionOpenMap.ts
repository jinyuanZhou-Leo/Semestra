import React from 'react';
import { COMPLETED_SECTION_ID } from '../shared';

export const useTodoSectionOpenMap = () => {
  const [sectionOpenMap, setSectionOpenMap] = React.useState<Record<string, boolean>>({});

  const sectionOpenKey = React.useCallback((listId: string, sectionId: string) => {
    return `${listId}:${sectionId}`;
  }, []);

  const isSectionOpen = React.useCallback((listId: string, sectionId: string) => {
    const key = sectionOpenKey(listId, sectionId);
    const fromState = sectionOpenMap[key];
    if (typeof fromState === 'boolean') return fromState;
    return sectionId !== COMPLETED_SECTION_ID;
  }, [sectionOpenKey, sectionOpenMap]);

  const setSectionOpen = React.useCallback((listId: string, sectionId: string, open: boolean) => {
    const key = sectionOpenKey(listId, sectionId);
    setSectionOpenMap((previous) => ({ ...previous, [key]: open }));
  }, [sectionOpenKey]);

  return {
    isSectionOpen,
    setSectionOpen,
  };
};
