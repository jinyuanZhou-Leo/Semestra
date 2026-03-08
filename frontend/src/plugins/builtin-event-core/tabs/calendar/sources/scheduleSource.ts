// input:  [calendar-core source contracts, schedule service APIs, and shared schedule-to-calendar mappers]
// output: [built-in schedule Calendar source definition]
// pos:    [built-in Calendar source adapter that loads all semester schedule events for the registry]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import scheduleService from '@/services/schedule';
import type { CalendarSourceDefinition } from '@/calendar-core';
import {
  BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
  DEFAULT_WEEK,
  SCHEDULE_MAX_PARALLEL_REQUESTS,
  BUILTIN_CALENDAR_SOURCE_SCHEDULE,
} from '../../../shared/constants';
import {
  buildCalendarEvents,
  dedupeScheduleItems,
  sortScheduleItemsByTime,
} from '../../../shared/utils';

const runWithConcurrencyLimit = async <T,>(
  tasks: Array<() => Promise<T>>,
  maxParallelRequests: number,
) => {
  if (tasks.length === 0) return [] as T[];

  const results: T[] = new Array(tasks.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < tasks.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await tasks[currentIndex]();
    }
  };

  const workerCount = Math.min(tasks.length, Math.max(1, maxParallelRequests));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
};

export const builtinScheduleCalendarSource: CalendarSourceDefinition = {
  id: BUILTIN_CALENDAR_SOURCE_SCHEDULE,
  ownerId: BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
  label: 'Schedule',
  defaultColor: '#3b82f6',
  priority: 100,
  load: async (context) => {
    const firstWeekResponse = await scheduleService.getSemesterSchedule(context.semesterId, {
      week: DEFAULT_WEEK,
      withConflicts: true,
    });

    const targetWeekCount = Math.max(DEFAULT_WEEK, context.maxWeek, firstWeekResponse.maxWeek);
    const tasks = Array.from({ length: targetWeekCount - 1 }, (_, index) => {
      const week = index + 2;
      return () => scheduleService.getSemesterSchedule(context.semesterId, {
        week,
        withConflicts: true,
      });
    });

    const remainingResponses = await runWithConcurrencyLimit(tasks, SCHEDULE_MAX_PARALLEL_REQUESTS);
    const sortedItems = sortScheduleItemsByTime(
      dedupeScheduleItems([firstWeekResponse, ...remainingResponses].flatMap((response) => response.items)),
    );

    return buildCalendarEvents(sortedItems, context.semesterRange.startDate);
  },
  shouldRefresh: (signal, context) => {
    if (signal.type !== 'timetable') return true;
    if (!signal.semesterId || signal.semesterId !== context.semesterId) return false;

    return (
      signal.reason === 'event-updated'
      || signal.reason === 'events-updated'
      || signal.reason === 'section-created'
      || signal.reason === 'section-updated'
      || signal.reason === 'section-deleted'
      || signal.reason === 'event-type-created'
      || signal.reason === 'event-type-updated'
      || signal.reason === 'event-type-deleted'
      || signal.reason === 'course-updated'
      || signal.source === 'semester'
    );
  },
  applyEventPatch: async (event, patch) => {
    await scheduleService.updateCourseEvent(event.courseId, event.eventId, {
      skip: patch.skip,
    });
  },
};
