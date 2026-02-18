"use no memo";

import React from 'react';
import { AlertCircle, CalendarDays, Clock3 } from 'lucide-react';
import api from '@/services/api';
import type { WidgetDefinition, WidgetProps } from '@/services/widgetRegistry';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BUILTIN_TIMETABLE_TODAY_EVENTS_WIDGET_TYPE } from './shared/constants';
import { useEventBus } from './shared/eventBus';
import { useScheduleData } from './shared/hooks/useScheduleData';
import { resolveSemesterDateRange, startOfWeekMonday } from './shared/utils';

const FALLBACK_RANGE = resolveSemesterDateRange(undefined, undefined, 16);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'long' });
const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

const normalizeToDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const toScheduleDayOfWeek = (date: Date) => {
  const day = date.getDay();
  return day === 0 ? 7 : day;
};

const TodayEventsWidgetComponent: React.FC<WidgetProps> = ({ semesterId, courseId }) => {
  const [resolvedSemesterId, setResolvedSemesterId] = React.useState<string | undefined>(semesterId);
  const [isResolvingSemesterId, setIsResolvingSemesterId] = React.useState(false);
  const [semesterRange, setSemesterRange] = React.useState(FALLBACK_RANGE);
  const [isLoadingSemesterRange, setIsLoadingSemesterRange] = React.useState(false);
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  React.useEffect(() => {
    if (semesterId) {
      setResolvedSemesterId(semesterId);
      setIsResolvingSemesterId(false);
      return;
    }
    if (!courseId) {
      setResolvedSemesterId(undefined);
      setIsResolvingSemesterId(false);
      return;
    }

    let isActive = true;
    setIsResolvingSemesterId(true);

    api.getCourse(courseId)
      .then((course) => {
        if (!isActive) return;
        setResolvedSemesterId(course.semester_id ?? undefined);
      })
      .catch(() => {
        if (!isActive) return;
        setResolvedSemesterId(undefined);
      })
      .finally(() => {
        if (!isActive) return;
        setIsResolvingSemesterId(false);
      });

    return () => {
      isActive = false;
    };
  }, [courseId, semesterId]);

  React.useEffect(() => {
    if (!resolvedSemesterId) {
      setSemesterRange(FALLBACK_RANGE);
      setIsLoadingSemesterRange(false);
      return;
    }

    let isActive = true;
    setIsLoadingSemesterRange(true);

    api.getSemester(resolvedSemesterId)
      .then((semester) => {
        if (!isActive) return;
        setSemesterRange(resolveSemesterDateRange(semester.start_date, semester.end_date, 16));
      })
      .catch(() => {
        if (!isActive) return;
        setSemesterRange(FALLBACK_RANGE);
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoadingSemesterRange(false);
      });

    return () => {
      isActive = false;
    };
  }, [resolvedSemesterId]);

  const today = React.useMemo(() => normalizeToDay(now), [now]);
  const todayDayOfWeek = React.useMemo(() => toScheduleDayOfWeek(today), [today]);

  const isOutOfSemesterRange = React.useMemo(() => {
    const semesterStart = normalizeToDay(semesterRange.startDate).getTime();
    const semesterEnd = normalizeToDay(semesterRange.endDate).getTime();
    const currentDay = today.getTime();
    return currentDay < semesterStart || currentDay > semesterEnd;
  }, [semesterRange.endDate, semesterRange.startDate, today]);

  const currentWeek = React.useMemo(() => {
    const semesterWeekStart = startOfWeekMonday(semesterRange.startDate).getTime();
    const todayWeekStart = startOfWeekMonday(today).getTime();
    const rawWeek = Math.floor((todayWeekStart - semesterWeekStart) / WEEK_MS) + 1;
    return Math.max(1, rawWeek);
  }, [semesterRange.startDate, today]);

  const {
    items,
    isLoading,
    isRefreshing,
    error,
    reload,
  } = useScheduleData({
    semesterId: resolvedSemesterId,
    mode: 'single-week',
    week: currentWeek,
    withConflicts: true,
    enabled: Boolean(resolvedSemesterId)
      && !isOutOfSemesterRange
      && !isResolvingSemesterId
      && !isLoadingSemesterRange,
  });

  useEventBus('timetable:schedule-data-changed', (payload) => {
    if (!resolvedSemesterId) return;
    if (payload.semesterId && payload.semesterId !== resolvedSemesterId) return;
    if (courseId && payload.courseId && payload.courseId !== courseId) return;
    void reload();
  });

  const todayEvents = React.useMemo(() => {
    return items.filter((item) => {
      if (item.dayOfWeek !== todayDayOfWeek) return false;
      if (item.skip || !item.enable) return false;
      if (courseId && item.courseId !== courseId) return false;
      return true;
    });
  }, [courseId, items, todayDayOfWeek]);

  if (isResolvingSemesterId || isLoadingSemesterRange) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading today&apos;s events...
      </div>
    );
  }

  if (!resolvedSemesterId) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
        Semester context is required to show today&apos;s events.
      </div>
    );
  }

  if (isOutOfSemesterRange) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
        Today ({dateFormatter.format(today)}) is outside this semester range.
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          Failed to load today&apos;s events.
        </div>
        <Button size="sm" variant="outline" onClick={() => void reload()}>
          Retry
        </Button>
      </div>
    );
  }

  if (isLoading && items.length === 0) {
    return (
      <div className="flex h-full flex-col gap-2 py-1">
        <div className="h-5 w-36 animate-pulse rounded bg-muted" />
        <div className="h-14 animate-pulse rounded-md bg-muted/80" />
        <div className="h-14 animate-pulse rounded-md bg-muted/70" />
        <div className="h-14 animate-pulse rounded-md bg-muted/60" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">Today</p>
          <p className="truncate text-sm font-semibold">
            {dayFormatter.format(today)} · {dateFormatter.format(today)}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {todayEvents.length}
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {todayEvents.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
            No events scheduled for today.
          </div>
        ) : (
          <div className="space-y-2">
            {todayEvents.map((event) => (
              <article key={`${event.eventId}:${event.week}`} className="rounded-md border bg-muted/35 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">
                    {event.title?.trim() || `${event.courseName} · ${event.eventTypeCode}`}
                  </p>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {event.startTime}-{event.endTime}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="h-3 w-3 shrink-0" />
                  <span className="truncate">{event.courseName}</span>
                  <span>·</span>
                  <span className="truncate">{event.eventTypeCode}</span>
                  {event.isConflict && (
                    <>
                      <span>·</span>
                      <span className="text-destructive">Conflict</span>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {isRefreshing && (
        <p className="mt-2 text-right text-xs text-muted-foreground">
          Refreshing...
        </p>
      )}
    </div>
  );
};

export const BuiltinTodayEventsWidget = TodayEventsWidgetComponent;

export const BuiltinTodayEventsWidgetDefinition: WidgetDefinition = {
  type: BUILTIN_TIMETABLE_TODAY_EVENTS_WIDGET_TYPE,
  name: 'Today Events',
  description: 'Shows your active schedule events for today.',
  icon: <CalendarDays className="h-4 w-4" />,
  component: BuiltinTodayEventsWidget,
  layout: { w: 4, h: 3, minW: 3, minH: 2, maxW: 8, maxH: 6 },
  maxInstances: 1,
  allowedContexts: ['semester', 'course'],
};
