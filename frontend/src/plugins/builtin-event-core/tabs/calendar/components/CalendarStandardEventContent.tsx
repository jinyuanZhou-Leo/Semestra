// input:  [precomputed standard calendar event labels, colors, recurrence state, optional metadata, time text, and view-context flags]
// output: [`CalendarStandardEventContent` component for non-all-day events across month and week views]
// pos:    [Calendar event-content leaf component dedicated to standard timed events with month-chip and week-card variants]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { AlertTriangle, Clock3, MapPin, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarStandardEventContentProps {
  primaryLabel: string;
  resolvedAccentColor: string;
  showConflictLabel: boolean;
  isRecurring: boolean;
  isMonthView: boolean;
  timeText: string;
  location: string | null;
  showLocation: boolean;
  timeRangeLabel: string;
  showTimeRange: boolean;
}

export const CalendarStandardEventContent: React.FC<CalendarStandardEventContentProps> = ({
  primaryLabel,
  resolvedAccentColor,
  showConflictLabel,
  isRecurring,
  isMonthView,
  timeText,
  location,
  showLocation,
  timeRangeLabel,
  showTimeRange,
}) => {
  if (isMonthView) {
    return (
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] leading-none">
        <span
          className="inline-flex h-[0.9em] w-1 shrink-0 rounded-full"
          style={{ backgroundColor: resolvedAccentColor }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              'semestra-calendar-event-title block truncate font-medium leading-none',
              showConflictLabel ? 'semestra-calendar-event-title--conflict text-destructive' : '',
            )}
            style={!showConflictLabel ? { ['--semestra-event-title-color' as string]: resolvedAccentColor } : undefined}
          >
            {showConflictLabel ? `Conflict · ${primaryLabel}` : primaryLabel}
          </span>
        </div>
        {timeText ? (
          <span className="shrink-0 text-[10px] font-medium leading-none text-muted-foreground/90">
            {timeText}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div
          className={cn(
            'semestra-calendar-event-title truncate text-[13px] font-semibold leading-[1.15]',
            showConflictLabel ? 'semestra-calendar-event-title--conflict text-destructive' : null,
          )}
          style={!showConflictLabel ? { ['--semestra-event-title-color' as string]: resolvedAccentColor } : undefined}
        >
          {primaryLabel}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {showConflictLabel ? (
            <AlertTriangle className="h-3 w-3 text-destructive" aria-hidden="true" />
          ) : null}
          {isRecurring ? (
            <span
              className="inline-flex shrink-0"
              style={{ color: resolvedAccentColor }}
              aria-label="Recurring event"
              role="img"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
            </span>
          ) : null}
        </div>
      </div>
      <div className="space-y-1">
        {showLocation && location ? (
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium leading-none text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" style={{ color: resolvedAccentColor }} aria-hidden="true" />
            <span className="truncate" style={{ color: resolvedAccentColor }}>{location}</span>
          </div>
        ) : null}
        {showTimeRange ? (
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium leading-none text-muted-foreground">
            <Clock3 className="h-3 w-3 shrink-0" style={{ color: resolvedAccentColor }} aria-hidden="true" />
            <span className="truncate" style={{ color: resolvedAccentColor }}>{timeRangeLabel}</span>
          </div>
        ) : null}
        {showConflictLabel && !showTimeRange ? (
          <div className="text-[10px] font-semibold text-destructive">
            Conflict
          </div>
        ) : null}
      </div>
    </div>
  );
};
