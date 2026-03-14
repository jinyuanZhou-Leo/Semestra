// input:  [semester todo APIs, todo query cache keys, shared event bus, and Calendar todo events with completion metadata]
// output: [`syncCalendarTodoCompletion` helper that persists Calendar-side todo completion toggles through the semester todo API]
// pos:    [Todo/calendar integration helper that updates canonical semester todo cache from Calendar interactions before broadcasting domain refresh signals]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import api from '@/services/api';
import type { CalendarEventData } from '@/calendar-core';
import { queryClient } from '@/services/queryClient';
import { queryKeys } from '@/services/queryKeys';
import { timetableEventBus } from '../../../shared/eventBus';
import { publishTimetableScheduleChange } from '../../../shared/publishTimetableScheduleChange';

interface SyncCalendarTodoCompletionParams {
  semesterId: string;
  event: CalendarEventData;
  completed: boolean;
}

export const syncCalendarTodoCompletion = async ({
  semesterId,
  event,
  completed,
}: SyncCalendarTodoCompletionParams) => {
  if (event.sourceId !== 'builtin-event-core:todo' || !event.todoState) {
    throw new Error('Only todo calendar events can be toggled from Calendar.');
  }

  const response = await api.updateSemesterTodoTask(semesterId, event.eventId, { completed });
  queryClient.setQueryData(queryKeys.semesters.todo(semesterId), response);
  const toggledTask = response.tasks.find((task) => task.id === event.eventId);

  timetableEventBus.publish('timetable:todo-data-changed', {
    semesterId,
    source: toggledTask?.course_id ? 'course' : 'semester',
    listId: toggledTask?.course_id || semesterId,
    courseId: toggledTask?.course_id || undefined,
    updatedAt: new Date().toISOString(),
  });
  await publishTimetableScheduleChange({
    semesterId,
    source: toggledTask?.course_id ? 'course' : 'semester',
    courseId: toggledTask?.course_id || undefined,
    reason: 'events-updated',
  });
};
