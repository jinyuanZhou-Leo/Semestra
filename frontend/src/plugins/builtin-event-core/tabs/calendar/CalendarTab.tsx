import React from 'react';
import { toast } from 'sonner';
import api from '@/services/api';
import scheduleService from '@/services/schedule';
import type { TabProps } from '@/services/tabRegistry';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CALENDAR_DEFAULT_VIEW_MODE,
  DEFAULT_WEEK,
} from '../../shared/constants';
import { timetableEventBus, useEventBus } from '../../shared/eventBus';
import { useScheduleData } from '../../shared/hooks/useScheduleData';
import type {
  CalendarEventData,
  CalendarEventPatch,
  CalendarSettingsState,
  CalendarViewMode,
  SemesterDateRange,
} from '../../shared/types';
import {
  addDays,
  buildCalendarEvents,
  resolveSemesterDateRange,
  startOfWeekMonday,
} from '../../shared/utils';
import { CalendarToolbar } from './CalendarToolbar';
import { CalendarSkeleton } from './components/CalendarSkeleton';
import { normalizeCalendarSettings } from './settings';

const FullCalendarView = React.lazy(async () => {
  const module = await import('./FullCalendarView');
  return { default: module.FullCalendarView };
});

const EventEditor = React.lazy(async () => {
  const module = await import('./EventEditor');
  return { default: module.EventEditor };
});

const FALLBACK_RANGE: SemesterDateRange = resolveSemesterDateRange(undefined, undefined, 16);
const rangeDateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

