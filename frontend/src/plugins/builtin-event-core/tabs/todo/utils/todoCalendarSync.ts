// input:  [REST api client, todo settings parsers, shared event bus, and Calendar todo events with completion metadata]
// output: [`syncCalendarTodoCompletion` helper that persists Calendar-side todo completion toggles and broadcasts Todo sync events]
// pos:    [Todo/calendar integration helper that updates stored todo data for course and semester-custom lists from Calendar interactions]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import api from '@/services/api';
import type { CalendarEventData } from '@/calendar-core';
import { BUILTIN_TIMETABLE_TODO_TAB_TYPE } from '../../../shared/constants';
import { timetableEventBus } from '../../../shared/eventBus';
import { normalizeTodoBehaviorSettings } from '../preferences';
import { TODO_SETTINGS_VERSION } from '../shared';
import type { SemesterCustomListStorage, TodoListStorage } from '../types';
import {
  normalizeCourseListStateFromTab,
  normalizeSemesterCustomLists,
  nowIso,
  parseJsonObject,
} from './todoData';
import { toggleTodoTaskCompletedInStorage } from './todoMutations';

interface SyncCalendarTodoCompletionParams {
  semesterId: string;
  event: CalendarEventData;
  completed: boolean;
}

const buildCourseTodoSettings = (baseSettings: Record<string, unknown>, storage: TodoListStorage) => ({
  ...baseSettings,
  version: TODO_SETTINGS_VERSION,
  courseList: {
    sections: storage.sections,
    tasks: storage.tasks,
  },
});

const buildSemesterTodoSettings = (
  baseSettings: Record<string, unknown>,
  lists: SemesterCustomListStorage[],
) => ({
  ...baseSettings,
  version: TODO_SETTINGS_VERSION,
  semesterCustomLists: lists,
});

export const syncCalendarTodoCompletion = async ({
  semesterId,
  event,
  completed,
}: SyncCalendarTodoCompletionParams) => {
  if (event.sourceId !== 'builtin-event-core:todo' || !event.todoState) {
    throw new Error('Only todo calendar events can be toggled from Calendar.');
  }

  if (event.todoState.listSource === 'course') {
    const course = await api.getCourse(event.courseId);
    const todoTab = course.tabs?.find((tab) => tab.tab_type === BUILTIN_TIMETABLE_TODO_TAB_TYPE);
    const parsedSettings = parseJsonObject(todoTab?.settings);
    const behavior = normalizeTodoBehaviorSettings(parsedSettings);
    const currentState = normalizeCourseListStateFromTab(event.courseId, course.name, todoTab);
    const nextStorage = toggleTodoTaskCompletedInStorage(
      { sections: currentState.sections, tasks: currentState.tasks },
      event.eventId,
      completed,
      { moveCompletedToCompletedSection: behavior.moveCompletedToCompletedSection },
    );
    const nextSettings = buildCourseTodoSettings(parsedSettings, nextStorage);

    if (todoTab?.id) {
      await api.updateTab(todoTab.id, { settings: JSON.stringify(nextSettings) });
    } else {
      await api.createTabForCourse(event.courseId, {
        tab_type: BUILTIN_TIMETABLE_TODO_TAB_TYPE,
        title: 'Todo',
        settings: JSON.stringify(nextSettings),
      });
    }

    timetableEventBus.publish('timetable:todo-storage-changed', {
      semesterId,
      source: 'course',
      courseId: event.courseId,
      listId: event.courseId,
      storage: nextStorage,
    });
    timetableEventBus.publish('timetable:schedule-data-changed', {
      semesterId,
      source: 'course',
      courseId: event.courseId,
      reason: 'events-updated',
    });
    return;
  }

  const semester = await api.getSemester(semesterId);
  const todoTab = semester.tabs?.find((tab) => tab.tab_type === BUILTIN_TIMETABLE_TODO_TAB_TYPE);
  const parsedSettings = parseJsonObject(todoTab?.settings);
  const behavior = normalizeTodoBehaviorSettings(parsedSettings);
  const currentLists = normalizeSemesterCustomLists(parsedSettings);
  const targetList = currentLists.find((list) => list.id === event.todoState?.listId);

  if (!targetList) {
    throw new Error('Todo list could not be found for this calendar event.');
  }

  const nextStorage = toggleTodoTaskCompletedInStorage(
    { sections: targetList.sections, tasks: targetList.tasks },
    event.eventId,
    completed,
    { moveCompletedToCompletedSection: behavior.moveCompletedToCompletedSection },
  );
  const nextLists = currentLists.map((list) => {
    if (list.id !== targetList.id) return list;
    return {
      ...list,
      sections: nextStorage.sections,
      tasks: nextStorage.tasks,
      updatedAt: nowIso(),
    };
  });
  const nextSettings = buildSemesterTodoSettings(parsedSettings, nextLists);

  if (todoTab?.id) {
    await api.updateTab(todoTab.id, { settings: JSON.stringify(nextSettings) });
  } else {
    await api.createTab(semesterId, {
      tab_type: BUILTIN_TIMETABLE_TODO_TAB_TYPE,
      title: 'Todo',
      settings: JSON.stringify(nextSettings),
    });
  }

  timetableEventBus.publish('timetable:todo-storage-changed', {
    semesterId,
    source: 'semester-custom',
    listId: targetList.id,
    storage: nextStorage,
  });
  timetableEventBus.publish('timetable:schedule-data-changed', {
    semesterId,
    source: 'semester',
    reason: 'events-updated',
  });
};
