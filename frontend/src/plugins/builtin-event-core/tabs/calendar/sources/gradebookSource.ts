// input:  [injected calendar source services, semester gradebook aggregation API, and calendar date helpers]
// output: [built-in gradebook Calendar source factory]
// pos:    [built-in Calendar source adapter that maps course gradebook assessments with due dates into calendar events]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { SemesterGradebookAssessment } from '@/services/api';
import type { CalendarSourceContext, CalendarSourceDefinition } from '../../../calendar-core';
import {
  BUILTIN_CALENDAR_SOURCE_GRADEBOOK,
  BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
  TIMETABLE_REFRESH_REASONS,
} from '../../../shared/constants';
import type { CalendarSourceServices } from '../../../shared/sourceServices';
import type { TimetableCalendarEvent } from '../../../shared/types';
import {
  addDays,
  getWeekFromSemesterDate,
  startOfWeekMonday,
} from '../../../shared/utils';

const GRADEBOOK_TAGS = new Set<string>([
  TIMETABLE_REFRESH_REASONS.COURSE_UPDATED,
  TIMETABLE_REFRESH_REASONS.GRADEBOOK_ASSESSMENTS_UPDATED,
]);

const buildGradebookEvent = (
  assessment: SemesterGradebookAssessment,
  semesterStartDate: Date,
  semesterEndDate: Date,
): TimetableCalendarEvent | null => {
  if (!assessment.due_date) return null;

  const targetDate = new Date(`${assessment.due_date}T00:00:00`);
  if (!Number.isFinite(targetDate.getTime())) return null;

  const normalizedTargetDate = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
  );
  const semesterStart = startOfWeekMonday(semesterStartDate);
  const semesterEnd = new Date(
    semesterEndDate.getFullYear(),
    semesterEndDate.getMonth(),
    semesterEndDate.getDate(),
    23, 59, 59, 999,
  );
  if (
    normalizedTargetDate.getTime() < semesterStart.getTime()
    || normalizedTargetDate.getTime() > semesterEnd.getTime()
  ) {
    return null;
  }

  const week = getWeekFromSemesterDate(semesterStartDate, normalizedTargetDate);
  const day = normalizedTargetDate.getDay();
  const dayOfWeek = day === 0 ? 7 : day;

  return {
    id: `gradebook:${assessment.course_id}:${assessment.id}:${assessment.due_date}`,
    eventId: assessment.id,
    sourceId: BUILTIN_CALENDAR_SOURCE_GRADEBOOK,
    title: assessment.title.trim() || 'Assessment',
    courseId: assessment.course_id,
    courseName: assessment.course_name,
    eventTypeCode: 'Assessment',
    start: normalizedTargetDate,
    end: addDays(normalizedTargetDate, 1),
    allDay: true,
    week,
    dayOfWeek,
    weekPattern: null,
    isRecurring: false,
    startTime: 'All day',
    endTime: 'All day',
    isSkipped: false,
    isConflict: false,
    conflictGroupId: null,
    enable: true,
    note: null,
  };
};

export const createGradebookCalendarSource = (
  services: CalendarSourceServices,
): CalendarSourceDefinition<TimetableCalendarEvent> => {
  const { api, queryClient, queryKeys } = services;

  const buildCachedEvents = (context: CalendarSourceContext): TimetableCalendarEvent[] | undefined => {
    const params = {
      due_start: context.queryRange.start.toISOString().slice(0, 10),
      due_end: context.queryRange.end.toISOString().slice(0, 10),
    };
    const semesterGradebook = queryClient.getQueryData<Awaited<ReturnType<typeof api.getSemesterGradebook>>>(
      queryKeys.semesters.gradebook(context.scopeId, params),
    );
    if (!semesterGradebook) {
      return undefined;
    }

    return semesterGradebook.assessments
      .map((assessment) => buildGradebookEvent(
        assessment,
        context.scopeRange.startDate,
        context.scopeRange.endDate,
      ))
      .filter((event): event is TimetableCalendarEvent => event !== null);
  };

  return {
    id: BUILTIN_CALENDAR_SOURCE_GRADEBOOK,
    ownerId: BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
    label: 'Gradebook',
    defaultColor: '#f59e0b',
    priority: 300,
    getCached: buildCachedEvents,
    load: async (context) => {
      const params = {
        due_start: context.queryRange.start.toISOString().slice(0, 10),
        due_end: context.queryRange.end.toISOString().slice(0, 10),
      };
      const semesterGradebook = await queryClient.ensureQueryData({
        queryKey: queryKeys.semesters.gradebook(context.scopeId, params),
        queryFn: () => api.getSemesterGradebook(context.scopeId, params),
        staleTime: Infinity,
        gcTime: Infinity,
      });

      return semesterGradebook.assessments
        .map((assessment) => buildGradebookEvent(
          assessment,
          context.scopeRange.startDate,
          context.scopeRange.endDate,
        ))
        .filter((event): event is TimetableCalendarEvent => event !== null);
    },
    invalidate: async (signal, context) => {
      if (
        signal.type !== 'manual'
        && signal.type !== 'full'
        && !(signal.type === 'partial' && GRADEBOOK_TAGS.has(signal.tag ?? ''))
      ) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.semesters.gradebook(context.scopeId),
      });
    },
    shouldRefresh: (signal, context) => {
      if (signal.type === 'manual') return true;
      if (signal.type === 'full') return !signal.scopeId || signal.scopeId === context.scopeId;
      if (signal.type === 'partial') {
        if (signal.scopeId !== context.scopeId) return false;
        return GRADEBOOK_TAGS.has(signal.tag ?? '');
      }
      return false;
    },
  };
};
