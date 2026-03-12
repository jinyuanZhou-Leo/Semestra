// input:  [todo list storage, task completion targets, section constants, and timestamp helpers]
// output: [`toggleTodoTaskCompletedInStorage` shared mutation helper for consistent completion toggles across Todo and Calendar]
// pos:    [Todo data mutation helper layer reused by Todo tab orchestration and Calendar-side todo completion sync]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { COMPLETED_SECTION_ID } from '../shared';
import type { TodoListStorage } from '../types';
import { nowIso, userSectionsOf } from './todoData';

interface ToggleTodoTaskCompletedOptions {
  moveCompletedToCompletedSection: boolean;
}

export const toggleTodoTaskCompletedInStorage = (
  current: TodoListStorage,
  taskId: string,
  completed: boolean,
  options: ToggleTodoTaskCompletedOptions,
): TodoListStorage => {
  let changed = false;
  const users = userSectionsOf(current.sections);

  const nextTasks = current.tasks.map((task) => {
    if (task.id !== taskId) return task;
    changed = true;

    if (!completed) {
      const restoreSectionId = task.sectionId === COMPLETED_SECTION_ID
        ? (task.originSectionId && users.some((section) => section.id === task.originSectionId)
          ? task.originSectionId
          : '')
        : task.sectionId;

      return {
        ...task,
        completed: false,
        sectionId: restoreSectionId,
        originSectionId: undefined,
        updatedAt: nowIso(),
      };
    }

    return {
      ...task,
      completed: true,
      sectionId: options.moveCompletedToCompletedSection ? COMPLETED_SECTION_ID : task.sectionId,
      originSectionId: task.sectionId === COMPLETED_SECTION_ID
        ? task.originSectionId
        : (task.originSectionId ?? (task.sectionId || undefined)),
      updatedAt: nowIso(),
    };
  });

  if (!changed) return current;

  return {
    ...current,
    tasks: nextTasks,
  };
};
