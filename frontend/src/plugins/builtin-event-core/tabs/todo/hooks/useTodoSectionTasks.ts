import React from 'react';
import { COMPLETED_SECTION_ID, UNSECTIONED_TASK_BUCKET_ID } from '../shared';
import type { TodoListModel, TodoSortDirection, TodoSortMode, TodoTask } from '../types';
import { sortTasksForDisplay, userSectionsOf } from '../utils/todoData';

interface UseTodoSectionTasksParams {
  activeList: TodoListModel | null;
  sortMode: TodoSortMode;
  sortDirection: TodoSortDirection;
}

export const useTodoSectionTasks = ({ activeList, sortMode, sortDirection }: UseTodoSectionTasksParams) => {
  const sectionTasksMap = React.useMemo(() => {
    if (!activeList) return new Map<string, TodoTask[]>();

    const map = new Map<string, TodoTask[]>();
    map.set(UNSECTIONED_TASK_BUCKET_ID, []);
    activeList.sections.forEach((section) => map.set(section.id, []));

    activeList.tasks.forEach((task) => {
      const bucket = map.get(task.sectionId) ?? map.get(UNSECTIONED_TASK_BUCKET_ID);
      if (!bucket) return;
      bucket.push(task);
    });

    map.forEach((tasks, sectionId) => {
      map.set(sectionId, sortTasksForDisplay(tasks, sectionId === COMPLETED_SECTION_ID, sortMode, sortDirection));
    });

    return map;
  }, [activeList, sortDirection, sortMode]);

  const activeListUserSections = React.useMemo(() => {
    return activeList ? userSectionsOf(activeList.sections) : [];
  }, [activeList]);

  const unsectionedTasks = React.useMemo(() => {
    return activeList ? (sectionTasksMap.get(UNSECTIONED_TASK_BUCKET_ID) ?? []) : [];
  }, [activeList, sectionTasksMap]);

  return {
    sectionTasksMap,
    activeListUserSections,
    unsectionedTasks,
  };
};
