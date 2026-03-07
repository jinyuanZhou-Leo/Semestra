// input:  [FullCalendar React adapter, schedule/todo-derived calendar events, week/view state, and calendar navigation callbacks]
// output: [FullCalendarView React component backed by the FullCalendar library]
// pos:    [calendar renderer that bridges built-in event-core state into FullCalendar week/month views with all-day support]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to
"use no memo";

import React from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import type {
  DatesSetArg,
  DayHeaderContentArg,
  EventClickArg,
  EventContentArg,
  EventInput,
  MoreLinkArg,
  MoreLinkMountArg,
} from '@fullcalendar/core';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CALENDAR_MAX_EVENT_LINES_PER_DAY,
} from '../../shared/constants';
import type { CalendarEventData, CalendarViewMode, SemesterDateRange } from '../../shared/types';
import {
  addDays,
  getWeekFromSemesterDate,
  getWeekStartForSemester,
  startOfWeekMonday,
} from '../../shared/utils';

interface FullCalendarViewProps {
  events: CalendarEventData[];
  week: number;
  maxWeek: number;
  viewMode: CalendarViewMode;
  monthAnchorDate: Date;
  semesterRange: SemesterDateRange;
  dayStartMinutes: number;
  dayEndMinutes: number;
  highlightConflicts: boolean;
  showWeekends: boolean;
  isPending: boolean;
  onWeekChange: (week: number) => void;
  onViewModeChange: (viewMode: CalendarViewMode) => void;
  onEventClick: (event: CalendarEventData) => void;
}

type EventExtendedProps = {
  sourceEvent: CalendarEventData;
  highlightConflicts: boolean;
};

const dayFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });

const alphaHex = (alpha: number) => {
  const normalized = Math.max(0, Math.min(1, alpha));
  return Math.round(normalized * 255).toString(16).padStart(2, '0');
};

const addAlpha = (hexColor: string, alpha: number) => {
  if (!/^#[0-9a-fA-F]{6}$/.test(hexColor)) return hexColor;
  return `${hexColor}${alphaHex(alpha)}`;
};

const toDurationTime = (minutes: number) => {
  const bounded = Math.max(0, Math.min(23 * 60 + 59, Math.floor(minutes)));
  const hour = Math.floor(bounded / 60);
  const minute = bounded % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
};

const buildValidRange = (semesterRange: SemesterDateRange) => ({
  start: startOfWeekMonday(semesterRange.startDate),
  end: addDays(startOfWeekMonday(semesterRange.endDate), 7),
});

const buildEventLabel = (event: CalendarEventData, showConflictLabel: boolean) => {
  if (showConflictLabel) {
    return `Conflict detected · ${event.startTime} ${event.courseName}`;
  }

  return `${event.startTime} ${event.courseName}`;
};

const getPrimaryEventLabel = (event: CalendarEventData) => {
  const trimmedTitle = event.title?.trim();
  if (!trimmedTitle) return event.courseName;

  const generatedTitle = `${event.courseName} · ${event.eventTypeCode}`;
  return trimmedTitle === generatedTitle ? event.courseName : trimmedTitle;
};

const isSameCalendarDay = (left: Date, right: Date) => (
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate()
);

const buildCalendarEvents = (
  events: CalendarEventData[],
  highlightConflicts: boolean,
): EventInput[] => {
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    display: 'block',
    allDay: event.allDay,
    backgroundColor: event.isConflict && highlightConflicts
      ? 'var(--semestra-calendar-conflict-surface)'
      : addAlpha(event.color, 0.14),
    borderColor: event.isConflict && highlightConflicts
      ? 'var(--semestra-calendar-conflict-border)'
      : event.color,
    textColor: 'var(--color-foreground)',
    classNames: [
      'semestra-fc-event',
      event.isConflict && highlightConflicts ? 'semestra-fc-event--conflict' : '',
      event.isSkipped || !event.enable ? 'semestra-fc-event--muted' : '',
    ].filter(Boolean),
    extendedProps: {
      sourceEvent: event,
      highlightConflicts,
    } satisfies EventExtendedProps,
  }));
};

