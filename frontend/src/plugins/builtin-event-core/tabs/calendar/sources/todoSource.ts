// input:  [calendar-core source contracts, semester todo APIs, and calendar date helpers]
// output: [built-in todo Calendar source definition]
// pos:    [built-in Calendar source adapter that maps persisted semester todo records into calendar events]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import api from '@/services/api';
import type { CalendarEventData, CalendarSourceDefinition } from '@/calendar-core';
import { BUILTIN_CALENDAR_SOURCE_TODO, BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE } from '../../../shared/constants';
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

const buildTodoEvent = (
  task: TodoTask,
  semesterId: string,
  semesterStartDate: Date,
  semesterEndDate: Date,
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

export const builtinTodoCalendarSource: CalendarSourceDefinition = {
  id: BUILTIN_CALENDAR_SOURCE_TODO,
  ownerId: BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE,
  label: 'Todo',
  defaultColor: '#10b981',
  priority: 200,
  load: async (context) => {
    const response = await api.getSemesterTodo(context.semesterId);
    const semesterState = fromTodoApiState(response, false);

    return semesterState.tasks
      .map((task) => buildTodoEvent(task, context.semesterId, context.semesterRange.startDate, context.semesterRange.endDate))
      .filter((event): event is CalendarEventData => event !== null);
  },
  shouldRefresh: (signal, context) => {
    if (signal.type !== 'timetable') return true;
    if (!signal.semesterId || signal.semesterId !== context.semesterId) return false;
    return signal.reason === 'events-updated' || signal.source === 'semester';
  },
};
