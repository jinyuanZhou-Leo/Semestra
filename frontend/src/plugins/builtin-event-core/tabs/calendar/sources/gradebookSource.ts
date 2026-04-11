// input:  [injected calendar source services, semester/course gradebook APIs, and calendar date helpers]
// output: [built-in gradebook Calendar source factory]
// pos:    [built-in Calendar source adapter that maps course gradebook assessments with due dates into calendar events]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { Course, GradebookAssessment } from '@/services/api';
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

const GRADEBOOK_MAX_PARALLEL_REQUESTS = 4;

const GRADEBOOK_TAGS = new Set<string>([
  TIMETABLE_REFRESH_REASONS.COURSE_UPDATED,
  TIMETABLE_REFRESH_REASONS.GRADEBOOK_ASSESSMENTS_UPDATED,
]);

const runWithConcurrencyLimit = async <T,>(
  tasks: Array<() => Promise<T>>,
  maxParallelRequests: number,
) => {
  if (tasks.length === 0) return [] as T[];

  const results: T[] = Array.from({ length: tasks.length });
  let cursor = 0;

  const worker = async () => {
    while (cursor < tasks.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await tasks[currentIndex]!();
    }
  };

  const workerCount = Math.min(tasks.length, Math.max(1, maxParallelRequests));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
};

const buildGradebookEvent = (
  assessment: GradebookAssessment,
  semesterStartDate: Date,
  semesterEndDate: Date,
  courseId: string,
  courseName: string,
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
    id: `gradebook:${courseId}:${assessment.id}:${assessment.due_date}`,
    eventId: assessment.id,
    sourceId: BUILTIN_CALENDAR_SOURCE_GRADEBOOK,
    title: assessment.title.trim() || 'Assessment',
    courseId,
    courseName,
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
    const semester = queryClient.getQueryData<Awaited<ReturnType<typeof api.getSemester>>>(
      queryKeys.semesters.detail(context.scopeId),
    );
    if (!semester) return undefined;

    const courses = (semester.courses ?? []) as Course[];
    const gradebookCourses = courses.filter((course) => course.has_gradebook);
    const cachedEntries = gradebookCourses.map((course) => {
      const gradebook = queryClient.getQueryData<Awaited<ReturnType<typeof api.getCourseGradebook>>>(
        queryKeys.courses.gradebook(course.id),
      );
      if (!gradebook) return null;
      return { course, gradebook };
    }).filter((entry): entry is { course: Course; gradebook: Awaited<ReturnType<typeof api.getCourseGradebook>> } => entry !== null);

    if (gradebookCourses.length > 0 && cachedEntries.length === 0) {
      return undefined;
    }

    return cachedEntries.flatMap((entry) => (
      entry.gradebook.assessments
        .map((assessment) => buildGradebookEvent(
          assessment,
          context.scopeRange.startDate,
          context.scopeRange.endDate,
          entry.course.id,
          entry.course.name,
        ))
        .filter((event): event is TimetableCalendarEvent => event !== null)
    ));
  };

  return {
    id: BUILTIN_CALENDAR_SOURCE_GRADEBOOK,
    ownerId: BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
    label: 'Gradebook',
    defaultColor: '#f59e0b',
    priority: 300,
    getCached: buildCachedEvents,
    load: async (context) => {
      const semester = await queryClient.ensureQueryData({
        queryKey: queryKeys.semesters.detail(context.scopeId),
        queryFn: () => api.getSemester(context.scopeId),
        staleTime: Infinity,
        gcTime: Infinity,
      });
      const courses = (semester.courses ?? []) as Course[];
      const gradebookCourses = courses.filter((course) => course.has_gradebook);
      const gradebookResponses = await runWithConcurrencyLimit(
        gradebookCourses.map((course) => async () => {
          try {
            const gradebook = await queryClient.ensureQueryData({
              queryKey: queryKeys.courses.gradebook(course.id),
              queryFn: () => api.getCourseGradebook(course.id),
              staleTime: Infinity,
              gcTime: Infinity,
            });
            return { course, gradebook };
          } catch {
            return null;
          }
        }),
        GRADEBOOK_MAX_PARALLEL_REQUESTS,
      );

      return gradebookResponses.flatMap((entry) => {
        if (!entry) return [];
        return entry.gradebook.assessments
          .map((assessment) => buildGradebookEvent(
            assessment,
            context.scopeRange.startDate,
            context.scopeRange.endDate,
            entry.course.id,
            entry.course.name,
          ))
          .filter((event): event is TimetableCalendarEvent => event !== null);
      });
    },
    invalidate: async (signal, context) => {
      // Semester detail must be invalidated for full or course-updated signals
      if (
        signal.type === 'manual'
        || signal.type === 'full'
        || (signal.type === 'partial' && signal.tag === TIMETABLE_REFRESH_REASONS.COURSE_UPDATED)
      ) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.semesters.detail(context.scopeId) });
      }

      // Invalidate the specific course's gradebook when entityId is present
      if (signal.type === 'partial' && signal.entityId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.courses.gradebook(signal.entityId) });
        return;
      }

      // Broadly invalidate all course gradebook caches only for manual or course-updated without entityId
      if (signal.type !== 'manual' && !(signal.type === 'partial' && signal.tag === TIMETABLE_REFRESH_REASONS.COURSE_UPDATED)) {
        return;
      }

      const semester = queryClient.getQueryData<{ courses?: Course[] }>(queryKeys.semesters.detail(context.scopeId));
      const courseIds = (semester?.courses ?? [])
        .filter((course) => course.has_gradebook)
        .map((course) => course.id);

      await Promise.all(courseIds.map((courseId) => (
        queryClient.invalidateQueries({ queryKey: queryKeys.courses.gradebook(courseId) })
      )));
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
