// input:  [Dragged todo tasks and drop target callbacks from TodoTab]
// output: [useTodoTaskDrag hook]
// pos:    [Local interaction hook that tracks the currently dragged task and section-level drop targets]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to
import React from 'react';
import type { TodoTask } from '../types';

interface UseTodoTaskDragParams {
  onTaskDrop: (
    sourceTaskId: string,
    targetSectionId: string,
    beforeTaskId: string | null,
  ) => void;
}

export const useTodoTaskDrag = ({ onTaskDrop }: UseTodoTaskDragParams) => {
  const [draggingTaskId, setDraggingTaskId] = React.useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = React.useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = React.useState<string | null>(null);

  const resetTaskDragState = React.useCallback(() => {
    setDraggingTaskId(null);
    setDragOverSectionId(null);
    setDragOverTaskId(null);
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
    setDragOverTaskId(null);
  }, [draggingTaskId]);

  const handleTaskDragOverItem = React.useCallback((
    event: React.DragEvent<HTMLElement>,
    targetSectionId: string,
    beforeTaskId: string,
  ) => {
    if (!draggingTaskId) return;
    event.preventDefault();
    setDragOverSectionId(targetSectionId);
    setDragOverTaskId(beforeTaskId);
  }, [draggingTaskId]);

  const handleTaskDropToSection = React.useCallback((
    event: React.DragEvent<HTMLElement>,
    targetSectionId: string,
    beforeTaskId: string | null = null,
  ) => {
    event.preventDefault();
    if (!draggingTaskId) return;
    if (beforeTaskId && beforeTaskId === draggingTaskId) {
      resetTaskDragState();
      return;
    }

    onTaskDrop(draggingTaskId, targetSectionId, beforeTaskId);
    resetTaskDragState();
  }, [draggingTaskId, onTaskDrop, resetTaskDragState]);

  return {
    draggingTaskId,
    dragOverSectionId,
    dragOverTaskId,
    resetTaskDragState,
    handleTaskDragStart,
    handleTaskDragEnd,
    handleTaskDragOverSection,
    handleTaskDragOverItem,
    handleTaskDropToSection,
  };
};
