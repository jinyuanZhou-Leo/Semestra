import React from 'react';
import type { TodoListModel, TodoTask } from '../types';

interface UseTodoTaskDragParams {
  onTaskDrop: (
    list: TodoListModel,
    sourceTaskId: string,
    targetSectionId: string,
    beforeTaskId: string | null,
  ) => void;
}

export const useTodoTaskDrag = ({ onTaskDrop }: UseTodoTaskDragParams) => {
  const [draggingTaskId, setDraggingTaskId] = React.useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = React.useState<string | null>(null);

  const resetTaskDragState = React.useCallback(() => {
    setDraggingTaskId(null);
    setDragOverSectionId(null);
  }, []);

  const handleTaskDragStart = React.useCallback((task: TodoTask) => {
    if (task.completed) return;
    setDraggingTaskId(task.id);
  }, []);

  const handleTaskDragEnd = React.useCallback(() => {
    resetTaskDragState();
  }, [resetTaskDragState]);

  const handleTaskDragOverSection = React.useCallback((
    event: React.DragEvent<HTMLElement>,
    targetSectionId: string,
  ) => {
    if (!draggingTaskId) return;
    event.preventDefault();
    setDragOverSectionId(targetSectionId);
  }, [draggingTaskId]);

  const handleTaskDropToSection = React.useCallback((
    event: React.DragEvent<HTMLElement>,
    list: TodoListModel,
    targetSectionId: string,
    beforeTaskId: string | null = null,
  ) => {
    event.preventDefault();
    if (!draggingTaskId) return;
    if (beforeTaskId && beforeTaskId === draggingTaskId) {
      resetTaskDragState();
      return;
    }

    onTaskDrop(list, draggingTaskId, targetSectionId, beforeTaskId);
    resetTaskDragState();
  }, [draggingTaskId, onTaskDrop, resetTaskDragState]);

  return {
    draggingTaskId,
    dragOverSectionId,
    resetTaskDragState,
    handleTaskDragStart,
    handleTaskDragEnd,
    handleTaskDragOverSection,
    handleTaskDropToSection,
  };
};
