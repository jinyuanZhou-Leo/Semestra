// input:  [injected calendar source services, LMS calendar API, semester data cache, and semester date helpers]
// output: [built-in LMS Calendar source factory]
// pos:    [read-only Calendar source adapter that maps range-scoped LMS events into calendar events with local course-code titles and LMS event subtitles]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { parseISO } from 'date-fns';
import type { CalendarSourceContext, CalendarSourceDefinition } from '../../../calendar-core';
import {
  BUILTIN_CALENDAR_SOURCE_LMS,
  BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
  TIMETABLE_REFRESH_REASONS,
} from '../../../shared/constants';
import type { CalendarSourceServices } from '../../../shared/sourceServices';
import type { TimetableCalendarEvent } from '../../../shared/types';
import { formatDateAsIsoDate, getWeekFromSemesterDate, startOfWeekMonday } from '../../../shared/utils';

const LMS_TAGS = new Set<string>([
  TIMETABLE_REFRESH_REASONS.COURSE_UPDATED,
]);

const buildLmsCalendarParams = (context: CalendarSourceContext) => ({
  start: formatDateAsIsoDate(context.queryRange.start),
  end: formatDateAsIsoDate(context.queryRange.end),
});

export const createLmsCalendarSource = (
  services: CalendarSourceServices,
): CalendarSourceDefinition<TimetableCalendarEvent> => {
  const { api, queryClient, queryKeys } = services;

  const prefetchAdjacentLmsWindows = (context: CalendarSourceContext) => {
    const prefetchRanges = context.prefetchQueryRanges ?? [];
    return Promise.allSettled(prefetchRanges.map((range) => {
      const params = {
        start: formatDateAsIsoDate(range.start),
        end: formatDateAsIsoDate(range.end),
      };
      return queryClient.prefetchQuery({
        queryKey: queryKeys.semesters.lmsCalendarEvents(context.scopeId, params),
        queryFn: () => api.getSemesterLmsCalendarEvents(context.scopeId, params),
        staleTime: 60_000,
        gcTime: 5 * 60_000,
      });
    }));
  };

  const buildLmsCalendarEvent = (
    item: Awaited<ReturnType<typeof api.getSemesterLmsCalendarEvents>>['items'][number],
    semesterStartDate: Date,
  ): TimetableCalendarEvent | null => {
    const start = parseISO(item.start_at);
    const end = parseISO(item.end_at);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;

    const normalizedStart = new Date(start);
    const normalizedEnd = new Date(end);
    const week = getWeekFromSemesterDate(semesterStartDate, normalizedStart);
    const day = normalizedStart.getDay();
    const dayOfWeek = day === 0 ? 7 : day;
    const isAllDay = Boolean(item.all_day);

    return {
      id: `lms:${item.course_id}:${item.external_id}:${item.start_at}`,
      eventId: item.external_id,
      sourceId: BUILTIN_CALENDAR_SOURCE_LMS,
      title: item.course_display_code.trim() || item.course_name.trim() || 'LMS',
      subtitle: item.title.trim() || null,
      courseId: item.course_id,
      courseName: item.course_name,
      eventTypeCode: item.event_type_code || 'LMS',
      start: normalizedStart,
      end: normalizedEnd,
      allDay: isAllDay,
      week,
      dayOfWeek,
      weekPattern: null,
      isRecurring: false,
      startTime: isAllDay ? 'All day' : normalizedStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      endTime: isAllDay ? 'All day' : normalizedEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSkipped: false,
      isConflict: false,
      conflictGroupId: null,
      enable: true,
      note: item.description ?? item.location ?? null,
    };
  };

  return {
    id: BUILTIN_CALENDAR_SOURCE_LMS,
    ownerId: BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
    label: 'LMS',
    defaultColor: '#0f766e',
    priority: 350,
    getCached: (context) => {
      const params = buildLmsCalendarParams(context);
      const cached = queryClient.getQueryData<Awaited<ReturnType<typeof api.getSemesterLmsCalendarEvents>>>(
        queryKeys.semesters.lmsCalendarEvents(context.scopeId, params),
      );
      if (!cached) return undefined;
      return cached.items
        .map((item) => buildLmsCalendarEvent(item, startOfWeekMonday(context.scopeRange.startDate)))
        .filter((event): event is TimetableCalendarEvent => event !== null);
    },
    load: async (context) => {
      const params = buildLmsCalendarParams(context);
      const response = await queryClient.fetchQuery({
        queryKey: queryKeys.semesters.lmsCalendarEvents(context.scopeId, params),
        queryFn: () => api.getSemesterLmsCalendarEvents(context.scopeId, params),
        staleTime: 60_000,
        gcTime: 5 * 60_000,
      });
      void prefetchAdjacentLmsWindows(context);
      return response.items
        .map((item) => buildLmsCalendarEvent(item, startOfWeekMonday(context.scopeRange.startDate)))
        .filter((event): event is TimetableCalendarEvent => event !== null);
    },
    invalidate: async (_signal, context) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.semesters.lmsCalendarEvents(context.scopeId) });
    },
    shouldRefresh: (signal, context) => {
      if (signal.type === 'manual') return true;
      if (signal.type === 'full') return !signal.scopeId || signal.scopeId === context.scopeId;
      if (signal.type === 'partial') {
        if (signal.scopeId !== context.scopeId) return false;
        return LMS_TAGS.has(signal.tag ?? '');
      }
      return false;
    },
  };
};
