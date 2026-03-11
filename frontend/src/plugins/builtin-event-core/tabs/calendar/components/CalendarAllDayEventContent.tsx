// input:  [all-day calendar event data, precomputed labels/colors, view-context flags, and optional todo completion callback]
// output: [`CalendarAllDayEventContent` component for all-day events across month and week views, including todo completion radios and gradebook icons]
// pos:    [Calendar event-content leaf component dedicated to all-day event presentation with view-specific month/week handling, todo toggle affordances, and gradebook iconography]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { BookOpen, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BUILTIN_CALENDAR_SOURCE_GRADEBOOK,
  BUILTIN_CALENDAR_SOURCE_TODO,
} from '../../../shared/constants';
import type { CalendarEventData } from '../../../shared/types';

interface CalendarAllDayEventContentProps {
  event: CalendarEventData;
  primaryLabel: string;
  resolvedAccentColor: string;
  showConflictLabel: boolean;
  isRecurring: boolean;
  isMonthView: boolean;
  onToggleTodoCompleted?: (completed: boolean) => Promise<void>;
}

export const CalendarAllDayEventContent: React.FC<CalendarAllDayEventContentProps> = ({
  event,
  primaryLabel,
  resolvedAccentColor,
  showConflictLabel,
  isRecurring,
  isMonthView,
  onToggleTodoCompleted,
}) => {
  const isTodoAllDayEvent = event.sourceId === BUILTIN_CALENDAR_SOURCE_TODO && Boolean(event.todoState);
  const isGradebookAllDayEvent = event.sourceId === BUILTIN_CALENDAR_SOURCE_GRADEBOOK;
  const [optimisticCompleted, setOptimisticCompleted] = React.useState(event.todoState?.completed ?? false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    setOptimisticCompleted(event.todoState?.completed ?? false);
  }, [event.todoState?.completed]);

  const handleTodoToggle = React.useCallback(async (domEvent: React.MouseEvent<HTMLButtonElement>) => {
    domEvent.preventDefault();
    domEvent.stopPropagation();
    if (!onToggleTodoCompleted || isSubmitting) return;

    const nextCompleted = !optimisticCompleted;
    setOptimisticCompleted(nextCompleted);
    setIsSubmitting(true);

    try {
      await onToggleTodoCompleted(nextCompleted);
    } catch {
      setOptimisticCompleted(event.todoState?.completed ?? false);
    } finally {
      setIsSubmitting(false);
    }
  }, [event.todoState?.completed, isSubmitting, onToggleTodoCompleted, optimisticCompleted]);

  if (isTodoAllDayEvent) {
    return (
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] leading-tight">
        <button
          type="button"
          role="checkbox"
          aria-checked={optimisticCompleted}
          aria-label={`Toggle completion for ${primaryLabel}`}
          data-calendar-todo-toggle="true"
          className="-ml-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1 disabled:cursor-progress disabled:opacity-70"
          disabled={isSubmitting}
          onMouseDown={(domEvent) => {
            domEvent.stopPropagation();
          }}
          onClick={handleTodoToggle}
        >
          <span
            className="flex size-4 items-center justify-center rounded-full border-2 bg-white"
            style={{ borderColor: resolvedAccentColor }}
          >
            <span className={cn(
              'size-2 rounded-full transition-opacity',
              optimisticCompleted ? 'opacity-100' : 'opacity-0',
            )}
              style={{ backgroundColor: resolvedAccentColor }}
            />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate text-[11px] font-semibold leading-tight',
              optimisticCompleted ? 'text-muted-foreground/85' : 'text-foreground',
              showConflictLabel ? 'text-destructive' : null,
            )}
          >
            {showConflictLabel ? `Conflict · ${primaryLabel}` : primaryLabel}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5 text-[11px] leading-tight">
      {isGradebookAllDayEvent ? (
        <span
          className="-ml-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full"
          style={{
            color: resolvedAccentColor,
            backgroundColor: `color-mix(in oklab, ${resolvedAccentColor} 16%, transparent)`,
          }}
          aria-label="Gradebook event"
          role="img"
        >
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      ) : !isMonthView ? (
        <span
          className="inline-flex h-4 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: resolvedAccentColor }}
          aria-hidden="true"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            'semestra-calendar-event-title block truncate font-medium',
            showConflictLabel ? 'semestra-calendar-event-title--conflict text-destructive' : '',
          )}
          style={!showConflictLabel ? { ['--semestra-event-title-color' as string]: resolvedAccentColor } : undefined}
        >
          {showConflictLabel ? `Conflict · ${primaryLabel}` : primaryLabel}
        </span>
      </div>
      {isRecurring ? (
        <span className="inline-flex shrink-0" style={{ color: resolvedAccentColor }} aria-label="Recurring event" role="img">
          <RefreshCw className={cn('h-2.5 w-2.5', !isMonthView ? 'h-3 w-3' : null)} aria-hidden="true" />
        </span>
      ) : null}
    </div>
  );
};
