// input:  [Vitest mocks, shared query client/event bus singletons, and calendar-to-todo sync helper]
// output: [tests covering canonical cache updates and domain-event payloads for Calendar-driven todo completion]
// pos:    [todo/calendar integration regression suite guarding against UI-shaped payloads leaking through the event bus]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { afterEach, describe, expect, it, vi } from 'vitest';
import api, { type TodoSemesterStateRecord } from '@/services/api';
import { queryClient } from '@/services/queryClient';
import { queryKeys } from '@/services/queryKeys';
import type { CalendarEventData } from '@/calendar-core';
import { timetableEventBus } from '../../../shared/eventBus';
import { syncCalendarTodoCompletion } from './todoCalendarSync';

const buildTodoStateRecord = (courseId: string | null): TodoSemesterStateRecord => ({
  semester_id: 'semester-1',
  sections: [],
  tasks: [
    {
      id: 'task-1',
      semester_id: 'semester-1',
      title: 'Task',
      note: '',
      due_date: '2026-03-11',
      due_time: null,
      priority: '',
      completed: true,
      course_id: courseId,
      course_name: courseId ? 'Course 1' : '',
      course_category: '',
      course_color: null,
      section_id: null,
      origin_section_id: null,
      created_at: '2026-03-11T10:00:00.000Z',
      updated_at: '2026-03-11T10:00:00.000Z',
    },
  ],
  course_options: courseId ? [{ id: courseId, name: 'Course 1', category: '', color: null }] : [],
});

const calendarTodoEvent: CalendarEventData = {
  id: 'todo:semester-1:task-1:2026-03-11:all-day',
  eventId: 'task-1',
  sourceId: 'builtin-event-core:todo',
  title: 'Task',
  courseId: '',
  courseName: '',
  eventTypeCode: 'Todo',
  start: new Date('2026-03-11T00:00:00.000Z'),
  end: new Date('2026-03-12T00:00:00.000Z'),
  allDay: true,
  week: 2,
  dayOfWeek: 3,
  weekPattern: null,
  isRecurring: false,
  startTime: 'All day',
  endTime: 'All day',
  isSkipped: false,
  isConflict: false,
  conflictGroupId: null,
  enable: true,
  note: null,
  todoState: {
    completed: false,
    listSource: 'semester',
    listId: 'semester-1',
  },
};

afterEach(() => {
  vi.restoreAllMocks();
  timetableEventBus.clear();
  queryClient.clear();
});

describe('syncCalendarTodoCompletion', () => {
  it('updates the canonical semester todo cache before broadcasting a todo-data-changed event', async () => {
    const response = buildTodoStateRecord(null);
    vi.spyOn(api, 'updateSemesterTodoTask').mockResolvedValue(response);

    const todoEventPromise = new Promise<{
      semesterId: string;
      source: 'course' | 'semester';
      listId: string;
      courseId?: string;
      updatedAt: string;
    }>((resolve) => {
      timetableEventBus.subscribe('timetable:todo-data-changed', resolve);
    });

    await syncCalendarTodoCompletion({
      semesterId: 'semester-1',
      event: calendarTodoEvent,
      completed: true,
    });

    const payload = await todoEventPromise;
    expect(payload).toEqual(expect.objectContaining({
      semesterId: 'semester-1',
      source: 'semester',
      listId: 'semester-1',
      courseId: undefined,
      updatedAt: expect.any(String),
    }));
    expect(payload).not.toHaveProperty('storage');
    expect(queryClient.getQueryData(queryKeys.semesters.todo('semester-1'))).toEqual(response);
  });

  it('publishes course-scoped todo-data-changed events when the toggled task belongs to a course', async () => {
    vi.spyOn(api, 'updateSemesterTodoTask').mockResolvedValue(buildTodoStateRecord('course-1'));

    const todoEventPromise = new Promise<{
      semesterId: string;
      source: 'course' | 'semester';
      listId: string;
      courseId?: string;
      updatedAt: string;
    }>((resolve) => {
      timetableEventBus.subscribe('timetable:todo-data-changed', resolve);
    });

    await syncCalendarTodoCompletion({
      semesterId: 'semester-1',
      event: {
        ...calendarTodoEvent,
        courseId: 'course-1',
        courseName: 'Course 1',
        todoState: {
          completed: false,
          listSource: 'course',
          listId: 'course-1',
        },
      },
      completed: true,
    });

    await expect(todoEventPromise).resolves.toEqual(expect.objectContaining({
      semesterId: 'semester-1',
      source: 'course',
      listId: 'course-1',
      courseId: 'course-1',
      updatedAt: expect.any(String),
    }));
  });
});
