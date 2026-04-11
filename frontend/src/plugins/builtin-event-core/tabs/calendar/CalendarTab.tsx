// input:  [semester context, calendar-core registry, shared timetable event bus, todo sync helpers, calendar settings bucket, and calendar subcomponents]
// output: [Calendar tab runtime component with source-driven event rendering, per-source enable filtering, source-aware event detail safety controls, todo completion sync, and low-coupling extension wiring]
// pos:    [built-in event-core Calendar composition shell — settings are read directly from the plugin settings bucket (usePluginSettingsBucketWithScope) so they stay in sync with the settings panel without relying on host-passed TabProps.settings]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CalendarRefreshSignal } from '../../calendar-core';
import { useCalendarSourceRegistry } from '../../calendar-core';
import type { TabProps } from '@/plugin-system';
import { usePluginSettingsBucketWithScope } from '@/plugin-sdk';
import { useScopedEventBus } from '../../shared/eventBus';
import { publishTimetableScheduleChange } from '../../shared/publishTimetableScheduleChange';
import { timetableSignal } from '../../shared/signals';
import { isDateInReadingWeek } from '../../shared/utils';
import { BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE, TIMETABLE_REFRESH_REASONS } from '../../shared/constants';
import type { TimetableCalendarEvent, TimetableScheduleChangePayload } from '../../shared/types';
import { CalendarToolbar } from './CalendarToolbar';
import { CalendarSkeleton } from './components/CalendarSkeleton';
import {
  getCalendarEventColor,
  normalizeCalendarSettings,
} from './settings';
import { ensureBuiltinCalendarSourcesRegistered } from './sources/registerBuiltinCalendarSources';
import { useCalendarEventEditing } from './hooks/useCalendarEventEditing';
import { useCalendarNavigationState } from './hooks/useCalendarNavigationState';
import { useCalendarSources } from './hooks/useCalendarSources';
import { useSemesterCalendarContext } from './hooks/useSemesterCalendarContext';
import { useViewportBoundHeight } from './hooks/useViewportBoundHeight';
import { syncCalendarTodoCompletion } from '../todo/utils/todoCalendarSync';

ensureBuiltinCalendarSourcesRegistered();

const FullCalendarView = React.lazy(async () => {
  const module = await import('./FullCalendarView');
  return { default: module.FullCalendarView };
});

const EventEditor = React.lazy(async () => {
  const module = await import('./EventEditor');
  return { default: module.EventEditor };
});

const conflictOccurrenceKey = (event: TimetableCalendarEvent) => {
  if (!event.conflictGroupId) return null;
  return `${event.week}:${event.dayOfWeek}:${event.conflictGroupId}`;
};

