import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DatesSetArg, EventInput } from '@fullcalendar/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CALENDAR_MAX_EVENT_LINES_PER_DAY,
  CALENDAR_ROW_MIN_HEIGHT,
  DAY_OF_WEEK_OPTIONS,
} from '../../shared/constants';
import type { CalendarEventData, CalendarViewMode, SemesterDateRange } from '../../shared/types';
import { addDays, formatHour, startOfWeekMonday } from '../../shared/utils';

interface FullCalendarViewProps {
  events: CalendarEventData[];
  week: number;
  maxWeek: number;
  viewMode: CalendarViewMode;
  semesterRange: SemesterDateRange;
  isPending: boolean;
  onWeekChange: (week: number) => void;
  onEventClick: (event: CalendarEventData) => void;
}

const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'short' });
const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric' });
const fullDateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const DAY_MS = 24 * 60 * 60 * 1000;

const keyForDate = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
const normalizeToDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addAlpha = (hexColor: string, alphaHex = '22') => {
  if (!/^#[0-9a-fA-F]{6}$/.test(hexColor)) return hexColor;
  return `${hexColor}${alphaHex}`;
};

const weekStartFromSemester = (semesterStartDate: Date, week: number) => {
  return addDays(startOfWeekMonday(semesterStartDate), (Math.max(1, week) - 1) * 7);
};

const weekFromDate = (semesterStartDate: Date, date: Date) => {
  const semesterStart = startOfWeekMonday(semesterStartDate).getTime();
  const targetStart = startOfWeekMonday(date).getTime();
  return Math.floor((targetStart - semesterStart) / DAY_MS / 7) + 1;
};

const eventsByDay = (events: CalendarEventData[]) => {
  const map = new Map<string, CalendarEventData[]>();

  for (const event of events) {
    const key = keyForDate(event.start);
    const dayEvents = map.get(key) ?? [];
    dayEvents.push(event);
    map.set(key, dayEvents);
  }

  for (const [key, dayEvents] of map.entries()) {
    map.set(
      key,
      [...dayEvents].sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime()),
    );
  }

  return map;
};

const renderEventButton = (event: CalendarEventData, onEventClick: (event: CalendarEventData) => void) => {
  return (
    <button
      key={event.id}
      type="button"
      onClick={() => onEventClick(event)}
      className={[
        'w-full rounded-md border border-l-[3px] px-2 py-1 text-left text-xs transition-colors',
        'focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none',
        'hover:bg-accent/40',
        event.isSkipped ? 'opacity-55 grayscale' : '',
        event.isConflict ? 'border-destructive/50' : 'border-border/70',
      ].join(' ')}
      style={{ borderLeftColor: event.color, backgroundColor: addAlpha(event.color, '18') }}
      aria-label={`Open event ${event.title}`}
    >
      <div className="truncate font-medium text-foreground">{event.title}</div>
      <div className="truncate text-[11px] text-foreground/80">
        {event.startTime} - {event.endTime}
      </div>
    </button>
  );
};

