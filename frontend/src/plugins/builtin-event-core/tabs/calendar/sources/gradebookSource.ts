// input:  [calendar-core source contracts, semester/course gradebook APIs, and calendar date helpers]
// output: [built-in gradebook Calendar source definition]
// pos:    [built-in Calendar source adapter that maps course gradebook assessments with due dates into calendar events]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import api, { type Course, type GradebookAssessment } from '@/services/api';
import type { CalendarEventData, CalendarSourceDefinition } from '@/calendar-core';
import {
  BUILTIN_CALENDAR_SOURCE_GRADEBOOK,
  BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
} from '../../../shared/constants';
import {
  addDays,
  getWeekFromSemesterDate,
  startOfWeekMonday,
} from '../../../shared/utils';

const GRADEBOOK_MAX_PARALLEL_REQUESTS = 4;

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

const buildGradebookEvent = (
  assessment: GradebookAssessment,
  semesterStartDate: Date,
  semesterEndDate: Date,
  courseId: string,
  courseName: string,
): CalendarEventData | null => {
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
    23,
    59,
    59,
    999,
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

export const builtinGradebookCalendarSource: CalendarSourceDefinition = {
  id: BUILTIN_CALENDAR_SOURCE_GRADEBOOK,
  ownerId: BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
  label: 'Gradebook',
  defaultColor: '#f59e0b',
  priority: 300,
  load: async (context) => {
    const semester = await api.getSemester(context.semesterId);
    const courses = (semester.courses ?? []) as Course[];
    const gradebookCourses = courses.filter((course) => course.has_gradebook);
    const gradebookResponses = await runWithConcurrencyLimit(
      gradebookCourses.map((course) => async () => {
        try {
          const gradebook = await api.getCourseGradebook(course.id);
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
        .map((assessment) => (
          buildGradebookEvent(
            assessment,
            context.semesterRange.startDate,
            context.semesterRange.endDate,
            entry.course.id,
            entry.course.name,
          )
        ))
        .filter((event): event is CalendarEventData => event !== null);
    });
  },
  shouldRefresh: (signal, context) => {
    if (signal.type !== 'timetable') return true;
    if (!signal.semesterId || signal.semesterId !== context.semesterId) return false;

    return (
      signal.reason === 'course-updated'
      || signal.reason === 'gradebook-assessments-updated'
      || signal.source === 'semester'
    );
  },
};
