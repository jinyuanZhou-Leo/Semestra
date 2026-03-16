// input:  [calendar source registry entries, semester calendar context, and refresh signals]
// output: [`useCalendarSources()` hook exposing cache-seeded merged source data plus targeted reload helpers]
// pos:    [calendar orchestration hook that independently loads and refreshes registered sources with per-source progressive commits and revalidates sources when they are re-enabled]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import type {
  CalendarEventData,
  CalendarRefreshSignal,
  CalendarSourceContext,
  CalendarSourceDefinition,
} from '@/calendar-core';

interface CalendarSourcesState {
  dataBySourceId: Map<string, CalendarEventData[]>;
  loadingSourceIds: Set<string>;
  errorBySourceId: Map<string, Error>;
}

const EMPTY_STATE: CalendarSourcesState = {
  dataBySourceId: new Map(),
  loadingSourceIds: new Set(),
  errorBySourceId: new Map(),
};

interface UseCalendarSourcesOptions {
  sources: CalendarSourceDefinition[];
  context: CalendarSourceContext | null;
}

const buildCachedState = (
  sources: CalendarSourceDefinition[],
  context: CalendarSourceContext,
): CalendarSourcesState => {
  const dataBySourceId = new Map<string, CalendarEventData[]>();

  for (const source of sources) {
    const cachedEvents = source.getCached?.(context);
    if (cachedEvents) {
      dataBySourceId.set(source.id, cachedEvents);
    }
  }

  return {
    dataBySourceId,
    loadingSourceIds: new Set(),
    errorBySourceId: new Map(),
  };
};

export const useCalendarSources = ({ sources, context }: UseCalendarSourcesOptions) => {
  const [state, setState] = React.useState<CalendarSourcesState>(() => {
    if (!context) return EMPTY_STATE;
    return buildCachedState(sources, context);
  });
  const requestCounterRef = React.useRef(0);
  const previousSourceIdsRef = React.useRef<Set<string>>(new Set());
  const hasInitializedSourcesRef = React.useRef(false);

  const commitSourceEvents = React.useCallback((
    sourceId: string,
    events: CalendarEventData[],
    requestId: number,
  ) => {
    if (requestCounterRef.current !== requestId) return;

    setState((current) => {
      const dataBySourceId = new Map(current.dataBySourceId);
      const errorBySourceId = new Map(current.errorBySourceId);
      const loadingSourceIds = new Set(current.loadingSourceIds);

      dataBySourceId.set(sourceId, events);
      errorBySourceId.delete(sourceId);
      loadingSourceIds.delete(sourceId);

      return {
        dataBySourceId,
        errorBySourceId,
        loadingSourceIds,
      };
    });
  }, []);

  const commitSourceError = React.useCallback((
    sourceId: string,
    error: Error,
    requestId: number,
  ) => {
    if (requestCounterRef.current !== requestId) return;

    setState((current) => {
      const dataBySourceId = new Map(current.dataBySourceId);
      const errorBySourceId = new Map(current.errorBySourceId);
      const loadingSourceIds = new Set(current.loadingSourceIds);

      errorBySourceId.set(sourceId, error);
      loadingSourceIds.delete(sourceId);

      return {
        dataBySourceId,
        errorBySourceId,
        loadingSourceIds,
      };
    });
  }, []);

  const loadSources = React.useCallback(async (targetSources: CalendarSourceDefinition[]) => {
    if (!context || targetSources.length === 0) return;

    const requestId = requestCounterRef.current + 1;
    requestCounterRef.current = requestId;
    const targetSourceIds = targetSources.map((source) => source.id);

    setState((current) => ({
      dataBySourceId: new Map(current.dataBySourceId),
      errorBySourceId: new Map(current.errorBySourceId),
      loadingSourceIds: new Set([...current.loadingSourceIds, ...targetSourceIds]),
    }));

    await Promise.allSettled(
      targetSources.map(async (source) => {
        try {
          const events = await source.load(context);
          commitSourceEvents(source.id, events, requestId);
        } catch (error) {
          commitSourceError(
            source.id,
            error instanceof Error ? error : new Error(String(error)),
            requestId,
          );
          throw error;
        }
      }),
    );
  }, [commitSourceError, commitSourceEvents, context]);

  React.useEffect(() => {
    if (!context) {
      setState(EMPTY_STATE);
      previousSourceIdsRef.current = new Set();
      hasInitializedSourcesRef.current = false;
      return;
    }

    const cachedState = buildCachedState(sources, context);
    const previousSourceIds = previousSourceIdsRef.current;
    const nextSourceIds = new Set(sources.map((source) => source.id));
    const reenabledSourceIds = !hasInitializedSourcesRef.current
      ? new Set<string>()
      : new Set(sources
        .filter((source) => !previousSourceIds.has(source.id))
        .map((source) => source.id));

    previousSourceIdsRef.current = nextSourceIds;
    hasInitializedSourcesRef.current = true;
    setState(cachedState);

    const sourcesToLoad = sources.filter((source) => (
      reenabledSourceIds.has(source.id) || !cachedState.dataBySourceId.has(source.id)
    ));
    if (sourcesToLoad.length === 0) return;

    void loadSources(sourcesToLoad);
  }, [context, loadSources, sources]);

  const reloadMatchingSources = React.useCallback(async (signal: CalendarRefreshSignal) => {
    if (!context) return;
    const targetSources = signal.type === 'manual'
      ? sources
      : sources.filter((source) => source.shouldRefresh(signal, context));
    await Promise.all(targetSources.map((source) => source.invalidate?.(signal, context)));
    await loadSources(targetSources);
  }, [context, loadSources, sources]);

  const events = React.useMemo(() => {
    return sources.flatMap((source) => state.dataBySourceId.get(source.id) ?? []);
  }, [sources, state.dataBySourceId]);

  return {
    events,
    dataBySourceId: state.dataBySourceId,
    errorBySourceId: state.errorBySourceId,
    isLoading: state.loadingSourceIds.size > 0,
    reloadMatchingSources,
  };
};
