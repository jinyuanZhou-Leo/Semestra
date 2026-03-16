// input:  [calendar-core source contracts, schedule range API, and shared schedule-to-calendar mappers]
// output: [built-in schedule Calendar source definition]
// pos:    [built-in Calendar source adapter that loads only the buffered visible semester schedule window for the registry]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import scheduleService from '@/services/schedule';
import type { CalendarSourceDefinition } from '@/calendar-core';
import { queryClient } from '@/services/queryClient';
import { queryKeys } from '@/services/queryKeys';
import {
  BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
  BUILTIN_CALENDAR_SOURCE_SCHEDULE,
} from '../../../shared/constants';
import {
  buildCalendarEvents,
  formatDateAsIsoDate,
  sortScheduleItemsByTime,
} from '../../../shared/utils';

const buildCalendarScheduleParams = (context: Parameters<NonNullable<CalendarSourceDefinition['load']>>[0]) => ({
  start: formatDateAsIsoDate(context.queryRange.start),
  end: formatDateAsIsoDate(context.queryRange.end),
  withConflicts: true,
});

const prefetchAdjacentScheduleWindows = (context: Parameters<NonNullable<CalendarSourceDefinition['load']>>[0]) => {
  const prefetchRanges = context.prefetchQueryRanges ?? [];
  return Promise.allSettled(prefetchRanges.map((range) => {
    const params = {
      start: formatDateAsIsoDate(range.start),
      end: formatDateAsIsoDate(range.end),
      withConflicts: true,
    };
    return queryClient.prefetchQuery({
      queryKey: queryKeys.semesters.calendarSchedule(context.semesterId, params),
      queryFn: async () => {
        const response = await scheduleService.getSemesterCalendarSchedule(context.semesterId, params);
        return response.items;
      },
      staleTime: 60_000,
      gcTime: 5 * 60_000,
    });
  }));
};

export const builtinScheduleCalendarSource: CalendarSourceDefinition = {
  id: BUILTIN_CALENDAR_SOURCE_SCHEDULE,
  ownerId: BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
  label: 'Schedule',
  defaultColor: '#3b82f6',
  priority: 100,
  getCached: (context) => {
    const params = buildCalendarScheduleParams(context);
    const cachedItems = queryClient.getQueryData<Awaited<ReturnType<typeof scheduleService.getSemesterCalendarSchedule>>['items']>(
      queryKeys.semesters.calendarSchedule(context.semesterId, params),
    );
    if (!cachedItems) return undefined;
    return buildCalendarEvents(sortScheduleItemsByTime(cachedItems), context.semesterRange.startDate);
  },
  load: async (context) => {
    const params = buildCalendarScheduleParams(context);
    const snapshot = await queryClient.fetchQuery({
      queryKey: queryKeys.semesters.calendarSchedule(context.semesterId, params),
      queryFn: async () => {
        const response = await scheduleService.getSemesterCalendarSchedule(context.semesterId, params);
        return response.items;
      },
      staleTime: 60_000,
      gcTime: 5 * 60_000,
    });
    void prefetchAdjacentScheduleWindows(context);
    const sortedItems = sortScheduleItemsByTime(snapshot);

    return buildCalendarEvents(sortedItems, context.semesterRange.startDate);
  },
  invalidate: (signal, context) => {
    void signal;
    queryClient.removeQueries({ queryKey: queryKeys.semesters.calendarSchedule(context.semesterId) });
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
