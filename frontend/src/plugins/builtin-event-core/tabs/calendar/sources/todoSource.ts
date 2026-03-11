// input:  [calendar-core source contracts, semester/course APIs, todo storage parsers, and calendar date helpers]
// output: [built-in todo Calendar source definition]
// pos:    [built-in Calendar source adapter that maps semester and course todo tasks, including completed-state metadata, into calendar events]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import api, { type Course } from '@/services/api';
import type { CalendarEventData, CalendarSourceDefinition } from '@/calendar-core';
import { BUILTIN_CALENDAR_SOURCE_TODO, BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE } from '../../../shared/constants';
import {
  addDays,
  getWeekFromSemesterDate,
  parseTimeOnDate,
  startOfWeekMonday,
  toMinutes,
} from '../../../shared/utils';
import { BUILTIN_TIMETABLE_TODO_TAB_TYPE } from '../../../shared/constants';
import { normalizeCourseListStateFromTab, normalizeSemesterCustomLists, parseJsonObject } from '../../todo/utils/todoData';
import type { SemesterCustomListStorage, TodoTask } from '../../todo/types';

const TODO_EVENT_DURATION_MINUTES = 30;
const TODO_DETAIL_MAX_PARALLEL_REQUESTS = 4;

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

const buildTodoEvent = (
  task: TodoTask,
  semesterStartDate: Date,
  semesterEndDate: Date,
  courseId: string,
  courseName: string,
  listSource: 'course' | 'semester-custom',
): CalendarEventData | null => {
  if (!task.dueDate) return null;

  const targetDate = new Date(`${task.dueDate}T00:00:00`);
  if (!Number.isFinite(targetDate.getTime())) return null;

  const normalizedTargetDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const semesterStart = startOfWeekMonday(semesterStartDate);
  const semesterEnd = new Date(semesterEndDate.getFullYear(), semesterEndDate.getMonth(), semesterEndDate.getDate(), 23, 59, 59, 999);
  if (normalizedTargetDate.getTime() < semesterStart.getTime() || normalizedTargetDate.getTime() > semesterEnd.getTime()) {
    return null;
  }

  const week = getWeekFromSemesterDate(semesterStartDate, normalizedTargetDate);
  const day = normalizedTargetDate.getDay();
  const dayOfWeek = day === 0 ? 7 : day;
  const isAllDay = !task.dueTime;
  const start = isAllDay ? normalizedTargetDate : parseTimeOnDate(normalizedTargetDate, task.dueTime);
  const end = isAllDay
    ? addDays(normalizedTargetDate, 1)
    : new Date(start.getTime() + (TODO_EVENT_DURATION_MINUTES * 60 * 1000));

  return {
    id: `todo:${courseId}:${task.id}:${task.dueDate}:${task.dueTime || 'all-day'}`,
    eventId: task.id,
    sourceId: BUILTIN_CALENDAR_SOURCE_TODO,
    title: task.title.trim() || 'Todo',
    courseId,
    courseName,
    eventTypeCode: 'Todo',
    start,
    end,
    allDay: isAllDay,
    week,
    dayOfWeek,
    weekPattern: null,
    isRecurring: false,
    startTime: isAllDay ? 'All day' : task.dueTime,
    endTime: isAllDay
      ? 'All day'
      : `${String(Math.floor((toMinutes(task.dueTime) + TODO_EVENT_DURATION_MINUTES) / 60) % 24).padStart(2, '0')}:${String((toMinutes(task.dueTime) + TODO_EVENT_DURATION_MINUTES) % 60).padStart(2, '0')}`,
    isSkipped: false,
    isConflict: false,
    conflictGroupId: null,
    enable: true,
    note: task.description || null,
    todoState: {
      completed: task.completed,
      listSource,
      listId: courseId,
    },
  };
};

export const builtinTodoCalendarSource: CalendarSourceDefinition = {
  id: BUILTIN_CALENDAR_SOURCE_TODO,
  ownerId: BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
  label: 'Todo',
  defaultColor: '#10b981',
  priority: 200,
  load: async (context) => {
    const semester = await api.getSemester(context.semesterId);
    const courses = (semester.courses ?? []) as Course[];
    const coursesNeedingDetail = courses.filter((course) => !Array.isArray(course.tabs));
    const detailResponses = await runWithConcurrencyLimit(
      coursesNeedingDetail.map((course) => async () => {
        try {
          const detail = await api.getCourse(course.id);
          return { courseId: course.id, detail };
        } catch {
          return { courseId: course.id, detail: undefined };
        }
      }),
      TODO_DETAIL_MAX_PARALLEL_REQUESTS,
    );

    const detailsByCourseId = new Map(detailResponses.map((item) => [item.courseId, item.detail]));
    const semesterTodoTab = semester.tabs?.find((tab) => tab.tab_type === BUILTIN_TIMETABLE_TODO_TAB_TYPE);
    const semesterCustomLists = normalizeSemesterCustomLists(parseJsonObject(semesterTodoTab?.settings));
    const courseTodoEvents = courses.flatMap((course) => {
      const detail = Array.isArray(course.tabs) ? course : detailsByCourseId.get(course.id);
      const todoTab = detail?.tabs?.find((tab) => tab.tab_type === BUILTIN_TIMETABLE_TODO_TAB_TYPE);
      const state = normalizeCourseListStateFromTab(course.id, course.name, todoTab);
      return state.tasks
        .map((task) => buildTodoEvent(task, context.semesterRange.startDate, context.semesterRange.endDate, course.id, course.name, 'course'))
        .filter((event): event is CalendarEventData => event !== null);
    });
    const customTodoEvents = semesterCustomLists.flatMap((list: SemesterCustomListStorage) => {
      return list.tasks
        .map((task) => buildTodoEvent(task, context.semesterRange.startDate, context.semesterRange.endDate, list.id, list.name, 'semester-custom'))
        .filter((event): event is CalendarEventData => event !== null);
    });

    return [...courseTodoEvents, ...customTodoEvents];
  },
  shouldRefresh: (signal, context) => {
    if (signal.type !== 'timetable') return true;
    if (!signal.semesterId || signal.semesterId !== context.semesterId) return false;
    return signal.reason === 'events-updated' || signal.source === 'semester';
  },
};
