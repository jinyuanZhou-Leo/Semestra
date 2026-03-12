// input:  [Unsectioned active/completed tasks, drag state, drop handlers, and task/composer renderers]
// output: [TodoUnsectionedBlock React component]
// pos:    [Top-level unsectioned bucket shown before explicit section groups with inline creation at the bottom]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to
"use no memo";

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { TodoTask } from '../types';

interface TodoUnsectionedBlockProps {
  sectionId: string;
  visibleTasks: TodoTask[];
  dragOverSectionId: string | null;
  onDragOverSection: (event: React.DragEvent<HTMLElement>, targetSectionId: string) => void;
  onDropToSection: (
    event: React.DragEvent<HTMLElement>,
    targetSectionId: string,
    beforeTaskId: string | null,
  ) => void;
  renderTaskCard: (task: TodoTask, sectionId: string) => React.ReactNode;
  composer: React.ReactNode;
}

export const TodoUnsectionedBlock: React.FC<TodoUnsectionedBlockProps> = ({
  sectionId,
  visibleTasks,
  dragOverSectionId,
  onDragOverSection,
  onDropToSection,
  renderTaskCard,
  composer,
}) => {
  return (
    <motion.div
      layout
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={cn(
        'px-0.5 py-1 sm:px-1.5',
        dragOverSectionId === sectionId && 'bg-primary/5',
      )}
      onDragOver={(event) => onDragOverSection(event, sectionId)}
      onDrop={(event) => onDropToSection(event, sectionId, null)}
    >
      <div className="space-y-1.5 pb-1 pr-0.5 sm:pr-1">
        {visibleTasks.length === 0 ? (
          <p className="py-1 text-xs text-muted-foreground">No tasks</p>
        ) : null}

        <AnimatePresence initial={false}>
          {visibleTasks.map((task) => renderTaskCard(task, sectionId))}
        </AnimatePresence>

        {composer}
      </div>
    </motion.div>
  );
};
