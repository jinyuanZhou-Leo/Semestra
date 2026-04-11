// input:  [calendar-core registry helpers, mock source definitions, and Vitest assertions]
// output: [regression tests for standalone Calendar source registration behavior]
// pos:    [calendar-core registry test suite covering replacement and stable ordering]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { afterEach, describe, expect, it } from 'vitest';
import type { CalendarSourceDefinition } from './types';
import { getRegisteredCalendarSources, registerCalendarSources } from './registry';

const buildSource = (id: string, ownerId: string, priority: number): CalendarSourceDefinition => ({
  id,
  ownerId,
  label: id,
  defaultColor: '#3b82f6',
  priority,
  load: async () => [],
  shouldRefresh: () => false,
});

const cleanupCallbacks: Array<() => void> = [];

afterEach(() => {
  while (cleanupCallbacks.length > 0) {
    cleanupCallbacks.pop()?.();
  }
});

describe('calendar source registry', () => {
  it('keeps sources sorted by priority and id', () => {
    cleanupCallbacks.push(registerCalendarSources('owner-a', [
      buildSource('owner-a:z', 'owner-a', 200),
      buildSource('owner-a:a', 'owner-a', 200),
    ]));
    cleanupCallbacks.push(registerCalendarSources('owner-b', [
      buildSource('owner-b:b', 'owner-b', 100),
    ]));

    expect(getRegisteredCalendarSources().map((source) => source.id)).toEqual([
      'owner-b:b',
      'owner-a:a',
      'owner-a:z',
    ]);
  });

  it('replaces prior registrations for the same owner', () => {
    cleanupCallbacks.push(registerCalendarSources('owner-a', [
      buildSource('owner-a:first', 'owner-a', 100),
    ]));
    cleanupCallbacks.push(registerCalendarSources('owner-a', [
      buildSource('owner-a:second', 'owner-a', 100),
    ]));

    expect(getRegisteredCalendarSources().map((source) => source.id)).toEqual([
      'owner-a:second',
    ]);
  });
});
