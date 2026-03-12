// input:  [Todo section/task data plus drag targets, inline rename state, and section actions]
// output: [TodoSectionBlock React component]
// pos:    [Collapsible section wrapper that lays out title editing, task buckets, and section-scoped inline creation]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to
"use no memo";

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import type { TodoSection, TodoTask } from '../types';

interface TodoSectionBlockProps {
  section: TodoSection;
  visibleTasks: TodoTask[];
  isOpen: boolean;
  canDeleteSection: boolean;
  isEditingTitle: boolean;
  titleDraft: string;
  dragOverSectionId: string | null;
  onOpenChange: (open: boolean) => void;
  onDragOverSection: (event: React.DragEvent<HTMLElement>, targetSectionId: string) => void;
  onDropToSection: (
    event: React.DragEvent<HTMLElement>,
    targetSectionId: string,
    beforeTaskId: string | null,
  ) => void;
  onStartEditingTitle: (section: TodoSection) => void;
  onTitleDraftChange: (value: string) => void;
  onSubmitTitle: () => void;
  onCancelTitle: () => void;
  onRequestDeleteSection: (section: TodoSection) => void;
  renderTaskCard: (task: TodoTask, sectionId: string) => React.ReactNode;
  composer: React.ReactNode;
}

export const TodoSectionBlock: React.FC<TodoSectionBlockProps> = ({
  section,
  visibleTasks,
  isOpen,
  canDeleteSection,
  isEditingTitle,
  titleDraft,
  dragOverSectionId,
  onOpenChange,
  onDragOverSection,
  onDropToSection,
  onStartEditingTitle,
  onTitleDraftChange,
  onSubmitTitle,
  onCancelTitle,
  onRequestDeleteSection,
  renderTaskCard,
  composer,
}) => {
  return (
    <motion.div layout transition={{ duration: 0.2, ease: 'easeInOut' }}>
      <Collapsible open={isOpen} onOpenChange={onOpenChange}>
        <motion.div
          layout
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          onDragOver={(event) => onDragOverSection(event, section.id)}
          onDrop={(event) => onDropToSection(event, section.id, null)}
          className={cn(
            'border-t border-border/70 px-0 py-3 first:border-t-0 sm:px-1.5',
            dragOverSectionId === section.id && 'bg-primary/5',
          )}
        >
          <div className="flex items-center gap-1.5 px-0 py-1 sm:gap-2 sm:px-1">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-8 text-foreground/90 hover:bg-transparent dark:hover:bg-transparent aria-expanded:bg-transparent"
                aria-label={`Toggle ${section.name}`}
              >
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>

            <div className="min-w-0 flex-1">
              {isEditingTitle ? (
                <Input
                  value={titleDraft}
                  onChange={(event) => onTitleDraftChange(event.target.value)}
                  onBlur={onSubmitTitle}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      onSubmitTitle();
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      onCancelTitle();
                    }
                  }}
                  autoFocus
                  className="h-10 border-0 px-0 text-[20px] font-semibold shadow-none focus-visible:ring-0"
                />
              ) : (
                <button
                  type="button"
                  className="truncate text-left text-[20px] font-semibold tracking-tight hover:text-foreground"
                  onClick={() => onStartEditingTitle(section)}
                >
                  {section.name}
                </button>
              )}
            </div>

            {canDeleteSection ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onRequestDeleteSection(section)}
                aria-label={`Delete section ${section.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>

          <CollapsibleContent className="overflow-hidden data-open:animate-accordion-down data-closed:animate-accordion-up">
            <div
              className="space-y-1.5 pb-2 pl-0 pr-0.5 pt-1 sm:pl-7 sm:pr-1"
              onDragOver={(event) => onDragOverSection(event, section.id)}
              onDrop={(event) => onDropToSection(event, section.id, null)}
            >
              {visibleTasks.length === 0 ? (
                <p className="px-2 py-1 text-xs text-muted-foreground">No tasks</p>
              ) : null}

              <AnimatePresence initial={false}>
                {visibleTasks.map((task) => renderTaskCard(task, section.id))}
              </AnimatePresence>

              {composer}
            </div>
          </CollapsibleContent>
        </motion.div>
      </Collapsible>
    </motion.div>
  );
};
