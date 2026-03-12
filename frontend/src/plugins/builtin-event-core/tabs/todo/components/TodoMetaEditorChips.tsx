// input:  [Todo tag values, semester course options, shadcn popover/calendar/select primitives, overdue state, and change callbacks]
// output: [TodoMetaEditorChips React component]
// pos:    [Reusable inline date/time/priority/course chip editor shared by todo create and quick-edit flows with value-driven styling and compact edit-state alignment]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to
"use no memo";

import React from 'react';
import { format } from 'date-fns';
import { CalendarDays, ChevronDown, Clock3, Flag, GraduationCap, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCourseBadgeStyle, getDistinctCourseBadgeClassName } from '@/utils/courseCategoryBadge';
import type { TodoCourseOption, TodoPriority, TodoPriorityOption, TodoTabMode } from '../types';

interface TodoMetaEditorChipsProps {
  mode: TodoTabMode;
  dueDate: string;
  dueTime: string;
  priority: TodoPriority;
  courseId: string;
  courseOptions: TodoCourseOption[];
  priorityOptions: TodoPriorityOption[];
  isOverdue?: boolean;
  completed?: boolean;
  compact?: boolean;
  onChange: (patch: {
    dueDate?: string;
    dueTime?: string;
    priority?: TodoPriority;
    courseId?: string;
  }) => void;
}

const EMPTY_PRIORITY_VALUE = '__todo-priority-none__';
const EMPTY_COURSE_VALUE = '__todo-course-none__';

const dateLabelFor = (value: string) => {
  if (!value) return 'Date';

  const parsed = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(parsed.getTime())) return value;
  return format(parsed, 'MMM d');
};

const timeLabelFor = (value: string) => {
  if (!value) return 'Time';
  return value;
};

const chipTriggerClassName = 'flex h-8 w-auto min-w-0 items-center rounded-full border px-3 text-sm font-medium shadow-none transition-colors focus-visible:ring-1 focus-visible:ring-ring';

const InlineClearButton: React.FC<{
  label: string;
  onClick: () => void;
}> = ({ label, onClick }) => (
  <button
    type="button"
    className="ml-0.5 rounded-full p-0.5 text-current/60 transition-colors hover:text-current"
    onMouseDown={(event) => event.preventDefault()}
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
    aria-label={label}
  >
    <X className="h-3.5 w-3.5" />
  </button>
);

