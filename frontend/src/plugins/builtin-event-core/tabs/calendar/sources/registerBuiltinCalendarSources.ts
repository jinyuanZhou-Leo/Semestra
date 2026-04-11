// input:  [calendar-core registry helpers, built-in calendar source factories, and injected source services]
// output: [`ensureBuiltinCalendarSourcesRegistered()` / `deregisterBuiltinCalendarSources()` lifecycle pair for event-core Calendar sources]
// pos:    [safe source-registration bridge that keeps built-in Calendar sources discoverable without touching plugin contracts]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import api from '@/services/api';
import { queryClient } from '@/services/queryClient';
import { queryKeys } from '@/services/queryKeys';
import scheduleService from '@/services/schedule';
import { registerCalendarSources } from '../../../calendar-core';
import { BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE } from '../../../shared/constants';
import type { CalendarSourceServices } from '../../../shared/sourceServices';
import { createGradebookCalendarSource } from './gradebookSource';
import { createLmsCalendarSource } from './lmsSource';
import { createScheduleCalendarSource } from './scheduleSource';
import { createTodoCalendarSource } from './todoSource';

const services: CalendarSourceServices = {
  scheduleService,
  queryClient,
  queryKeys,
  api,
};

let deregister: (() => void) | null = null;

export const ensureBuiltinCalendarSourcesRegistered = () => {
  if (deregister) return;
  deregister = registerCalendarSources(BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE, [
    createScheduleCalendarSource(services),
    createTodoCalendarSource(services),
    createGradebookCalendarSource(services),
    createLmsCalendarSource(services),
  ] as unknown as import('../../../calendar-core').CalendarSourceDefinition[]);
};

export const deregisterBuiltinCalendarSources = () => {
  deregister?.();
  deregister = null;
};
