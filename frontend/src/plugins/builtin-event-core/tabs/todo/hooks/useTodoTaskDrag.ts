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

  // Ref mirrors draggingTaskId for synchronous reads inside drag event handlers.
  // React state updates are batched and may not be visible to the dragOver/drop
  // handlers that fire in the same event loop tick as dragStart, causing the
  // browser to withhold the drop cursor because event.preventDefault() was never
  // called. The ref is updated synchronously so all handlers see the correct value.
  const draggingTaskIdRef = React.useRef<string | null>(null);

  const resetTaskDragState = React.useCallback(() => {
    draggingTaskIdRef.current = null;
    setDraggingTaskId(null);
    setDragOverSectionId(null);
    setDragOverTaskId(null);
  }, []);

  const handleTaskDragStart = React.useCallback((task: TodoTask) => {
    if (task.completed) return;
    draggingTaskIdRef.current = task.id;
    setDraggingTaskId(task.id);
  }, []);

  const handleTaskDragEnd = React.useCallback(() => {
    resetTaskDragState();
  }, [resetTaskDragState]);

  const handleTaskDragOverSection = React.useCallback((
    event: React.DragEvent<HTMLElement>,
    targetSectionId: string,
  ) => {
    if (!draggingTaskIdRef.current) return;
    event.preventDefault();
    setDragOverSectionId(targetSectionId);
    setDragOverTaskId(null);
  }, []);

  const handleTaskDragOverItem = React.useCallback((
    event: React.DragEvent<HTMLElement>,
    targetSectionId: string,
    beforeTaskId: string,
  ) => {
    if (!draggingTaskIdRef.current) return;
    event.preventDefault();
    // Stop bubbling so the parent section handler does not overwrite dragOverTaskId with null.
    event.stopPropagation();
    setDragOverSectionId(targetSectionId);
    setDragOverTaskId(beforeTaskId);
  }, []);

  const handleTaskDropToSection = React.useCallback((
    event: React.DragEvent<HTMLElement>,
    targetSectionId: string,
    beforeTaskId: string | null = null,
  ) => {
    event.preventDefault();
    // Stop bubbling when dropping on a specific task so the section-level onDrop
    // handler does not fire a second time with beforeTaskId=null.
    if (beforeTaskId !== null) {
      event.stopPropagation();
    }
    const currentDraggingId = draggingTaskIdRef.current;
    if (!currentDraggingId) return;
    if (beforeTaskId && beforeTaskId === currentDraggingId) {
      resetTaskDragState();
      return;
    }

    onTaskDrop(currentDraggingId, targetSectionId, beforeTaskId);
    resetTaskDragState();
  }, [onTaskDrop, resetTaskDragState]);

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
