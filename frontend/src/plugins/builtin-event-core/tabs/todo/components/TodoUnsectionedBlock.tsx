"use no memo";

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { TodoTask } from '../types';

interface TodoUnsectionedBlockProps {
  sectionId: string;
  tasks: TodoTask[];
  dragOverSectionId: string | null;
  onDragOverSection: (event: React.DragEvent<HTMLElement>, targetSectionId: string) => void;
  onDropToSection: (
    event: React.DragEvent<HTMLElement>,
    targetSectionId: string,
    beforeTaskId: string | null,
  ) => void;
  renderTaskCard: (task: TodoTask, sectionId: string) => React.ReactNode;
}

export const TodoUnsectionedBlock: React.FC<TodoUnsectionedBlockProps> = ({
  sectionId,
  tasks,
  dragOverSectionId,
  onDragOverSection,
  onDropToSection,
  renderTaskCard,
}) => {
  return (
    <motion.div
      layout
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={cn(
        'rounded-md px-1.5 py-1',
        dragOverSectionId === sectionId && 'bg-primary/5',
      )}
      onDragOver={(event) => onDragOverSection(event, sectionId)}
      onDrop={(event) => onDropToSection(event, sectionId, null)}
    >
      <div className="space-y-1.5 pb-1">
        {tasks.length === 0 ? (
          <p className="py-1 text-xs text-muted-foreground">No tasks</p>
        ) : (
          <AnimatePresence initial={false}>
            {tasks.map((task) => renderTaskCard(task, sectionId))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
};
