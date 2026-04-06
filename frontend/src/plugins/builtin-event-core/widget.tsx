// input:  [widget context, semester/course APIs, schedule hook, and shared DST-safe timetable event utilities]
// output: [`BuiltinTodayEventsWidgetDefinition` and today-events widget runtime component]
// pos:    [Built-in event-core widget that summarizes active events for the current day with scoped refreshes and stable academic week lookup]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Clock3 } from 'lucide-react';
import api from '@/services/api';
import type { WidgetDefinition, WidgetProps } from '@/plugin-system';
import { queryKeys } from '@/services/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BUILTIN_TIMETABLE_TODAY_EVENTS_WIDGET_TYPE } from './shared/constants';
import { useEventBus } from './shared/eventBus';
import { useScheduleData } from './shared/hooks/useScheduleData';
import { getWeekFromSemesterDate, resolveSemesterDateRange } from './shared/utils';

const FALLBACK_RANGE = resolveSemesterDateRange(undefined, undefined, 16);
const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'long' });
const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

const normalizeToDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const toScheduleDayOfWeek = (date: Date) => {
  const day = date.getDay();
  return day === 0 ? 7 : day;
};

const TodayEventsWidgetComponent: React.FC<WidgetProps> = ({ semesterId, courseId }) => {
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  // Step 1: When only a courseId is available (no semesterId), look up the
  // course to find its semester_id. Use the shared cache so this piggybacks on
  // any existing course fetch already in flight elsewhere in the app.
  const courseQuery = useQuery({
    queryKey: courseId
      ? queryKeys.courses.detail(courseId)
      : (['courses', 'detail', '__disabled__'] as const),
    queryFn: () => api.getCourse(courseId!),
    enabled: Boolean(courseId && !semesterId),
    staleTime: 30_000,
  });

  const resolvedSemesterId: string | undefined = semesterId
    ?? courseQuery.data?.semester_id
    ?? undefined;

  const isResolvingSemesterId = Boolean(courseId && !semesterId && courseQuery.isLoading);

  // Step 2: Load the semester date range once we know the semester ID. Again,
  // the shared cache lets this reuse data already fetched by the main views.
  const semesterQuery = useQuery({
    queryKey: resolvedSemesterId
      ? queryKeys.semesters.detail(resolvedSemesterId)
      : (['semesters', 'detail', '__disabled__'] as const),
    queryFn: () => api.getSemester(resolvedSemesterId!),
    enabled: Boolean(resolvedSemesterId),
    staleTime: 30_000,
    select: (semester) => resolveSemesterDateRange(semester.start_date, semester.end_date, 16),
  });

  const semesterRange = semesterQuery.data ?? FALLBACK_RANGE;
  const isLoadingSemesterRange = Boolean(resolvedSemesterId && semesterQuery.isLoading);

  const today = React.useMemo(() => normalizeToDay(now), [now]);
  const todayDayOfWeek = React.useMemo(() => toScheduleDayOfWeek(today), [today]);

  const isOutOfSemesterRange = React.useMemo(() => {
    const semesterStart = normalizeToDay(semesterRange.startDate).getTime();
    const semesterEnd = normalizeToDay(semesterRange.endDate).getTime();
    const currentDay = today.getTime();
    return currentDay < semesterStart || currentDay > semesterEnd;
  }, [semesterRange.endDate, semesterRange.startDate, today]);

  const currentWeek = React.useMemo(() => {
    const rawWeek = getWeekFromSemesterDate(semesterRange.startDate, today);
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
    if (!payload.semesterId || payload.semesterId !== resolvedSemesterId) return;
    if (courseId && payload.courseId !== courseId) return;
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
      <div className="flex h-full items-center justify-center p-3 text-sm text-muted-foreground">
        Loading today&apos;s events...
      </div>
    );
  }

  if (!resolvedSemesterId) {
    return (
      <div className="flex h-full items-center justify-center p-3 text-center text-sm text-muted-foreground">
        Semester context is required to show today&apos;s events.
      </div>
    );
  }

  if (isOutOfSemesterRange) {
    return (
      <div className="flex h-full items-center justify-center p-3 text-center text-sm text-muted-foreground">
        Today ({dateFormatter.format(today)}) is outside this semester range.
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-3 text-sm text-muted-foreground">
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
      <div className="flex h-full flex-col gap-2 p-3">
        <div className="h-5 w-36 animate-pulse rounded bg-muted" />
        <div className="h-14 animate-pulse rounded-md bg-muted/80" />
        <div className="h-14 animate-pulse rounded-md bg-muted/70" />
        <div className="h-14 animate-pulse rounded-md bg-muted/60" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-3">
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
  component: BuiltinTodayEventsWidget,
};