export const CalendarTab: React.FC<TabProps> = ({ semesterId, settings: inputSettings }) => {
  const [week, setWeek] = React.useState(DEFAULT_WEEK);
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>(CALENDAR_DEFAULT_VIEW_MODE as CalendarViewMode);
  const settings = React.useMemo<CalendarSettingsState>(() => normalizeCalendarSettings(inputSettings), [inputSettings]);
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEventData | null>(null);
  const [isEventEditorOpen, setIsEventEditorOpen] = React.useState(false);
  const [semesterRange, setSemesterRange] = React.useState<SemesterDateRange>(FALLBACK_RANGE);
  const [optimisticPatches, setOptimisticPatches] = React.useState<Map<string, CalendarEventPatch>>(new Map());
  const [isPending, startTransition] = React.useTransition();

  const {
    items,
    maxWeek,
    isLoading,
    error,
    reload,
  } = useScheduleData({
    semesterId,
    mode: 'all-weeks',
    withConflicts: true,
    enabled: Boolean(semesterId),
  });

  React.useEffect(() => {
    setWeek((currentWeek) => {
      const upperBound = Math.max(1, maxWeek);
      return Math.max(1, Math.min(upperBound, currentWeek));
    });
  }, [maxWeek]);

  React.useEffect(() => {
    if (!semesterId) return;

    let isActive = true;

    api.getSemester(semesterId)
      .then((semester) => {
        if (!isActive) return;
        setSemesterRange(resolveSemesterDateRange(semester.start_date, semester.end_date, Math.max(1, maxWeek)));
      })
      .catch(() => {
        if (!isActive) return;
        setSemesterRange(resolveSemesterDateRange(undefined, undefined, Math.max(1, maxWeek)));
      });

    return () => {
      isActive = false;
    };
  }, [semesterId, maxWeek]);

  React.useEffect(() => {
    if (!error) return;
    toast.error(error.message || 'Failed to load calendar schedule.');
  }, [error]);

  useEventBus('timetable:schedule-data-changed', (payload) => {
    if (payload.source !== 'course' && payload.source !== 'semester') return;
    void reload();
  }, [reload]);

  const itemsWithPatches = React.useMemo(() => {
    if (optimisticPatches.size === 0) return items;

    return items.map((item) => {
      const patch = optimisticPatches.get(item.eventId);
      if (!patch) return item;
      return {
        ...item,
        skip: typeof patch.skip === 'boolean' ? patch.skip : item.skip,
        enable: typeof patch.enable === 'boolean' ? patch.enable : item.enable,
      };
    });
  }, [items, optimisticPatches]);

  const calendarEvents = React.useMemo(() => {
    return buildCalendarEvents(
      itemsWithPatches,
      semesterRange.startDate,
      settings.eventColors,
    );
  }, [itemsWithPatches, semesterRange.startDate, settings]);

  const eventsById = React.useMemo(() => {
    const map = new Map<string, CalendarEventData>();
    for (const event of calendarEvents) {
      if (!map.has(event.eventId)) {
        map.set(event.eventId, event);
      }
    }
    return map;
  }, [calendarEvents]);

  const handleWeekChange = React.useCallback((targetWeek: number) => {
    const boundedWeek = Math.max(1, Math.min(Math.max(1, maxWeek), targetWeek));
    startTransition(() => {
      setWeek(boundedWeek);
    });
  }, [maxWeek]);

  const weekRangeLabel = React.useMemo(() => {
    const safeWeek = Math.max(1, week);
    const weekStart = addDays(startOfWeekMonday(semesterRange.startDate), (safeWeek - 1) * 7);
    const weekEnd = addDays(weekStart, 6);
    return `${rangeDateFormatter.format(weekStart)} - ${rangeDateFormatter.format(weekEnd)}`;
  }, [semesterRange.startDate, week]);

  const handleSaveEvent = React.useCallback(async (eventId: string, patch: CalendarEventPatch) => {
    const targetEvent = eventsById.get(eventId);
    if (!targetEvent) {
      toast.error('Unable to locate event for update.');
      return;
    }

    setOptimisticPatches((previous) => {
      const next = new Map(previous);
      next.set(eventId, {
        ...next.get(eventId),
        ...patch,
      });
      return next;
    });

    try {
      await scheduleService.updateCourseEvent(targetEvent.courseId, eventId, {
        skip: patch.skip,
        enable: patch.enable,
      });

      timetableEventBus.publish('timetable:schedule-data-changed', {
        source: 'course',
        reason: 'event-updated',
        courseId: targetEvent.courseId,
        semesterId,
      });

      setOptimisticPatches((previous) => {
        const next = new Map(previous);
        next.delete(eventId);
        return next;
      });

      await reload();
    } catch (updateError: any) {
      setOptimisticPatches((previous) => {
        const next = new Map(previous);
        next.delete(eventId);
        return next;
      });
      toast.error(updateError?.response?.data?.detail?.message ?? updateError?.message ?? 'Failed to update event.');
      throw updateError;
    }
  }, [eventsById, reload, semesterId]);

  if (!semesterId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
          <CardDescription>Semester context is required.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading && items.length === 0) {
    return <CalendarSkeleton />;
  }

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 py-4 sm:py-6">
      <div className="min-h-[460px] min-w-0 overflow-hidden rounded-lg bg-card p-3 sm:p-4">
        <CalendarToolbar
          week={week}
          maxWeek={maxWeek}
          viewMode={viewMode}
          dateRangeLabel={weekRangeLabel}
          onWeekChange={handleWeekChange}
          onViewModeChange={setViewMode}
        />

        <div className="mt-3 min-h-[400px] min-w-0">
          <React.Suspense fallback={<CalendarSkeleton />}>
            <FullCalendarView
              events={calendarEvents}
              week={week}
              maxWeek={maxWeek}
              viewMode={viewMode}
              semesterRange={semesterRange}
              dayStartMinutes={settings.dayStartMinutes}
              dayEndMinutes={settings.dayEndMinutes}
              highlightConflicts={settings.highlightConflicts}
              showWeekends={settings.showWeekends}
              isPending={isPending}
              onWeekChange={handleWeekChange}
              onEventClick={(event) => {
                setSelectedEvent(event);
                setIsEventEditorOpen(true);
              }}
            />
          </React.Suspense>
        </div>
      </div>

      <React.Suspense fallback={null}>
        <EventEditor
          open={isEventEditorOpen}
          onOpenChange={setIsEventEditorOpen}
          event={selectedEvent}
          onSave={handleSaveEvent}
        />
      </React.Suspense>
    </div>
  );
};