const payloadToSignal = (payload: TimetableScheduleChangePayload): CalendarRefreshSignal => {
  if (payload.source === 'semester') {
    return { type: 'full', scopeId: payload.semesterId, signalId: payload.signalId };
  }
  return {
    type: 'partial',
    scopeId: payload.semesterId ?? '',
    entityId: payload.courseId,
    tag: payload.reason,
    signalId: payload.signalId,
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (isRecord(error)) {
    const response = error.response;
    if (isRecord(response)) {
      const data = response.data;
      if (isRecord(data)) {
        const detail = data.detail;
        if (isRecord(detail) && typeof detail.message === 'string') {
          return detail.message;
        }
      }
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export const CalendarTab: React.FC<TabProps> = ({ semesterId }) => {
  // Read settings directly from the plugin settings bucket so the tab view always reflects
  // the same inheritance-resolved values as the settings panel — no host adapter needed.
  const calendarScope = React.useMemo(
    () => ({ kind: 'semester' as const, semesterId: semesterId ?? '__missing__' }),
    [semesterId],
  );
  const calendarBucket = usePluginSettingsBucketWithScope(BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE, calendarScope);
  const settings = React.useMemo(
    () => normalizeCalendarSettings(calendarBucket.resolvedSettings),
    [calendarBucket.resolvedSettings],
  );
  const calendarSources = useCalendarSourceRegistry();
  const enabledCalendarSources = React.useMemo(
    () => calendarSources.filter((source) => settings.sourceVisibility[source.id] ?? true),
    [calendarSources, settings.sourceVisibility],
  );
  const sourceById = React.useMemo(
    () => new Map(calendarSources.map((source) => [source.id, source])),
    [calendarSources],
  );
  const sourceColorById = React.useMemo(() => (
    new Map(calendarSources.map((source) => [
      source.id,
      getCalendarEventColor(settings.eventColors, source.id),
    ]))
  ), [calendarSources, settings.eventColors]);
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const skipNextRefreshRef = React.useRef<CalendarRefreshSignal | null>(null);
  const sourceErrorSignatureRef = React.useRef('');
  const semesterContext = useSemesterCalendarContext(semesterId);
  const navigation = useCalendarNavigationState({
    semesterId,
    semesterRange: semesterContext.semesterRange,
    maxWeek: semesterContext.maxWeek,
    countReadingWeekInWeekNumber: settings.countReadingWeekInWeekNumber,
    showWeekends: settings.showWeekends,
    weekViewDayCount: settings.weekViewDayCount,
  });
  const sourceContext = React.useMemo(() => {
    if (!semesterId || !semesterContext.isReady) return null;
    return {
      scopeId: semesterId,
      scopeRange: semesterContext.semesterRange,
      maxPeriod: semesterContext.maxWeek,
      queryRange: navigation.queryRange,
      prefetchQueryRanges: navigation.prefetchQueryRanges,
    };
  }, [navigation.prefetchQueryRanges, navigation.queryRange, semesterContext.isReady, semesterContext.maxWeek, semesterContext.semesterRange, semesterId]);
  const {
    events: rawEvents,
    errorBySourceId,
    isLoading: areSourcesLoading,
    reloadMatchingSources,
  } = useCalendarSources({
    sources: enabledCalendarSources,
    context: sourceContext,
  });
  const events = rawEvents as TimetableCalendarEvent[];
  const {
    selectedEvent,
    selectedSourceLabel,
    isSelectedEventEditable,
    isEventEditorOpen,
    setIsEventEditorOpen,
    eventsWithOptimisticPatches,
    handleEventClick,
    handleSaveEvent,
  } = useCalendarEventEditing({
    events,
    sources: calendarSources,
    context: sourceContext,
    onSaveSuccess: async (event) => {
      if (!semesterId) return;
      const signal = timetableSignal.courseChanged(semesterId, event.courseId, TIMETABLE_REFRESH_REASONS.EVENT_UPDATED);
      skipNextRefreshRef.current = signal;
      publishTimetableScheduleChange({
        source: 'course',
        reason: TIMETABLE_REFRESH_REASONS.EVENT_UPDATED,
        courseId: event.courseId,
        semesterId,
        signalId: signal.signalId,
      });
      await reloadMatchingSources(signal);
    },
  });
  const viewportBoundHeight = useViewportBoundHeight({
    cardRef,
    dependencyKey: [
      settings.dayStartMinutes,
      settings.dayEndMinutes,
      settings.weekViewDayCount,
      settings.showWeekends,
      navigation.viewMode,
    ].join(':'),
  });

  const calendarEvents = React.useMemo(() => {
    const nextEvents: TimetableCalendarEvent[] = [];

    for (const event of eventsWithOptimisticPatches) {
      if (isDateInReadingWeek(event.start, semesterContext.semesterRange)) continue;
      const resolvedColor = event.color ?? sourceColorById.get(event.sourceId);
      nextEvents.push(
        resolvedColor && resolvedColor !== event.color
          ? { ...event, color: resolvedColor }
          : event,
      );
    }

    nextEvents.sort((left, right) => (
      Number(right.allDay) - Number(left.allDay)
      || left.start.getTime() - right.start.getTime()
      || left.title.localeCompare(right.title)
    ));

    return nextEvents;
  }, [eventsWithOptimisticPatches, semesterContext.semesterRange, sourceColorById]);

  const handleManualRefresh = React.useCallback(async () => {
    if (!semesterId) return;
    await Promise.all([
      semesterContext.reload(),
      reloadMatchingSources({
        type: 'manual',
      }),
    ]);
  }, [reloadMatchingSources, semesterContext, semesterId]);

  const handleToggleTodoCompleted = React.useCallback(async (event: TimetableCalendarEvent, completed: boolean) => {
    if (!semesterId) return;

    try {
      const isCourseList = event.todoState?.listSource === 'course';
      const signal: CalendarRefreshSignal = isCourseList
        ? timetableSignal.courseChanged(semesterId, event.courseId, TIMETABLE_REFRESH_REASONS.EVENTS_UPDATED)
        : { type: 'partial', scopeId: semesterId, tag: TIMETABLE_REFRESH_REASONS.EVENTS_UPDATED, signalId: Math.random().toString(36).slice(2, 10) };
      skipNextRefreshRef.current = signal;

      await syncCalendarTodoCompletion({
        semesterId,
        event,
        completed,
        signalId: signal.signalId,
      });

      await reloadMatchingSources(signal);
    } catch (error: unknown) {
      skipNextRefreshRef.current = null;
      toast.error(extractErrorMessage(error, 'Failed to update todo item from Calendar.'));
      throw error;
    }
  }, [reloadMatchingSources, semesterId]);

  const conflictGroups = React.useMemo(() => {
    const groups = new Map<string, TimetableCalendarEvent[]>();

    for (const event of calendarEvents) {
      const groupKey = conflictOccurrenceKey(event);
      if (!groupKey) continue;
      const entries = groups.get(groupKey) ?? [];
      entries.push(event);
      groups.set(groupKey, entries);
    }

    return groups;
  }, [calendarEvents]);

  React.useEffect(() => {
    if (!semesterContext.error) return;
    toast.error(semesterContext.error.message || 'Failed to load calendar context.');
  }, [semesterContext.error]);

  React.useEffect(() => {
    if (errorBySourceId.size === 0) {
      sourceErrorSignatureRef.current = '';
      return;
    }

    const signature = Array.from(errorBySourceId.entries())
      .map(([sourceId, error]) => `${sourceId}:${error.message}`)
      .join('|');
    if (signature === sourceErrorSignatureRef.current) return;
    sourceErrorSignatureRef.current = signature;

    errorBySourceId.forEach((error, sourceId) => {
      const source = sourceById.get(sourceId);
      toast.error(error.message || `Failed to load ${source?.label ?? sourceId}.`);
    });
  }, [errorBySourceId, sourceById]);

  useScopedEventBus('timetable:schedule-data-changed', semesterId, (payload) => {
    const incomingSignal = payloadToSignal(payload);
    const skipSignal = skipNextRefreshRef.current;
    if (skipSignal?.signalId && skipSignal.signalId === incomingSignal.signalId) {
      skipNextRefreshRef.current = null;
      return;
    }

    if (incomingSignal.type === 'full') {
      void semesterContext.reload();
      void reloadMatchingSources(incomingSignal);
      return;
    }

    void reloadMatchingSources(incomingSignal);
  });

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

  if (!semesterContext.isReady && semesterContext.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
          <CardDescription>Failed to load semester calendar context.</CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          <Button type="button" variant="outline" onClick={() => void semesterContext.reload()}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (!semesterContext.isReady && semesterContext.isLoading) {
    return <CalendarSkeleton viewportBoundHeight={viewportBoundHeight} />;
  }

  if (areSourcesLoading && calendarEvents.length === 0) {
    return <CalendarSkeleton viewportBoundHeight={viewportBoundHeight} />;
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div
        ref={cardRef}
        className="grid h-[100%] min-h-0 min-w-0 grid-rows-[auto_1fr] gap-3 overflow-hidden rounded-lg bg-card p-3 sm:p-4"
        style={viewportBoundHeight ? { height: `${viewportBoundHeight}px` } : undefined}
      >
        <CalendarToolbar
          week={navigation.week}
          maxWeek={semesterContext.maxWeek}
          viewMode={navigation.viewMode}
          periodLabel={navigation.currentPeriodLabel}
          dateRangeLabel={navigation.dateRangeLabel}
          isCurrentPeriod={navigation.isCurrentPeriod}
          displayWeekNumber={navigation.displayWeekNumber}
          displayMaxWeek={navigation.displayMaxWeek}
          isReadingWeek={navigation.shouldShowReadingWeekLabel}
          isRefreshing={semesterContext.isLoading || areSourcesLoading}
          onPrevious={navigation.handleNavigatePrevious}
          onNext={navigation.handleNavigateNext}
          onToday={navigation.handleToday}
          onRefresh={() => void handleManualRefresh()}
          onViewModeChange={navigation.handleViewModeChange}
        />

        <div className="min-h-0 min-w-0 overflow-hidden">
          <React.Suspense fallback={<CalendarSkeleton viewportBoundHeight={viewportBoundHeight} />}>
            <FullCalendarView
              events={calendarEvents}
              week={navigation.week}
              maxWeek={semesterContext.maxWeek}
              viewMode={navigation.viewMode}
              monthAnchorDate={navigation.monthAnchorDate}
              weekViewStartDate={navigation.weekViewStartDate}
              semesterRange={semesterContext.semesterRange}
              dayStartMinutes={settings.dayStartMinutes}
              dayEndMinutes={settings.dayEndMinutes}
              weekViewDayCount={settings.weekViewDayCount}
              highlightConflicts={settings.highlightConflicts}
              showWeekends={settings.showWeekends}
              isPending={areSourcesLoading}
              onWeekChange={navigation.handleWeekChange}
              onViewModeChange={navigation.handleViewModeChange}
              onEventClick={handleEventClick}
              onToggleTodoCompleted={handleToggleTodoCompleted}
            />
          </React.Suspense>
        </div>
      </div>

      <React.Suspense fallback={null}>
        <EventEditor
          open={isEventEditorOpen}
          onOpenChange={setIsEventEditorOpen}
          event={selectedEvent}
          sourceLabel={selectedSourceLabel}
          canEdit={isSelectedEventEditable}
          renderUnsafeLmsDescriptionHtml={settings.renderUnsafeLmsDescriptionHtml}
          conflictingEvents={selectedEvent ? (conflictGroups.get(conflictOccurrenceKey(selectedEvent) ?? '') ?? []) : []}
          formatWeekLabel={navigation.formatWeekLabel}
          onSave={handleSaveEvent}
        />
      </React.Suspense>
    </div>
  );
};
