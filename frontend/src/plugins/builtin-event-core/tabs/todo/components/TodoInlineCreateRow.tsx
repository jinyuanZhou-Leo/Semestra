// input:  [Inline task draft state, semester course options, and create/cancel callbacks]
// output: [TodoInlineCreateRow React component]
// pos:    [Apple Reminder-inspired inline composer shown at the bottom of the todo list with editable tag pills]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to
"use no memo";

import React from 'react';
import { CalendarDays, Clock3, Flag, GraduationCap, PlusCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { TaskDraft, TodoCourseOption, TodoPriority, TodoPriorityOption, TodoTabMode } from '../types';

interface TodoInlineCreateRowProps {
  mode: TodoTabMode;
  open: boolean;
  draft: TaskDraft;
  courseOptions: TodoCourseOption[];
  priorityOptions: TodoPriorityOption[];
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
  onOpen,
  onDraftChange,
  onCancel,
  onSave,
}) => {
  const [showDateEditor, setShowDateEditor] = React.useState(false);
  const [showTimeEditor, setShowTimeEditor] = React.useState(false);
  const [showPriorityEditor, setShowPriorityEditor] = React.useState(false);
  const [showCourseEditor, setShowCourseEditor] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setShowDateEditor(false);
      setShowTimeEditor(false);
      setShowPriorityEditor(false);
      setShowCourseEditor(false);
    }
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border/80 px-3 py-3 text-left text-muted-foreground transition-colors hover:border-primary/45 hover:bg-primary/5 hover:text-foreground"
      >
        <span className="flex size-5 items-center justify-center rounded-full border border-dashed border-current" aria-hidden="true" />
        <span className="text-sm">Add a new todo</span>
      </button>
    );
  }

  const showCourseTag = mode === 'semester';

  return (
    <div className="rounded-[28px] border border-border/70 bg-background px-4 py-4 shadow-[0_8px_24px_hsl(var(--foreground)/0.05)]">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex size-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/70" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-3">
          <Input
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
            placeholder="Add title"
            className="h-auto border-0 px-0 text-lg font-medium shadow-none focus-visible:ring-0"
            autoFocus
          />

          <Textarea
            value={draft.description}
            onChange={(event) => onDraftChange((previous) => ({ ...previous, description: event.target.value }))}
            placeholder="Notes"
            rows={2}
            className="min-h-0 resize-none border-0 px-0 py-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0"
          />

          <div className="flex flex-wrap items-center gap-2">
            {draft.dueDate || showDateEditor ? (
              <div className="flex items-center gap-1 rounded-full bg-muted/60 px-2 py-1">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="date"
                  value={draft.dueDate}
                  onChange={(event) => onDraftChange((previous) => ({ ...previous, dueDate: event.target.value }))}
                  className="h-7 w-[148px] border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="h-6 w-6 rounded-full"
                  onClick={() => {
                    setShowDateEditor(false);
                    onDraftChange((previous) => ({ ...previous, dueDate: '' }));
                  }}
                  aria-label="Remove date"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="secondary" size="sm" className="rounded-full" onClick={() => setShowDateEditor(true)}>
                <CalendarDays className="mr-1 h-3.5 w-3.5" />
                Add Date
              </Button>
            )}

            {draft.dueTime || showTimeEditor ? (
              <div className="flex items-center gap-1 rounded-full bg-muted/60 px-2 py-1">
                <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="time"
                  value={draft.dueTime}
                  onChange={(event) => onDraftChange((previous) => ({ ...previous, dueTime: event.target.value }))}
                  className="h-7 w-[112px] border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="h-6 w-6 rounded-full"
                  onClick={() => {
                    setShowTimeEditor(false);
                    onDraftChange((previous) => ({ ...previous, dueTime: '' }));
                  }}
                  aria-label="Remove time"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="secondary" size="sm" className="rounded-full" onClick={() => setShowTimeEditor(true)}>
                <Clock3 className="mr-1 h-3.5 w-3.5" />
                Add Time
              </Button>
            )}

            {showPriorityEditor || draft.priority !== 'MEDIUM' ? (
              <div className="min-w-[132px] rounded-full bg-muted/60 px-2 py-1">
                <Select
                  value={draft.priority}
                  onValueChange={(value) => onDraftChange((previous) => ({ ...previous, priority: value as TodoPriority }))}
                >
                  <SelectTrigger className="h-7 border-0 bg-transparent px-1 text-xs shadow-none focus:ring-0">
                    <div className="flex items-center gap-1">
                      <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                      <SelectValue placeholder="Priority" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <Button type="button" variant="secondary" size="sm" className="rounded-full" onClick={() => setShowPriorityEditor(true)}>
                <Flag className="mr-1 h-3.5 w-3.5" />
                Priority
              </Button>
            )}

            {showCourseTag ? (
              showCourseEditor || draft.courseId ? (
                <div className="min-w-[180px] rounded-full bg-muted/60 px-2 py-1">
                  <Select
                    value={draft.courseId || '__none__'}
                    onValueChange={(value) => onDraftChange((previous) => ({ ...previous, courseId: value === '__none__' ? '' : value }))}
                  >
                    <SelectTrigger className="h-7 border-0 bg-transparent px-1 text-xs shadow-none focus:ring-0">
                      <div className="flex items-center gap-1">
                        <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                        <SelectValue placeholder="Course" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No Course</SelectItem>
                      {courseOptions.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <Button type="button" variant="secondary" size="sm" className="rounded-full" onClick={() => setShowCourseEditor(true)}>
                  <GraduationCap className="mr-1 h-3.5 w-3.5" />
                  Course
                </Button>
              )
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <p className={cn('text-xs text-muted-foreground', draft.title.trim() ? 'opacity-100' : 'opacity-70')}>
              {draft.title.trim() ? 'Press Enter to create quickly.' : 'Add a title to create this todo.'}
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="button" size="sm" className="rounded-full" onClick={onSave}>
                <PlusCircle className="mr-1 h-3.5 w-3.5" />
                Create
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
