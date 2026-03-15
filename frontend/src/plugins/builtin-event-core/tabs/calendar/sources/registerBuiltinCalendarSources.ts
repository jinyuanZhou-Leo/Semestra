// input:  [calendar-core registry helpers plus built-in schedule/todo/gradebook/LMS source definitions]
// output: [`ensureBuiltinCalendarSourcesRegistered()` initializer for event-core Calendar sources]
// pos:    [safe source-registration bridge that keeps built-in Calendar sources discoverable without touching plugin contracts]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { registerCalendarSources } from '@/calendar-core';
import { BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE } from '../../../shared/constants';
import { builtinGradebookCalendarSource } from './gradebookSource';
import { builtinLmsCalendarSource } from './lmsSource';
import { builtinScheduleCalendarSource } from './scheduleSource';
import { builtinTodoCalendarSource } from './todoSource';

let hasRegisteredBuiltinCalendarSources = false;

export const ensureBuiltinCalendarSourcesRegistered = () => {
  if (hasRegisteredBuiltinCalendarSources) return;
  registerCalendarSources(BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE, [
    builtinScheduleCalendarSource,
    builtinTodoCalendarSource,
    builtinGradebookCalendarSource,
    builtinLmsCalendarSource,
  ]);
  hasRegisteredBuiltinCalendarSources = true;
};
