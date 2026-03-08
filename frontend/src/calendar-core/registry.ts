// input:  [calendar source definitions, owner registrations, and store subscribers]
// output: [calendar source registry read/write helpers plus a React subscription hook]
// pos:    [independent registry service that decouples Calendar source extension from the plugin framework]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useSyncExternalStore } from 'react';
import type { CalendarSourceDefinition } from './types';

const ownerSources = new Map<string, CalendarSourceDefinition[]>();
const listeners = new Set<() => void>();
let cachedSources: CalendarSourceDefinition[] = [];

const notifyListeners = () => {
  listeners.forEach((listener) => listener());
};

const compareSources = (left: CalendarSourceDefinition, right: CalendarSourceDefinition) => (
  left.priority - right.priority || left.id.localeCompare(right.id)
);

const validateSources = (ownerId: string, sources: CalendarSourceDefinition[]) => {
  const localIds = new Set<string>();

  for (const source of sources) {
    if (source.ownerId !== ownerId) {
      throw new Error(`Calendar source "${source.id}" must declare ownerId "${ownerId}".`);
    }
    if (localIds.has(source.id)) {
      throw new Error(`Duplicate calendar source id "${source.id}" in owner "${ownerId}".`);
    }
    localIds.add(source.id);
  }

  const globalIds = new Map<string, string>();
  for (const [registeredOwnerId, registeredSources] of ownerSources.entries()) {
    if (registeredOwnerId === ownerId) continue;
    for (const source of registeredSources) {
      globalIds.set(source.id, registeredOwnerId);
    }
  }

  for (const source of sources) {
    const registeredOwnerId = globalIds.get(source.id);
    if (registeredOwnerId) {
      throw new Error(`Calendar source "${source.id}" is already owned by "${registeredOwnerId}".`);
    }
  }
};

export const getRegisteredCalendarSources = (): CalendarSourceDefinition[] => {
  return cachedSources;
};

export const subscribeCalendarSourceRegistry = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const registerCalendarSources = (
  ownerId: string,
  sources: CalendarSourceDefinition[],
) => {
  validateSources(ownerId, sources);
  ownerSources.set(ownerId, [...sources].sort(compareSources));
  cachedSources = Array.from(ownerSources.values()).flat().sort(compareSources);
  notifyListeners();

  return () => {
    const registeredSources = ownerSources.get(ownerId);
    if (!registeredSources) return;
    ownerSources.delete(ownerId);
    cachedSources = Array.from(ownerSources.values()).flat().sort(compareSources);
    notifyListeners();
  };
};

export const useCalendarSourceRegistry = () => {
  return useSyncExternalStore(
    subscribeCalendarSourceRegistry,
    getRegisteredCalendarSources,
    getRegisteredCalendarSources,
  );
};
