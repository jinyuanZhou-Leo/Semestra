// input:  [calendar-core source contracts, LMS calendar API, cached semester data, and semester date helpers]
// output: [built-in LMS Calendar source definition]
// pos:    [read-only Calendar source adapter that maps semester-scoped LMS events into calendar-core event data]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import { parseISO } from 'date-fns';
import api from '@/services/api';
import type { CalendarEventData, CalendarSourceDefinition } from '@/calendar-core';
import { queryClient } from '@/services/queryClient';
import { queryKeys } from '@/services/queryKeys';
import {
  BUILTIN_CALENDAR_SOURCE_LMS,
  BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
} from '../../../shared/constants';
import { getWeekFromSemesterDate, startOfWeekMonday } from '../../../shared/utils';

const buildLmsCalendarEvent = (
  item: Awaited<ReturnType<typeof api.getSemesterLmsCalendarEvents>>['items'][number],
  semesterStartDate: Date,
): CalendarEventData | null => {
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
    title: item.title.trim() || 'LMS Event',
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

export const builtinLmsCalendarSource: CalendarSourceDefinition = {
  id: BUILTIN_CALENDAR_SOURCE_LMS,
  ownerId: BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
  label: 'LMS',
  defaultColor: '#0f766e',
  priority: 350,
  getCached: (context) => {
    const cached = queryClient.getQueryData<Awaited<ReturnType<typeof api.getSemesterLmsCalendarEvents>>>(
      queryKeys.semesters.lmsCalendarEvents(context.semesterId),
    );
    if (!cached) return undefined;
    return cached.items
      .map((item) => buildLmsCalendarEvent(item, startOfWeekMonday(context.semesterRange.startDate)))
      .filter((event): event is CalendarEventData => event !== null);
  },
  load: async (context) => {
    const response = await queryClient.fetchQuery({
      queryKey: queryKeys.semesters.lmsCalendarEvents(context.semesterId),
      queryFn: () => api.getSemesterLmsCalendarEvents(context.semesterId),
      staleTime: 60_000,
      gcTime: 5 * 60_000,
    });
    return response.items
      .map((item) => buildLmsCalendarEvent(item, startOfWeekMonday(context.semesterRange.startDate)))
      .filter((event): event is CalendarEventData => event !== null);
  },
  invalidate: async (_signal, context) => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.semesters.lmsCalendarEvents(context.semesterId) });
  },
  shouldRefresh: (signal, context) => {
    if (signal.type !== 'timetable') return true;
    if (!signal.semesterId || signal.semesterId !== context.semesterId) return false;
    return signal.reason === 'course-updated' || signal.source === 'semester';
  },
};