export const TodoMetaEditorChips: React.FC<TodoMetaEditorChipsProps> = ({
  mode,
  dueDate,
  dueTime,
  priority,
  courseId,
  courseOptions,
  priorityOptions,
  isOverdue = false,
  completed = false,
  compact = false,
  onChange,
}) => {
  const [dateOpen, setDateOpen] = React.useState(false);
  const [editingTime, setEditingTime] = React.useState(false);

  const selectedCourse = courseOptions.find((course) => course.id === courseId);
  const distinctCourseIds = React.useMemo(() => courseOptions.map((course) => course.id), [courseOptions]);
  const priorityMeta = priorityOptions.find((option) => option.value === priority) ?? null;
  const baseChipClassName = cn(
    'h-8 rounded-full border px-3 text-sm font-medium shadow-none transition-colors focus-visible:ring-1 focus-visible:ring-ring',
    compact ? 'min-w-[92px] justify-between' : 'min-w-0 justify-start',
  );
  const dateChipClassName = cn(
    baseChipClassName,
    completed
      ? 'border-border/60 bg-muted/25 text-muted-foreground hover:bg-muted/25'
      : isOverdue
        ? 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15'
        : dueDate
          ? 'border-sky-200 bg-sky-100/80 text-sky-800 hover:bg-sky-100 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200'
          : 'border-border/70 bg-muted/35 text-muted-foreground hover:bg-muted/55',
  );
  const timeChipClassName = cn(
    baseChipClassName,
    completed
      ? 'border-border/60 bg-muted/25 text-muted-foreground hover:bg-muted/25'
      : dueTime
        ? 'border-violet-200 bg-violet-100/80 text-violet-800 hover:bg-violet-100 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-200'
        : 'border-border/70 bg-muted/35 text-muted-foreground hover:bg-muted/55',
    'min-w-0',
  );
  const timeEditorChipClassName = cn(
    timeChipClassName,
    compact && 'min-w-0 justify-start',
  );
  const priorityChipClassName = cn(
    baseChipClassName,
    completed
      ? 'border-border/60 bg-muted/25 text-muted-foreground hover:bg-muted/25'
      : priorityMeta
        ? `${priorityMeta.className} border-transparent hover:brightness-[0.98]`
        : 'border-border/70 bg-muted/35 text-muted-foreground hover:bg-muted/55',
  );
  const courseChipClassName = cn(
    baseChipClassName,
    selectedCourse
      ? `${getDistinctCourseBadgeClassName(selectedCourse.id, distinctCourseIds, selectedCourse.category)} border-transparent hover:brightness-[0.98]`
      : 'border-border/70 bg-muted/35 text-muted-foreground hover:bg-muted/55',
    compact ? 'min-w-[120px]' : 'max-w-[160px]',
  );

  React.useEffect(() => {
    if (!editingTime) return;
    const closeOnPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest('[data-todo-time-chip="true"]')) return;
      setEditingTime(false);
    };

    window.addEventListener('pointerdown', closeOnPointerDown);
    return () => window.removeEventListener('pointerdown', closeOnPointerDown);
  }, [editingTime]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            className={cn(chipTriggerClassName, dateChipClassName, 'gap-1 pr-2')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setDateOpen((open) => !open);
              }
            }}
          >
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>{dateLabelFor(dueDate)}</span>
            </span>
            {dueDate ? (
              <InlineClearButton label="Clear date" onClick={() => onChange({ dueDate: '' })} />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto gap-3 p-3"
          align="start"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onClick={(event) => event.stopPropagation()}
        >
          <Calendar
            mode="single"
            selected={dueDate ? new Date(`${dueDate}T12:00:00`) : undefined}
            onSelect={(date) => {
              onChange({ dueDate: date ? format(date, 'yyyy-MM-dd') : '' });
              if (date) {
                setDateOpen(false);
              }
            }}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange({ dueDate: '' });
                setDateOpen(false);
              }}
            >
              Clear
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <div data-todo-time-chip="true" className="relative min-w-0">
        {editingTime ? (
          <div
            className={cn(
              timeEditorChipClassName,
              'flex items-center gap-1.5 px-2.5 pr-2',
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <Clock3 className="h-3.5 w-3.5 min-h-3.5 min-w-3.5 shrink-0" />
            <input
              type="time"
              value={dueTime}
              autoFocus
              onChange={(event) => onChange({ dueTime: event.target.value })}
              onBlur={() => setEditingTime(false)}
              onKeyDown={(event) => {
                if (event.key === 'Escape' || event.key === 'Enter') {
                  event.preventDefault();
                  setEditingTime(false);
                }
              }}
              className="h-6 w-[3.7rem] appearance-none border-0 bg-transparent px-0 py-0 text-sm leading-none shadow-none outline-none [-webkit-appearance:none] [color-scheme:light] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-clear-button]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-datetime-edit]:p-0 [&::-webkit-datetime-edit-fields-wrapper]:p-0"
            />
            {dueTime ? (
              <InlineClearButton
                label="Clear time"
                onClick={() => {
                  onChange({ dueTime: '' });
                  setEditingTime(false);
                }}
              />
            ) : null}
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            className={cn(chipTriggerClassName, timeChipClassName, 'gap-1 pr-2')}
            onClick={(event) => {
              event.stopPropagation();
              setEditingTime(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setEditingTime(true);
              }
            }}
          >
            <span className="flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              <span>{timeLabelFor(dueTime)}</span>
            </span>
            {dueTime ? (
              <InlineClearButton
                label="Clear time"
                onClick={() => {
                  onChange({ dueTime: '' });
                }}
              />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            )}
          </div>
        )}
      </div>

      <Select
        value={priority || EMPTY_PRIORITY_VALUE}
        onValueChange={(value) => onChange({ priority: value === EMPTY_PRIORITY_VALUE ? '' : value as TodoPriority })}
      >
        <SelectTrigger
          className={cn(priorityChipClassName, 'w-auto min-w-0 max-w-[132px] gap-1 pr-1.5 data-[size=default]:h-8 [&>svg:last-child]:ml-0 [&>svg:last-child]:size-3.5')}
          aria-label={priorityMeta ? `Priority ${priorityMeta.label}` : 'Select priority'}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <Flag className="h-3.5 w-3.5" />
            <SelectValue placeholder="Priority" aria-label={priorityMeta?.label ?? 'Priority'} />
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={EMPTY_PRIORITY_VALUE}>No Priority</SelectItem>
          {priorityOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {mode === 'semester' ? (
        <Select
          value={courseId || EMPTY_COURSE_VALUE}
          onValueChange={(value) => onChange({ courseId: value === EMPTY_COURSE_VALUE ? '' : value })}
        >
          <SelectTrigger
            className={cn(courseChipClassName, 'w-auto min-w-0 gap-1 pr-1.5 data-[size=default]:h-8 [&>svg:last-child]:ml-0 [&>svg:last-child]:size-3.5')}
            aria-label={selectedCourse ? `Course ${selectedCourse.name}` : 'Select course'}
            style={getCourseBadgeStyle(selectedCourse?.color)}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5" />
              <SelectValue placeholder="Course" aria-label={selectedCourse?.name ?? 'Course'} />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_COURSE_VALUE}>No Course</SelectItem>
            {courseOptions.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

    </div>
  );
};
