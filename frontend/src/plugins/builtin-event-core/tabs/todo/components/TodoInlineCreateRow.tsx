// input:  [Inline task target metadata, semester course options, shared todo row shell/chip editors, and save callbacks]
// output: [TodoInlineCreateRow React component]
// pos:    [Compact section-scoped inline composer that keeps per-instance draft state local while reusing the shared todo row shell]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to
"use no memo";

import React from 'react';
import { cn } from '@/lib/utils';
import { TodoMetaEditorChips } from './TodoMetaEditorChips';
import { TODO_ROW_NOTE_CLASSNAME, TODO_ROW_TITLE_CLASSNAME, TodoRowShell, type TodoRowMode } from './TodoRowShell';
import type { TaskDraft, TodoCourseOption, TodoPriorityOption, TodoTabMode } from '../types';
import { createTaskDraft } from '../utils/todoData';

interface TodoInlineCreateRowProps {
  mode: TodoTabMode;
  sectionId: string;
  initialCourseId?: string;
  courseOptions: TodoCourseOption[];
  priorityOptions: TodoPriorityOption[];
  placeholder?: string;
  onSave: (draft: TaskDraft) => Promise<boolean> | boolean;
}

export const TodoInlineCreateRow: React.FC<TodoInlineCreateRowProps> = ({
  mode,
  sectionId,
  initialCourseId = '',
  courseOptions,
  priorityOptions,
  placeholder = 'Add a todo',
  onSave,
}) => {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const titleInputRef = React.useRef<HTMLInputElement | null>(null);
  const shouldFocusTitleRef = React.useRef(false);
  const savingRef = React.useRef(false);
  const normalizedSectionId = sectionId === '__unsectioned__' ? '' : sectionId;
  const createLocalDraft = React.useCallback(
    () => createTaskDraft(normalizedSectionId, initialCourseId),
    [initialCourseId, normalizedSectionId],
  );
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<TaskDraft>(() => createLocalDraft());
  const draftRef = React.useRef(draft);
  const rowMode: TodoRowMode = open ? 'creating' : 'placeholder';

  const resetComposer = React.useCallback(() => {
    setOpen(false);
    setDraft(createLocalDraft());
    shouldFocusTitleRef.current = false;
  }, [createLocalDraft]);

  const activateComposer = React.useCallback((focusTitle: boolean) => {
    if (focusTitle) {
      shouldFocusTitleRef.current = true;
    }
    setOpen(true);
  }, []);

  React.useEffect(() => {
    if (open) return;
    setDraft(createLocalDraft());
  }, [createLocalDraft, open]);

  React.useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  React.useLayoutEffect(() => {
    if (!open || !shouldFocusTitleRef.current) return;
    shouldFocusTitleRef.current = false;
    titleInputRef.current?.focus();
  }, [open]);

  const commitDraft = React.useCallback(async () => {
    const nextDraft = draftRef.current;
    if (!nextDraft.title.trim()) {
      resetComposer();
      return;
    }
    if (savingRef.current) return;

    savingRef.current = true;
    try {
      const saved = await onSave(nextDraft);
      if (saved) {
        resetComposer();
      }
    } finally {
      savingRef.current = false;
    }
  }, [onSave, resetComposer]);

  return (
    <TodoRowShell
      ref={rootRef}
      mode={rowMode}
      data-todo-inline-create-root="true"
      className="w-full"
      onPointerDownCapture={(event) => {
        if (open) return;
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.closest('input,textarea,button,[role="button"]')) return;
        activateComposer(true);
      }}
      onBlurCapture={(event) => {
        if (!open) return;
        const nextTarget = event.relatedTarget as HTMLElement | null;
        if (nextTarget && rootRef.current?.contains(nextTarget)) return;
        if (nextTarget?.closest('[data-slot="popover-content"],[data-slot="select-content"]')) return;
        void commitDraft();
      }}
      leading={(
        <span
          className={cn(
            'mt-0.5 block size-5 shrink-0 rounded-full border border-dashed',
            open ? 'border-muted-foreground/50' : 'border-current/55',
          )}
        />
      )}
    >
      <input
        ref={titleInputRef}
        type="text"
        value={draft.title}
        readOnly={!open}
        aria-label="Todo title"
        placeholder={placeholder}
        onFocus={() => {
          if (!open) {
            activateComposer(false);
          }
        }}
        onPointerDown={() => {
          if (!open) {
            activateComposer(false);
          }
        }}
        onChange={(event) => setDraft((previous) => ({ ...previous, title: event.target.value }))}
        onKeyDown={(event) => {
          if (!open && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            activateComposer(true);
            return;
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void commitDraft();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            resetComposer();
          }
        }}
        className={cn(
          TODO_ROW_TITLE_CLASSNAME,
          open
            ? 'text-foreground placeholder:text-muted-foreground'
            : 'cursor-text text-muted-foreground placeholder:text-muted-foreground',
        )}
      />

      {open ? (
        <>
          <textarea
            value={draft.note}
            onChange={(event) => setDraft((previous) => ({ ...previous, note: event.target.value }))}
            rows={draft.note ? Math.min(Math.max(draft.note.split('\n').length, 1), 4) : 1}
            placeholder="Notes"
            className={cn(
              TODO_ROW_NOTE_CLASSNAME,
              'min-h-0 w-full resize-none text-muted-foreground/88 placeholder:text-muted-foreground/80',
            )}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                void commitDraft();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                titleInputRef.current?.focus();
              }
            }}
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
              onChange={(patch) => setDraft((previous) => ({ ...previous, ...patch }))}
            />
          </div>
        </>
      ) : null}
    </TodoRowShell>
  );
};
