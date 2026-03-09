// input:  [calendar source registry entries, semester calendar context, and refresh signals]
// output: [`useCalendarSources()` hook exposing merged source data plus targeted reload helpers]
// pos:    [calendar orchestration hook that independently loads and refreshes registered sources]
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

export const useCalendarSources = ({ sources, context }: UseCalendarSourcesOptions) => {
  const [state, setState] = React.useState<CalendarSourcesState>(EMPTY_STATE);
  const requestCounterRef = React.useRef(0);

  const replaceSourceState = React.useCallback((
    targetSourceIds: string[],
    nextEntries: Array<{ sourceId: string; events: CalendarEventData[] }>,
    nextErrors: Array<{ sourceId: string; error: Error }>,
    requestId: number,
  ) => {
    if (requestCounterRef.current !== requestId) return;

    setState((current) => {
      const dataBySourceId = new Map(current.dataBySourceId);
      const errorBySourceId = new Map(current.errorBySourceId);
      const loadingSourceIds = new Set(current.loadingSourceIds);

      for (const sourceId of targetSourceIds) {
        dataBySourceId.delete(sourceId);
        errorBySourceId.delete(sourceId);
        loadingSourceIds.delete(sourceId);
      }

      for (const entry of nextEntries) {
        dataBySourceId.set(entry.sourceId, entry.events);
      }

      for (const entry of nextErrors) {
        errorBySourceId.set(entry.sourceId, entry.error);
      }

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

    const settledResults = await Promise.allSettled(
      targetSources.map(async (source) => {
        try {
          return {
            sourceId: source.id,
            events: await source.load(context),
          };
        } catch (error) {
          throw {
            sourceId: source.id,
            error,
          };
        }
      }),
    );

    const nextEntries: Array<{ sourceId: string; events: CalendarEventData[] }> = [];
    const nextErrors: Array<{ sourceId: string; error: Error }> = [];

    for (const result of settledResults) {
      if (result.status === 'fulfilled') {
        nextEntries.push(result.value);
        continue;
      }

      const payload = result.reason as { sourceId?: string; error?: unknown } | undefined;
      nextErrors.push({
        sourceId: payload?.sourceId ?? targetSourceIds[nextErrors.length] ?? 'unknown',
        error: payload?.error instanceof Error ? payload.error : new Error(String(payload?.error ?? result.reason)),
      });
    }

    replaceSourceState(targetSourceIds, nextEntries, nextErrors, requestId);
  }, [context, replaceSourceState]);

  React.useEffect(() => {
    if (!context) {
      setState(EMPTY_STATE);
      return;
    }

    void loadSources(sources);
  }, [context, loadSources, sources]);

  const reloadMatchingSources = React.useCallback(async (signal: CalendarRefreshSignal) => {
    if (!context) return;
    const targetSources = signal.type === 'manual'
      ? sources
      : sources.filter((source) => source.shouldRefresh(signal, context));
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
