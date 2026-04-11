// input:  [injected calendar source services, calendar-core source contracts, and shared schedule-to-calendar mappers]
// output: [built-in schedule Calendar source factory]
// pos:    [built-in Calendar source adapter that loads only the buffered visible semester schedule window for the registry]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { CalendarSourceContext, CalendarSourceDefinition } from '../../../calendar-core';
import {
  BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
  BUILTIN_CALENDAR_SOURCE_SCHEDULE,
  TIMETABLE_REFRESH_REASONS,
} from '../../../shared/constants';
import type { CalendarSourceServices } from '../../../shared/sourceServices';
import type { TimetableCalendarEvent } from '../../../shared/types';
import {
  buildCalendarEvents,
  formatDateAsIsoDate,
  sortScheduleItemsByTime,
} from '../../../shared/utils';

const SCHEDULE_TAGS = new Set<string>([
  TIMETABLE_REFRESH_REASONS.EVENT_UPDATED,
  TIMETABLE_REFRESH_REASONS.EVENTS_UPDATED,
  TIMETABLE_REFRESH_REASONS.SECTION_CREATED,
  TIMETABLE_REFRESH_REASONS.SECTION_UPDATED,
  TIMETABLE_REFRESH_REASONS.SECTION_DELETED,
  TIMETABLE_REFRESH_REASONS.EVENT_TYPE_CREATED,
  TIMETABLE_REFRESH_REASONS.EVENT_TYPE_UPDATED,
  TIMETABLE_REFRESH_REASONS.EVENT_TYPE_DELETED,
  TIMETABLE_REFRESH_REASONS.COURSE_UPDATED,
]);

const buildCalendarScheduleParams = (context: CalendarSourceContext) => ({
  start: formatDateAsIsoDate(context.queryRange.start),
  end: formatDateAsIsoDate(context.queryRange.end),
  withConflicts: true,
});

export const createScheduleCalendarSource = (
  services: CalendarSourceServices,
): CalendarSourceDefinition<TimetableCalendarEvent> => {
  const { scheduleService, queryClient, queryKeys } = services;

  const prefetchAdjacentScheduleWindows = (context: CalendarSourceContext) => {
    const prefetchRanges = context.prefetchQueryRanges ?? [];
    return Promise.allSettled(prefetchRanges.map((range) => {
      const params = {
        start: formatDateAsIsoDate(range.start),
        end: formatDateAsIsoDate(range.end),
        withConflicts: true,
      };
      return queryClient.prefetchQuery({
        queryKey: queryKeys.semesters.calendarSchedule(context.scopeId, params),
        queryFn: async () => {
          const response = await scheduleService.getSemesterCalendarSchedule(context.scopeId, params);
          return response.items;
        },
        staleTime: 60_000,
        gcTime: 5 * 60_000,
      });
    }));
  };

  return {
    id: BUILTIN_CALENDAR_SOURCE_SCHEDULE,
    ownerId: BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
    label: 'Schedule',
    defaultColor: '#3b82f6',
    priority: 100,
    getCached: (context) => {
      const params = buildCalendarScheduleParams(context);
      const cachedItems = queryClient.getQueryData<Awaited<ReturnType<typeof scheduleService.getSemesterCalendarSchedule>>['items']>(
        queryKeys.semesters.calendarSchedule(context.scopeId, params),
      );
      if (!cachedItems) return undefined;
      return buildCalendarEvents(sortScheduleItemsByTime(cachedItems), context.scopeRange.startDate);
    },
    load: async (context) => {
      const params = buildCalendarScheduleParams(context);
      const snapshot = await queryClient.fetchQuery({
        queryKey: queryKeys.semesters.calendarSchedule(context.scopeId, params),
        queryFn: async () => {
          const response = await scheduleService.getSemesterCalendarSchedule(context.scopeId, params);
          return response.items;
        },
        staleTime: 60_000,
        gcTime: 5 * 60_000,
      });
      void prefetchAdjacentScheduleWindows(context);
      const sortedItems = sortScheduleItemsByTime(snapshot);
      return buildCalendarEvents(sortedItems, context.scopeRange.startDate);
    },
    invalidate: (signal, context) => {
      void signal;
      queryClient.removeQueries({ queryKey: queryKeys.semesters.calendarSchedule(context.scopeId) });
    },
    shouldRefresh: (signal, context) => {
      if (signal.type === 'manual') return true;
      if (signal.type === 'full') return !signal.scopeId || signal.scopeId === context.scopeId;
      if (signal.type === 'partial') {
        if (signal.scopeId !== context.scopeId) return false;
        return SCHEDULE_TAGS.has(signal.tag ?? '');
      }
      return false;
    },
    applyEventPatch: async (event, patch) => {
      await scheduleService.updateCourseEvent(event.courseId, event.eventId, {
        skip: patch.skip,
      });
    },
  };
};
