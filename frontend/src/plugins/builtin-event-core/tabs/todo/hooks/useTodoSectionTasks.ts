import React from 'react';
import { COMPLETED_SECTION_ID, UNSECTIONED_TASK_BUCKET_ID } from '../shared';
import type { TodoListModel, TodoSectionTaskBuckets, TodoSortDirection, TodoSortMode, TodoTask } from '../types';
import { sortTasksForDisplay, userSectionsOf } from '../utils/todoData';

interface UseTodoSectionTasksParams {
  activeList: TodoListModel | null;
  sortMode: TodoSortMode;
  sortDirection: TodoSortDirection;
  showCompleted: boolean;
  recentCompletedTaskIds: Set<string>;
}

export const useTodoSectionTasks = ({ activeList, sortMode, sortDirection, showCompleted, recentCompletedTaskIds }: UseTodoSectionTasksParams) => {
  const sectionTasksMap = React.useMemo(() => {
    if (!activeList) return new Map<string, TodoSectionTaskBuckets>();

    const map = new Map<string, TodoSectionTaskBuckets>();
    map.set(UNSECTIONED_TASK_BUCKET_ID, { active: [], completed: [], visible: [] });
    activeList.sections
      .filter((section) => section.id !== COMPLETED_SECTION_ID)
      .forEach((section) => map.set(section.id, { active: [], completed: [], visible: [] }));

    const resolveBucketId = (task: TodoTask) => {
      const candidate = task.sectionId === COMPLETED_SECTION_ID
        ? (task.originSectionId ?? '')
        : task.sectionId;

      return map.has(candidate) ? candidate : UNSECTIONED_TASK_BUCKET_ID;
    };

    activeList.tasks.forEach((task) => {
      const bucket = map.get(resolveBucketId(task)) ?? map.get(UNSECTIONED_TASK_BUCKET_ID);
      if (!bucket) return;
      if (task.completed) {
        bucket.completed.push(task);
        return;
      }
      bucket.active.push(task);
    });

    map.forEach((tasks, sectionId) => {
      const sortedActiveTasks = sortTasksForDisplay(tasks.active, false, sortMode, sortDirection);
      const sortedCompletedTasks = sortTasksForDisplay(tasks.completed, true, 'created', 'asc');
      const visibleCompletedTasks = tasks.completed.filter((task) => showCompleted || recentCompletedTaskIds.has(task.id));
      const sortedVisibleCompletedTasks = sortedCompletedTasks.filter((task) => showCompleted || recentCompletedTaskIds.has(task.id));
      map.set(sectionId, {
        active: sortedActiveTasks,
        completed: sortedCompletedTasks,
        visible: visibleCompletedTasks.length > 0
          ? [...sortedActiveTasks, ...sortedVisibleCompletedTasks]
          : sortedActiveTasks,
      });
    });

    return map;
  }, [activeList, recentCompletedTaskIds, showCompleted, sortDirection, sortMode]);

  const activeListUserSections = React.useMemo(() => {
    return activeList ? userSectionsOf(activeList.sections) : [];
  }, [activeList]);

  const unsectionedTasks = React.useMemo(() => {
    return activeList
      ? (sectionTasksMap.get(UNSECTIONED_TASK_BUCKET_ID) ?? { active: [], completed: [], visible: [] })
      : { active: [], completed: [], visible: [] };
  }, [activeList, sectionTasksMap]);

  return {
    sectionTasksMap,
    activeListUserSections,
    unsectionedTasks,
  };
};
