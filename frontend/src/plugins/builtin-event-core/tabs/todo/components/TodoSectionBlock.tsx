import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { TodoSection, TodoTask } from '../types';

interface TodoSectionBlockProps {
  section: TodoSection;
  tasks: TodoTask[];
  completedSectionId: string;
  isOpen: boolean;
  canDeleteSection: boolean;
  dragOverSectionId: string | null;
  onOpenChange: (open: boolean) => void;
  onDragOverSection: (event: React.DragEvent<HTMLElement>, targetSectionId: string) => void;
  onDropToSection: (
    event: React.DragEvent<HTMLElement>,
    targetSectionId: string,
    beforeTaskId: string | null,
  ) => void;
  onOpenSectionTitleEditor: (section: TodoSection) => void;
  onDeleteSection: (sectionId: string) => void;
  renderTaskCard: (task: TodoTask, sectionId: string) => React.ReactNode;
}

export const TodoSectionBlock: React.FC<TodoSectionBlockProps> = ({
  section,
  tasks,
  completedSectionId,
  isOpen,
  canDeleteSection,
  dragOverSectionId,
  onOpenChange,
  onDragOverSection,
  onDropToSection,
  onOpenSectionTitleEditor,
  onDeleteSection,
  renderTaskCard,
}) => {
  const isCompletedSection = section.id === completedSectionId;

  return (
    <motion.div layout transition={{ duration: 0.2, ease: 'easeInOut' }}>
      <Collapsible open={isOpen} onOpenChange={onOpenChange}>
        <motion.div
          layout
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          onDragOver={(event) => onDragOverSection(event, section.id)}
          onDrop={(event) => onDropToSection(event, section.id, null)}
          className={cn(
            'rounded-md border px-1.5 py-1',
            isCompletedSection ? 'border-border/60 opacity-85' : 'border-border/55',
            dragOverSectionId === section.id && 'border-primary/60',
          )}
        >
          <div className="flex items-center gap-2 px-1 py-1">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="hover:bg-transparent dark:hover:bg-transparent aria-expanded:bg-transparent"
                aria-label={`Toggle ${section.name}`}
              >
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>

            <div className="min-w-0 flex flex-1 items-center">
              {isCompletedSection ? (
                <p className="truncate text-sm font-medium text-muted-foreground">{section.name}</p>
              ) : (
                <p className="truncate text-sm font-medium">{section.name}</p>
              )}
            </div>

            {!isCompletedSection ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onOpenSectionTitleEditor(section)}
                aria-label={`Edit section ${section.name}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            ) : null}

            {canDeleteSection ? (
              <Button
                type="button"
                variant="destructive"
                size="icon-xs"
                onClick={() => onDeleteSection(section.id)}
                aria-label={`Delete section ${section.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>

          <CollapsibleContent className="overflow-hidden data-open:animate-accordion-down data-closed:animate-accordion-up">
            <div
              className="space-y-1.5 px-7 pb-2 pt-1"
              onDragOver={(event) => onDragOverSection(event, section.id)}
              onDrop={(event) => onDropToSection(event, section.id, null)}
            >
              {tasks.length === 0 ? (
                <p className="px-2 py-1 text-xs text-muted-foreground">No tasks</p>
              ) : (
                <AnimatePresence initial={false}>
                  {tasks.map((task) => renderTaskCard(task, section.id))}
                </AnimatePresence>
              )}
            </div>
          </CollapsibleContent>
        </motion.div>
      </Collapsible>
    </motion.div>
  );
};