const renderEventContent = (eventInfo: EventContentArg) => {
  const { sourceEvent, highlightConflicts } = eventInfo.event.extendedProps as EventExtendedProps;
  const showConflictLabel = highlightConflicts && sourceEvent.isConflict;
  const showCompactLayout = eventInfo.view.type === 'dayGridMonth' || eventInfo.event.allDay;
  const primaryLabel = getPrimaryEventLabel(sourceEvent);

  if (showCompactLayout) {
    return (
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] leading-tight">
        <span className={cn(
          'min-w-0 truncate font-medium',
          showConflictLabel ? 'text-destructive' : 'text-foreground',
        )}
        >
          {showConflictLabel ? `Conflict · ${primaryLabel}` : primaryLabel}
        </span>
        {sourceEvent.isRecurring ? (
          <span className="ml-auto inline-flex shrink-0 text-muted-foreground" aria-label="Recurring event" role="img">
            <RefreshCw className="h-2.5 w-2.5" aria-hidden="true" />
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col justify-between gap-2.5">
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold leading-tight text-foreground">{primaryLabel}</div>
        <div className="mt-1.5">
          <span className="inline-flex max-w-full items-center rounded-full bg-background/88 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.03em] text-muted-foreground">
            <span className="truncate">{sourceEvent.eventTypeCode}</span>
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium leading-none text-muted-foreground">
          {showConflictLabel ? (
            <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.75 text-[10px] font-semibold uppercase tracking-[0.04em] text-destructive overflow-hidden">
              <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">Conflict</span>
            </span>
          ) : <span />}
        </div>
        {sourceEvent.isRecurring ? (
          <span
            className="inline-flex shrink-0 rounded-full bg-background/82 p-0.5 text-muted-foreground"
            aria-label="Recurring event"
            role="img"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
          </span>
        ) : null}
      </div>
    </div>
  );
};

const renderDayHeader = ({ date, text, view }: DayHeaderContentArg) => {
  const isMonthView = view.type === 'dayGridMonth';
  const isToday = isSameCalendarDay(date, new Date());

  if (isMonthView) {
    return (
      <span className={cn('text-sm font-semibold', isToday ? 'text-primary' : 'text-foreground')}>
        {text}
      </span>
    );
  }

  return (
    <>
      <span className={cn('block font-semibold', isToday ? 'text-primary' : 'text-foreground')}>
        {weekdayFormatter.format(date)}
      </span>
      <span className={cn('mt-1 block text-xs', isToday ? 'text-primary/80' : 'text-muted-foreground')}>
        {isToday ? `Today · ${dayFormatter.format(date)}` : dayFormatter.format(date)}
      </span>
    </>
  );
};

export const FullCalendarView: React.FC<FullCalendarViewProps> = ({
  events,
  week,
  maxWeek,
  viewMode,
  monthAnchorDate,
  semesterRange,
  dayStartMinutes,
  dayEndMinutes,
  highlightConflicts,
  showWeekends,
  isPending,
  onWeekChange,
  onViewModeChange,
  onEventClick,
}) => {
  const currentDate = React.useMemo(
    () => (viewMode === 'month' ? monthAnchorDate : getWeekStartForSemester(semesterRange.startDate, week)),
    [monthAnchorDate, semesterRange.startDate, viewMode, week],
  );
  const currentView = viewMode === 'month' ? 'dayGridMonth' : 'timeGridWeek';
  const calendarKey = React.useMemo(
    () => `${currentView}:${currentDate.toISOString().slice(0, 10)}`,
    [currentDate, currentView],
  );
  const validRange = React.useMemo(
    () => buildValidRange(semesterRange),
    [semesterRange],
  );
  const calendarEvents = React.useMemo(
    () => buildCalendarEvents(events, highlightConflicts),
    [events, highlightConflicts],
  );
  const safeWeek = Math.max(1, Math.min(Math.max(1, maxWeek), week));

  const handleDatesSet = React.useCallback((arg: DatesSetArg) => {
    if (arg.view.type !== 'timeGridWeek') return;

    const nextWeek = Math.max(1, Math.min(Math.max(1, maxWeek), getWeekFromSemesterDate(semesterRange.startDate, arg.start)));
    if (nextWeek !== safeWeek) {
      onWeekChange(nextWeek);
    }
  }, [maxWeek, onWeekChange, safeWeek, semesterRange.startDate]);

  const handleMoreLinkClick = React.useCallback((arg: MoreLinkArg) => {
    const hiddenEventWeek = (arg.hiddenSegs[0]?.event.extendedProps as EventExtendedProps | undefined)?.sourceEvent?.week;
    const targetWeek = typeof hiddenEventWeek === 'number'
      ? Math.max(1, Math.min(Math.max(1, maxWeek), hiddenEventWeek))
      : Math.max(1, Math.min(Math.max(1, maxWeek), getWeekFromSemesterDate(semesterRange.startDate, arg.date)));

    if (targetWeek !== safeWeek) {
      onWeekChange(targetWeek);
    }
    onViewModeChange('week');

    return 'timeGridWeek';
  }, [maxWeek, onViewModeChange, onWeekChange, safeWeek, semesterRange.startDate]);

  const handleEventClick = React.useCallback((arg: EventClickArg) => {
    const { sourceEvent } = arg.event.extendedProps as EventExtendedProps;
    onEventClick(sourceEvent);
  }, [onEventClick]);

  return (
    <div
      className={cn(
        'semestra-fullcalendar h-full min-h-0 min-w-0 overflow-x-auto overflow-y-hidden rounded-md border border-border/70 bg-background transition-opacity',
        isPending ? 'opacity-70' : 'opacity-100',
      )}
      data-pending={isPending ? 'true' : 'false'}
    >
      <FullCalendar
        key={calendarKey}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={currentView}
        initialDate={currentDate}
        headerToolbar={false}
        height="100%"
        firstDay={1}
        weekends={showWeekends}
        allDaySlot
        nowIndicator
        editable={false}
        selectable={false}
        navLinks={false}
        events={calendarEvents}
        validRange={validRange}
        slotMinTime={toDurationTime(dayStartMinutes)}
        slotMaxTime={toDurationTime(dayEndMinutes)}
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        expandRows
        stickyHeaderDates
        dayMaxEvents={CALENDAR_MAX_EVENT_LINES_PER_DAY}
        slotEventOverlap={false}
        moreLinkClick={handleMoreLinkClick}
        eventClick={handleEventClick}
        eventContent={renderEventContent}
        datesSet={handleDatesSet}
        eventDidMount={(arg) => {
          const { sourceEvent, highlightConflicts: shouldHighlightConflicts } = arg.event.extendedProps as EventExtendedProps;
          arg.el.style.setProperty('--semestra-calendar-accent', sourceEvent.color);
          arg.el.style.setProperty('--semestra-calendar-accent-soft', addAlpha(sourceEvent.color, sourceEvent.isConflict && shouldHighlightConflicts ? 0.22 : 0.14));
          arg.el.setAttribute('aria-label', buildEventLabel(sourceEvent, shouldHighlightConflicts && sourceEvent.isConflict));
        }}
        moreLinkContent={(arg) => <span className="text-xs font-medium">View {arg.num} more</span>}
        moreLinkDidMount={(arg: MoreLinkMountArg) => {
          arg.el.setAttribute('aria-label', `View ${arg.num} more events`);
        }}
        dayHeaderContent={(arg) => renderDayHeader(arg)}
        dayCellClassNames={(arg) => (arg.isOther ? ['semestra-fc-day--outside'] : [])}
        viewClassNames={['semestra-fc-view']}
        eventMinHeight={44}
      />
    </div>
  );
};
