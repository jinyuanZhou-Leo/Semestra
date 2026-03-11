// input:  [FullCalendar React adapter, schedule/todo-derived calendar events, week/view state, calendar navigation callbacks, and todo completion toggles]
// output: [FullCalendarView React component backed by the FullCalendar library with Apple Calendar-inspired event hierarchy, all-day todo radios, and a custom current-time indicator]
// pos:    [calendar renderer that bridges built-in event-core state into week/month views with all-day support, compact schedule metadata, todo completion toggles, and a labeled now line]
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
import { cn } from '@/lib/utils';
import {
  CALENDAR_MAX_EVENT_LINES_PER_DAY,
} from '../../shared/constants';
import type { CalendarEventData, CalendarViewMode, SemesterDateRange } from '../../shared/types';
import {
  addDays,
  extractLocationFromNote,
  getWeekFromSemesterDate,
  startOfWeekMonday,
} from '../../shared/utils';
import { CalendarEventContent } from './components/CalendarEventContent';

interface FullCalendarViewProps {
  events: CalendarEventData[];
  week: number;
  maxWeek: number;
  viewMode: CalendarViewMode;
  monthAnchorDate: Date;
  weekViewStartDate: Date;
  semesterRange: SemesterDateRange;
  dayStartMinutes: number;
  dayEndMinutes: number;
  weekViewDayCount: number;
  highlightConflicts: boolean;
  showWeekends: boolean;
  isPending: boolean;
  onWeekChange: (week: number) => void;
  onViewModeChange: (viewMode: CalendarViewMode) => void;
  onEventClick: (event: CalendarEventData) => void;
  onToggleTodoCompleted?: (event: CalendarEventData, completed: boolean) => Promise<void>;
}

type EventExtendedProps = {
  sourceEvent: CalendarEventData;
  highlightConflicts: boolean;
};

const dayFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const dayNumberFormatter = new Intl.DateTimeFormat(undefined, { day: 'numeric' });

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
  const location = extractLocationFromNote(event.note);
  const metadata = [event.startTime];
  if (location) metadata.push(location);

  if (showConflictLabel) {
    return `Conflict detected · ${metadata.join(' · ')} · ${event.courseName}`;
  }

  return `${metadata.join(' · ')} · ${event.courseName}`;
};

const formatNowIndicatorLabel = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
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
      : addAlpha(event.color ?? '#3b82f6', 0.14),
    borderColor: event.isConflict && highlightConflicts
      ? 'var(--semestra-calendar-conflict-border)'
      : (event.color ?? '#3b82f6'),
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

const buildEventContentRenderer = (
  onToggleTodoCompleted: FullCalendarViewProps['onToggleTodoCompleted'],
) => (eventInfo: EventContentArg) => {
  const { sourceEvent, highlightConflicts } = eventInfo.event.extendedProps as EventExtendedProps;
  return (
    <CalendarEventContent
      event={sourceEvent}
      highlightConflicts={highlightConflicts}
      timeText={eventInfo.timeText}
      viewType={eventInfo.view.type}
      onToggleTodoCompleted={sourceEvent.allDay && onToggleTodoCompleted
        ? (completed) => onToggleTodoCompleted(sourceEvent, completed)
        : undefined}
    />
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
      <span className={cn('block font-semibold', isToday ? 'text-foreground' : 'text-foreground')}>
        {weekdayFormatter.format(date)}
      </span>
      <span
        className={cn(
          'mt-1 inline-flex items-center justify-center text-xs',
          isToday
            ? 'semestra-calendar-today-badge h-8 min-w-8 rounded-full px-2 font-semibold text-white'
            : 'text-muted-foreground',
        )}
      >
        {isToday ? dayNumberFormatter.format(date) : dayFormatter.format(date)}
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
  weekViewStartDate,
  semesterRange,
  dayStartMinutes,
  dayEndMinutes,
  weekViewDayCount,
  highlightConflicts,
  showWeekends,
  isPending,
  onWeekChange,
  onViewModeChange,
  onEventClick,
  onToggleTodoCompleted,
}) => {
  const calendarContainerRef = React.useRef<HTMLDivElement | null>(null);
  const safeWeekViewDayCount = Math.max(1, Math.floor(weekViewDayCount));
  const visibleDayColumns = showWeekends ? 7 : 5;
  const weekViewMinWidthPercent = Math.max(100, (visibleDayColumns / safeWeekViewDayCount) * 100);
  const currentDate = React.useMemo(
    () => (viewMode === 'month' ? monthAnchorDate : weekViewStartDate),
    [monthAnchorDate, viewMode, weekViewStartDate],
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
  const renderEventContent = React.useMemo(
    () => buildEventContentRenderer(onToggleTodoCompleted),
    [onToggleTodoCompleted],
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
    const eventTarget = arg.jsEvent.target;
    if (eventTarget instanceof Element && eventTarget.closest('[data-calendar-todo-toggle="true"]')) {
      return;
    }
    const { sourceEvent } = arg.event.extendedProps as EventExtendedProps;
    onEventClick(sourceEvent);
  }, [onEventClick]);

  React.useEffect(() => {
    if (viewMode !== 'week') return;

    const syncNowIndicatorLabel = () => {
      const root = calendarContainerRef.current;
      if (!root) return;

      const label = formatNowIndicatorLabel(new Date());
      root.querySelectorAll<HTMLElement>('.fc-timegrid-now-indicator-arrow').forEach((element) => {
        element.setAttribute('data-time-label', label);
      });
    };

    syncNowIndicatorLabel();
    const intervalId = window.setInterval(syncNowIndicatorLabel, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [calendarKey, viewMode]);

  return (
    <div
      ref={calendarContainerRef}
      className={cn(
        'semestra-fullcalendar h-full min-h-0 min-w-0 overflow-x-auto overflow-y-hidden rounded-md border border-border/70 bg-background transition-opacity',
        isPending ? 'opacity-70' : 'opacity-100',
      )}
      data-pending={isPending ? 'true' : 'false'}
    >
      <div
        data-slot={viewMode === 'week' ? 'calendar-week-scroll-frame' : 'calendar-frame'}
        className="h-full min-h-0"
        style={viewMode === 'week' ? { minWidth: `${weekViewMinWidthPercent}%` } : undefined}
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
            const resolvedColor = sourceEvent.color ?? '#3b82f6';
            arg.el.style.setProperty('--semestra-calendar-accent', resolvedColor);
            arg.el.style.setProperty('--semestra-calendar-accent-soft', addAlpha(resolvedColor, sourceEvent.isConflict && shouldHighlightConflicts ? 0.22 : 0.14));
            arg.el.setAttribute('data-semestra-all-day', sourceEvent.allDay ? 'true' : 'false');
            arg.el.setAttribute('aria-label', buildEventLabel(sourceEvent, shouldHighlightConflicts && sourceEvent.isConflict));
          }}
          moreLinkContent={(arg) => <span className="text-xs font-medium">{arg.num} more</span>}
          moreLinkDidMount={(arg: MoreLinkMountArg) => {
            arg.el.setAttribute('aria-label', `${arg.num} more events`);
          }}
          dayHeaderContent={(arg) => renderDayHeader(arg)}
          dayCellClassNames={(arg) => (arg.isOther ? ['semestra-fc-day--outside'] : [])}
          viewClassNames={['semestra-fc-view']}
          eventMinHeight={54}
        />
      </div>
    </div>
  );
};
