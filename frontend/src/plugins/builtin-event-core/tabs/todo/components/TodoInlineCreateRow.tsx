// input:  [Inline task draft state, semester course options, shared chip editors, and create/cancel callbacks]
// output: [TodoInlineCreateRow React component]
// pos:    [Compact section-scoped inline composer used for Apple Reminders-style task creation]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to
"use no memo";

import React from 'react';
import { cn } from '@/lib/utils';
import { TodoMetaEditorChips } from './TodoMetaEditorChips';
import type { TaskDraft, TodoCourseOption, TodoPriorityOption, TodoTabMode } from '../types';

interface TodoInlineCreateRowProps {
  mode: TodoTabMode;
  open: boolean;
  draft: TaskDraft;
  courseOptions: TodoCourseOption[];
  priorityOptions: TodoPriorityOption[];
  placeholder?: string;
  onOpen: () => void;
  onDraftChange: (updater: (previous: TaskDraft) => TaskDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}

export const TodoInlineCreateRow: React.FC<TodoInlineCreateRowProps> = ({
  mode,
  open,
  draft,
  courseOptions,
  priorityOptions,
  placeholder = 'Add a todo',
  onOpen,
  onDraftChange,
  onCancel,
  onSave,
}) => {
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-10 w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/25 hover:text-foreground sm:px-2"
      >
        <span className="mt-0.5 block size-5 shrink-0 rounded-full border border-dashed border-current/55" />
        <span className="truncate text-[15px] leading-6">{placeholder}</span>
      </button>
    );
  }

  return (
    <div
      ref={rootRef}
      className="rounded-[18px] px-3 py-2.5 sm:px-2"
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget as HTMLElement | null;
        if (nextTarget && rootRef.current?.contains(nextTarget)) return;
        if (nextTarget?.closest('[data-slot="popover-content"],[data-slot="select-content"]')) return;
        onCancel();
      }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 block size-5 shrink-0 rounded-full border border-dashed border-muted-foreground/50" />

        <div className="min-w-0 flex-1 space-y-0.5">
          <input
            type="text"
            value={draft.title}
            onChange={(event) => onDraftChange((previous) => ({ ...previous, title: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                onSave();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                onCancel();
              }
            }}
            placeholder="Title"
            autoFocus
            className={cn(
              'block h-auto max-w-full border-0 bg-transparent p-0 text-[16px] font-medium leading-6 text-foreground outline-none placeholder:text-muted-foreground',
            )}
          />

          <input
            type="text"
            value=""
            readOnly
            tabIndex={-1}
            placeholder="Notes"
            className="block h-auto max-w-full border-0 bg-transparent p-0 text-[14px] leading-[1.25] text-muted-foreground/88 outline-none placeholder:text-muted-foreground/80"
          />

          <div className="pt-1">
            <TodoMetaEditorChips
              mode={mode}
              dueDate={draft.dueDate}
              dueTime={draft.dueTime}
              priority={draft.priority}
              courseId={draft.courseId}
              courseOptions={courseOptions}
              priorityOptions={priorityOptions}
              compact
              onChange={(patch) => onDraftChange((previous) => ({ ...previous, ...patch }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
