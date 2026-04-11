// input:  [injected calendar source services, calendar-core source contracts, and calendar date helpers]
// output: [built-in todo Calendar source factory]
// pos:    [built-in Calendar source adapter that maps persisted semester todo records into calendar events]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { CalendarSourceContext, CalendarSourceDefinition } from '../../../calendar-core';
import { BUILTIN_CALENDAR_SOURCE_TODO, BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE, TIMETABLE_REFRESH_REASONS } from '../../../shared/constants';
import type { CalendarSourceServices } from '../../../shared/sourceServices';
import type { TimetableCalendarEvent } from '../../../shared/types';
import {
  addDays,
  getWeekFromSemesterDate,
  parseTimeOnDate,
  startOfWeekMonday,
  toMinutes,
} from '../../../shared/utils';
import { fromTodoApiState } from '../../todo/utils/todoData';
import type { TodoTask } from '../../todo/types';

const TODO_EVENT_DURATION_MINUTES = 30;

const TODO_TAGS = new Set<string>([
  TIMETABLE_REFRESH_REASONS.EVENTS_UPDATED,
  TIMETABLE_REFRESH_REASONS.COURSE_UPDATED,
]);

const buildTodoEvent = (
  task: TodoTask,
  semesterId: string,
  semesterStartDate: Date,
  semesterEndDate: Date,
): TimetableCalendarEvent | null => {
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
    id: `todo:${task.courseId || semesterId}:${task.id}:${task.dueDate}:${task.dueTime || 'all-day'}`,
    eventId: task.id,
    sourceId: BUILTIN_CALENDAR_SOURCE_TODO,
    title: task.title.trim() || 'Todo',
    courseId: task.courseId,
    courseName: task.courseName,
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
    note: task.note || null,
    todoState: {
      completed: task.completed,
      listSource: task.courseId ? 'course' : 'semester',
      listId: task.courseId || semesterId,
    },
  };
};

export const createTodoCalendarSource = (
  services: CalendarSourceServices,
): CalendarSourceDefinition<TimetableCalendarEvent> => {
  const { api, queryClient, queryKeys } = services;

  const loadEvents = (context: CalendarSourceContext): TimetableCalendarEvent[] | undefined => {
    const cachedResponse = queryClient.getQueryData<Awaited<ReturnType<typeof api.getSemesterTodo>>>(
      queryKeys.semesters.todo(context.scopeId),
    );
    if (!cachedResponse) return undefined;
    const semesterState = fromTodoApiState(cachedResponse, false);
    return semesterState.tasks
      .map((task) => buildTodoEvent(task, context.scopeId, context.scopeRange.startDate, context.scopeRange.endDate))
      .filter((event): event is TimetableCalendarEvent => event !== null);
  };

  return {
    id: BUILTIN_CALENDAR_SOURCE_TODO,
    ownerId: BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
    label: 'Todo',
    defaultColor: '#10b981',
    priority: 200,
    getCached: loadEvents,
    load: async (context) => {
      await queryClient.ensureQueryData({
        queryKey: queryKeys.semesters.todo(context.scopeId),
        queryFn: () => api.getSemesterTodo(context.scopeId),
        staleTime: Infinity,
        gcTime: Infinity,
      });
      return loadEvents(context) ?? [];
    },
    invalidate: async (_signal, context) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.semesters.todo(context.scopeId) });
    },
    shouldRefresh: (signal, context) => {
      if (signal.type === 'manual') return true;
      if (signal.type === 'full') return !signal.scopeId || signal.scopeId === context.scopeId;
      if (signal.type === 'partial') {
        if (signal.scopeId !== context.scopeId) return false;
        return TODO_TAGS.has(signal.tag ?? '');
      }
      return false;
    },
  };
};
