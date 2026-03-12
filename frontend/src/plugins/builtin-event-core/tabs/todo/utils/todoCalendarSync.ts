// input:  [REST api client, semester-scoped todo settings parsers, shared event bus, and Calendar todo events with completion metadata]
// output: [`syncCalendarTodoCompletion` helper that persists Calendar-side todo completion toggles into semester and mirrored course todo storage]
// pos:    [Todo/calendar integration helper that updates the synchronized semester aggregate and course-specific mirrors from Calendar interactions]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import api from '@/services/api';
import type { CalendarEventData } from '@/calendar-core';
import { BUILTIN_TIMETABLE_TODO_TAB_TYPE } from '../../../shared/constants';
import { timetableEventBus } from '../../../shared/eventBus';
import { normalizeTodoBehaviorSettings } from '../preferences';
import type { TodoCourseOption } from '../types';
import {
  buildCourseMirrorStorage,
  normalizeSemesterTodoState,
  parseJsonObject,
  serializeCourseTodoSettings,
  serializeSemesterTodoSettings,
} from './todoData';
import { toggleTodoTaskCompletedInStorage } from './todoMutations';

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

  const semester = await api.getSemester(semesterId);
  const courseOptions: TodoCourseOption[] = (semester.courses ?? []).map((course) => ({
    id: course.id,
    name: course.name,
    category: course.category ?? '',
    color: course.color ?? '',
  }));
  const courseDetails = await Promise.all(
    courseOptions.map(async (course) => {
      try {
        const detail = await api.getCourse(course.id);
        return { ...course, detail };
      } catch {
        return { ...course, detail: undefined };
      }
    }),
  );

  const semesterTodoTab = semester.tabs?.find((tab) => tab.tab_type === BUILTIN_TIMETABLE_TODO_TAB_TYPE);
  const semesterSettings = parseJsonObject(semesterTodoTab?.settings);
  const semesterState = normalizeSemesterTodoState(
    semesterSettings,
    courseDetails.map((course) => ({
      courseId: course.id,
      courseName: course.name,
      courseCategory: course.category,
      courseColor: course.color,
      todoTab: course.detail?.tabs?.find((tab) => tab.tab_type === BUILTIN_TIMETABLE_TODO_TAB_TYPE),
    })),
  );
  const behavior = normalizeTodoBehaviorSettings(semesterSettings);
  const nextStorage = toggleTodoTaskCompletedInStorage(
    { sections: semesterState.sections, tasks: semesterState.tasks },
    event.eventId,
    completed,
    { moveCompletedToCompletedSection: behavior.moveCompletedToCompletedSection },
  );
  const nextSemesterSettings = serializeSemesterTodoSettings(semesterSettings, nextStorage);

  if (semesterTodoTab?.id) {
    await api.updateTab(semesterTodoTab.id, { settings: JSON.stringify(nextSemesterSettings) });
  } else {
    await api.createTab(semesterId, {
      tab_type: BUILTIN_TIMETABLE_TODO_TAB_TYPE,
      title: 'Todo',
      settings: JSON.stringify(nextSemesterSettings),
    });
  }

  const toggledTask = nextStorage.tasks.find((task) => task.id === event.eventId);
  if (toggledTask?.courseId) {
    const targetCourse = courseDetails.find((course) => course.id === toggledTask.courseId);
    if (targetCourse) {
      const mirroredStorage = buildCourseMirrorStorage(nextStorage, targetCourse);
      const courseTodoTab = targetCourse.detail?.tabs?.find((tab) => tab.tab_type === BUILTIN_TIMETABLE_TODO_TAB_TYPE);
      const courseSettings = parseJsonObject(courseTodoTab?.settings);
      const nextCourseSettings = serializeCourseTodoSettings(courseSettings, mirroredStorage);

      if (courseTodoTab?.id) {
        await api.updateTab(courseTodoTab.id, { settings: JSON.stringify(nextCourseSettings) });
      } else {
        await api.createTabForCourse(targetCourse.id, {
          tab_type: BUILTIN_TIMETABLE_TODO_TAB_TYPE,
          title: 'Todo',
          settings: JSON.stringify(nextCourseSettings),
        });
      }
    }
  }

  timetableEventBus.publish('timetable:todo-storage-changed', {
    semesterId,
    source: 'semester',
    listId: semesterId,
    storage: nextStorage,
  });
  timetableEventBus.publish('timetable:schedule-data-changed', {
    semesterId,
    source: toggledTask?.courseId ? 'course' : 'semester',
    courseId: toggledTask?.courseId || undefined,
    reason: 'events-updated',
  });
};