const WeekView: React.FC<{
  events: CalendarEventData[];
  weekStartDate: Date;
  onEventClick: (event: CalendarEventData) => void;
}> = ({ events, weekStartDate, onEventClick }) => {
  const eventsMap = React.useMemo(() => eventsByDay(events), [events]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[920px] rounded-md border border-border/70 bg-background">
        <div className="grid grid-cols-7">
          {DAY_OF_WEEK_OPTIONS.map((day, dayIndex) => {
            const date = addDays(weekStartDate, dayIndex);
            const dayKey = keyForDate(date);
            const dayEvents = eventsMap.get(dayKey) ?? [];

            return (
              <div key={day.value} className="border-r border-border/70 last:border-r-0">
                <div className="border-b border-border/70 bg-muted/25 px-3 py-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{day.label}</p>
                  <p className="text-sm font-semibold">{dayFormatter.format(date)}</p>
                </div>
                <div className="space-y-2 p-2" style={{ minHeight: `${CALENDAR_ROW_MIN_HEIGHT}px` }}>
                  {dayEvents.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/60 p-2 text-xs text-muted-foreground">
                      No events
                    </div>
                  ) : dayEvents.map((event) => renderEventButton(event, onEventClick))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const MonthView: React.FC<{
  events: CalendarEventData[];
  monthAnchorDate: Date;
  semesterRange: SemesterDateRange;
  onNavigateDate: (date: Date) => void;
  onEventClick: (event: CalendarEventData) => void;
}> = ({ events, monthAnchorDate, semesterRange, onNavigateDate, onEventClick }) => {
  const monthStart = React.useMemo(() => new Date(monthAnchorDate.getFullYear(), monthAnchorDate.getMonth(), 1), [monthAnchorDate]);
  const monthGridStart = React.useMemo(() => startOfWeekMonday(monthStart), [monthStart]);
  const monthGridDates = React.useMemo(() => {
    return Array.from({ length: 42 }, (_, index) => addDays(monthGridStart, index));
  }, [monthGridStart]);

  const eventsMap = React.useMemo(() => eventsByDay(events), [events]);
  const semesterStart = normalizeToDay(semesterRange.startDate).getTime();
  const semesterEnd = normalizeToDay(semesterRange.endDate).getTime();

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border/70 bg-background">
        <div className="grid grid-cols-7 border-b border-border/70 bg-muted/25">
          {DAY_OF_WEEK_OPTIONS.map((day) => (
            <div key={day.value} className="px-2 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {day.label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {monthGridDates.map((date, index) => {
            const dayKey = keyForDate(date);
            const dayEvents = eventsMap.get(dayKey) ?? [];
            const isCurrentMonth = date.getMonth() === monthAnchorDate.getMonth();
            const dayTime = normalizeToDay(date).getTime();
            const isOutOfSemester = dayTime < semesterStart || dayTime > semesterEnd;

            return (
              <div
                key={`${dayKey}-${index}`}
                className={[
                  'min-h-[132px] border-r border-b border-border/70 p-2 last:border-r-0',
                  isCurrentMonth ? 'bg-background' : 'bg-muted/20',
                  isOutOfSemester ? 'opacity-50' : '',
                ].join(' ')}
              >
                <div className="mb-1 flex items-center justify-between">
                  <button
                    type="button"
                    className="rounded px-1 text-xs font-medium hover:bg-accent"
                    onClick={() => onNavigateDate(date)}
                  >
                    {date.getDate()}
                  </button>
                  {dayEvents.length > 0 ? <Badge variant="outline">{dayEvents.length}</Badge> : null}
                </div>

                <div className="space-y-1">
                  {dayEvents.slice(0, CALENDAR_MAX_EVENT_LINES_PER_DAY).map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onEventClick(event)}
                      className={[
                        'w-full truncate rounded px-1.5 py-1 text-left text-[11px] transition-colors',
                        'hover:bg-accent/50 focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none',
                        event.isSkipped ? 'opacity-55 grayscale' : '',
                      ].join(' ')}
                      style={{ backgroundColor: addAlpha(event.color, '1f'), borderLeft: `2px solid ${event.color}` }}
                    >
                      {formatHour(event.start.getHours() * 60 + event.start.getMinutes())} {event.courseName}
                    </button>
                  ))}
                  {dayEvents.length > CALENDAR_MAX_EVENT_LINES_PER_DAY && (
                    <p className="text-[11px] text-muted-foreground">
                      +{dayEvents.length - CALENDAR_MAX_EVENT_LINES_PER_DAY} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const FullCalendarView: React.FC<FullCalendarViewProps> = ({
  events,
  week,
  viewMode,
  semesterRange,
  isPending,
  maxWeek,
  onWeekChange,
  onEventClick,
}) => {
  const safeWeek = Math.max(1, Math.min(maxWeek, week));
  const calendarRef = React.useRef<FullCalendar | null>(null);
  const [calendarAnchorDate, setCalendarAnchorDate] = React.useState<Date>(weekStartFromSemester(semesterRange.startDate, safeWeek));

  const fcEvents = React.useMemo<EventInput[]>(() => {
    return events.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      backgroundColor: event.color,
      borderColor: event.color,
      extendedProps: event,
    }));
  }, [events]);

  const syncWeekFromDate = React.useCallback((date: Date) => {
    const nextWeek = Math.max(1, Math.min(maxWeek, weekFromDate(semesterRange.startDate, date)));
    if (nextWeek !== week) {
      onWeekChange(nextWeek);
    }
  }, [maxWeek, onWeekChange, semesterRange.startDate, week]);

  const syncFromCalendarApi = React.useCallback(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const currentDate = api.getDate();
    setCalendarAnchorDate(currentDate);
    syncWeekFromDate(currentDate);
  }, [syncWeekFromDate]);

  React.useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;

    const targetView = viewMode === 'month' ? 'dayGridMonth' : 'timeGridWeek';
    if (api.view.type !== targetView) {
      api.changeView(targetView);
    }
  }, [viewMode]);

  React.useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;

    const targetDate = weekStartFromSemester(semesterRange.startDate, safeWeek);
    const currentDate = api.getDate();
    if (Math.abs(currentDate.getTime() - targetDate.getTime()) >= DAY_MS) {
      api.gotoDate(targetDate);
      setCalendarAnchorDate(targetDate);
    }
  }, [safeWeek, semesterRange.startDate]);

  const weekStartDate = viewMode === 'month'
    ? startOfWeekMonday(calendarAnchorDate)
    : weekStartFromSemester(semesterRange.startDate, safeWeek);
  const weekEndDate = addDays(weekStartDate, 6);
  const title = viewMode === 'month'
    ? `${monthFormatter.format(calendarAnchorDate)} ${calendarAnchorDate.getFullYear()}`
    : `${fullDateFormatter.format(weekStartDate)} - ${fullDateFormatter.format(weekEndDate)}`;

  const handleStep = (direction: 'prev' | 'next') => {
    const api = calendarRef.current?.getApi();
    if (!api) {
      const delta = direction === 'prev' ? -1 : 1;
      onWeekChange(Math.max(1, Math.min(maxWeek, safeWeek + delta)));
      return;
    }

    if (direction === 'prev') {
      api.prev();
    } else {
      api.next();
    }

    syncFromCalendarApi();
  };

  const handleNavigateDate = (date: Date) => {
    const api = calendarRef.current?.getApi();
    if (api) {
      api.gotoDate(date);
      syncFromCalendarApi();
      return;
    }

    setCalendarAnchorDate(date);
    syncWeekFromDate(date);
  };

  return (
    <div className={isPending ? 'pointer-events-none opacity-75 transition-opacity duration-200 motion-reduce:transition-none' : 'transition-opacity duration-200 motion-reduce:transition-none'}>
      <div className="sr-only" aria-hidden="true">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={viewMode === 'month' ? 'dayGridMonth' : 'timeGridWeek'}
          initialDate={weekStartFromSemester(semesterRange.startDate, safeWeek)}
          events={fcEvents}
          headerToolbar={false}
          height={1}
          contentHeight={1}
          dayMaxEvents
          datesSet={(arg: DatesSetArg) => {
            setCalendarAnchorDate(arg.start);
          }}
        />
      </div>

      <div className="mb-3 flex items-center justify-between rounded-md border bg-muted/20 px-2 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => handleStep('prev')}
          disabled={safeWeek <= 1 && viewMode === 'week'}
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm font-semibold">{title}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => handleStep('next')}
          disabled={safeWeek >= maxWeek && viewMode === 'week'}
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {viewMode === 'month' ? (
        <MonthView
          events={events}
          monthAnchorDate={calendarAnchorDate}
          semesterRange={semesterRange}
          onNavigateDate={handleNavigateDate}
          onEventClick={onEventClick}
        />
      ) : (
        <WeekView
          events={events}
          weekStartDate={weekStartDate}
          onEventClick={onEventClick}
        />
      )}
    </div>
  );
};
