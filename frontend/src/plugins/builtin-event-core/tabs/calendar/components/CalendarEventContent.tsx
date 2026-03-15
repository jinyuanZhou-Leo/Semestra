// input:  [calendar event data, FullCalendar time text, view-context flags, and optional todo completion callback]
// output: [`CalendarEventContent` layout selector that delegates to all-day and standard Calendar event-content components]
// pos:    [Calendar event-content coordinator that computes shared display state, including optional subtitles, before choosing the all-day or standard event layout component]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import type { CalendarEventData } from '../../../shared/types';
import { extractLocationFromNote } from '../../../shared/utils';
import { CalendarAllDayEventContent } from './CalendarAllDayEventContent';
import { CalendarStandardEventContent } from './CalendarStandardEventContent';

interface CalendarEventContentProps {
  event: CalendarEventData;
  highlightConflicts: boolean;
  timeText: string;
  viewType: string;
  onToggleTodoCompleted?: (completed: boolean) => Promise<void>;
}

const getPrimaryEventLabel = (event: CalendarEventData) => {
  const trimmedTitle = event.title?.trim();
  if (!trimmedTitle) return event.courseName;

  const generatedTitle = `${event.courseName} · ${event.eventTypeCode}`;
  return trimmedTitle === generatedTitle ? event.courseName : trimmedTitle;
};

const getEventDurationMinutes = (event: CalendarEventData) => {
  return Math.max(0, Math.round((event.end.getTime() - event.start.getTime()) / 60000));
};

const getEventLocation = (event: CalendarEventData) => extractLocationFromNote(event.note);

const getEventTimeRangeLabel = (event: CalendarEventData) => `${event.startTime}-${event.endTime}`;

export const CalendarEventContent: React.FC<CalendarEventContentProps> = ({
  event,
  highlightConflicts,
  timeText,
  viewType,
  onToggleTodoCompleted,
}) => {
  const showConflictLabel = highlightConflicts && event.isConflict;
  const isMonthView = viewType === 'dayGridMonth';
  const primaryLabel = getPrimaryEventLabel(event);
  const secondaryLabel = event.subtitle?.trim() || null;
  const location = getEventLocation(event);
  const durationMinutes = getEventDurationMinutes(event);
  const showLocation = !isMonthView && Boolean(location);
  const showTimeRange = !isMonthView && durationMinutes >= 75;
  const resolvedAccentColor = event.isConflict && showConflictLabel
    ? 'var(--color-destructive)'
    : (event.color ?? '#3b82f6');

  if (event.allDay) {
    return (
      <CalendarAllDayEventContent
        event={event}
        primaryLabel={primaryLabel}
        secondaryLabel={secondaryLabel}
        resolvedAccentColor={resolvedAccentColor}
        showConflictLabel={showConflictLabel}
        isRecurring={event.isRecurring}
        isMonthView={isMonthView}
        onToggleTodoCompleted={onToggleTodoCompleted}
      />
    );
  }

  return (
    <CalendarStandardEventContent
      primaryLabel={primaryLabel}
      secondaryLabel={secondaryLabel}
      resolvedAccentColor={resolvedAccentColor}
      showConflictLabel={showConflictLabel}
      isRecurring={event.isRecurring}
      isMonthView={isMonthView}
      timeText={timeText}
      location={location}
      showLocation={showLocation}
      timeRangeLabel={getEventTimeRangeLabel(event)}
      showTimeRange={showTimeRange}
    />
  );
};
