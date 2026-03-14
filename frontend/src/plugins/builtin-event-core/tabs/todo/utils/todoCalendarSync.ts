// input:  [semester todo APIs, todo runtime mapping helpers, shared event bus, and Calendar todo events with completion metadata]
// output: [`syncCalendarTodoCompletion` helper that persists Calendar-side todo completion toggles through the semester todo API]
// pos:    [Todo/calendar integration helper that updates semester todo state from Calendar interactions without using tab.settings persistence]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import api from '@/services/api';
import type { CalendarEventData } from '@/calendar-core';
import { timetableEventBus } from '../../../shared/eventBus';
import { publishTimetableScheduleChange } from '../../../shared/publishTimetableScheduleChange';
import { fromTodoApiState } from './todoData';

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
  const runtimeState = fromTodoApiState(response, true);
  const toggledTask = runtimeState.tasks.find((task) => task.id === event.eventId);

  timetableEventBus.publish('timetable:todo-storage-changed', {
    semesterId,
    source: 'semester',
    listId: semesterId,
    storage: {
      sections: runtimeState.sections,
      tasks: runtimeState.tasks,
    },
  });
  await publishTimetableScheduleChange({
    semesterId,
    source: toggledTask?.courseId ? 'course' : 'semester',
    courseId: toggledTask?.courseId || undefined,
    reason: 'events-updated',
  });
};
