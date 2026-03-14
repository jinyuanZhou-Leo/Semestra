// input:  [semester schedule service APIs, TanStack Query cache primitives, cache constants, hook options, and shared schedule mappers]
// output: [`useScheduleData` hook for query-cached single-week/all-weeks schedule snapshots]
// pos:    [Shared event-core data hook that centralizes schedule caching, deduplication, and refresh state]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/services/queryKeys';
import scheduleService from '@/services/schedule';

import {
  DEFAULT_WEEK,
  SCHEDULE_CACHE_TTL_MS,
  SCHEDULE_MAX_PARALLEL_REQUESTS,
} from '../constants';
import type { ScheduleDataMode, ScheduleDataSnapshot } from '../types';
import {
  dedupeScheduleItems,
  mapScheduleItemsByWeek,
  sortScheduleItemsByTime,
} from '../utils';

interface UseScheduleDataOptions {
  semesterId?: string;
  mode?: ScheduleDataMode;
  week?: number;
  withConflicts?: boolean;
  enabled?: boolean;
  cacheTtlMs?: number;
  maxParallelRequests?: number;
}

interface UseScheduleDataResult {
  items: ScheduleDataSnapshot['items'];
  itemsByWeek: ScheduleDataSnapshot['itemsByWeek'];
  itemsForWeek: ScheduleDataSnapshot['items'];
  maxWeek: number;
  loadedWeeks: number[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  invalidate: () => void;
}

const EMPTY_SNAPSHOT: ScheduleDataSnapshot = {
  items: [],
  itemsByWeek: new Map(),
  maxWeek: DEFAULT_WEEK,
  loadedWeeks: [],
  fetchedAt: 0,
};

const normalizeError = (value: unknown) => {
  if (value instanceof Error) return value;
  return new Error(typeof value === 'string' ? value : 'Unknown error');
};

const clampPositiveInteger = (value: number, fallback: number) => {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
};

const runWithConcurrencyLimit = async <T,>(tasks: Array<() => Promise<T>>, maxParallelRequests: number) => {
  if (tasks.length === 0) return [] as T[];

  const results: T[] = new Array(tasks.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < tasks.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await tasks[currentIndex]();
    }
  };

  const workerCount = Math.min(tasks.length, Math.max(1, maxParallelRequests));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
};

const loadSingleWeekSnapshot = async (semesterId: string, week: number, withConflicts: boolean): Promise<ScheduleDataSnapshot> => {
  const response = await scheduleService.getSemesterSchedule(semesterId, {
    week,
    withConflicts,
  });

  const sortedItems = sortScheduleItemsByTime(response.items);
  return {
    items: sortedItems,
    itemsByWeek: new Map([[week, sortedItems]]),
    maxWeek: Math.max(DEFAULT_WEEK, response.maxWeek),
    loadedWeeks: [week],
    fetchedAt: Date.now(),
  };
};

const loadAllWeeksSnapshot = async (
  semesterId: string,
  withConflicts: boolean,
  maxParallelRequests: number,
): Promise<ScheduleDataSnapshot> => {
  const firstWeekResponse = await scheduleService.getSemesterSchedule(semesterId, {
    week: DEFAULT_WEEK,
    withConflicts,
  });

  const maxWeek = Math.max(DEFAULT_WEEK, firstWeekResponse.maxWeek);
  const tasks = Array.from({ length: maxWeek - 1 }, (_, index) => {
    const targetWeek = index + 2;
    return () => scheduleService.getSemesterSchedule(semesterId, {
      week: targetWeek,
      withConflicts,
    });
  });

  const remainingWeekResponses = await runWithConcurrencyLimit(tasks, maxParallelRequests);
  const mergedItems = dedupeScheduleItems(
    [firstWeekResponse, ...remainingWeekResponses].flatMap((response) => response.items),
  );
  const sortedItems = sortScheduleItemsByTime(mergedItems);
  const itemsByWeek = mapScheduleItemsByWeek(sortedItems);
  const loadedWeeks = Array.from(itemsByWeek.keys()).sort((a, b) => a - b);

  return {
    items: sortedItems,
    itemsByWeek,
    maxWeek,
    loadedWeeks,
    fetchedAt: Date.now(),
  };
};

export const useScheduleData = (options: UseScheduleDataOptions): UseScheduleDataResult => {
  const {
    semesterId,
    mode = 'all-weeks',
    week = DEFAULT_WEEK,
    withConflicts = true,
    enabled = true,
    cacheTtlMs = SCHEDULE_CACHE_TTL_MS,
    maxParallelRequests = SCHEDULE_MAX_PARALLEL_REQUESTS,
  } = options;

  const queryClient = useQueryClient();
  const safeWeek = clampPositiveInteger(week, DEFAULT_WEEK);
  const safeCacheTtlMs = clampPositiveInteger(cacheTtlMs, SCHEDULE_CACHE_TTL_MS);
  const safeMaxParallelRequests = clampPositiveInteger(maxParallelRequests, SCHEDULE_MAX_PARALLEL_REQUESTS);
  const queryKey = semesterId
    ? queryKeys.semesters.schedule(semesterId, { mode, week: safeWeek, withConflicts })
    : ['semesters', 'schedule', 'disabled'];

  const scheduleQuery = useQuery<ScheduleDataSnapshot>({
    queryKey,
    queryFn: async () => (
      mode === 'all-weeks'
        ? loadAllWeeksSnapshot(semesterId!, withConflicts, safeMaxParallelRequests)
        : loadSingleWeekSnapshot(semesterId!, safeWeek, withConflicts)
    ),
    enabled: Boolean(semesterId) && enabled,
    staleTime: safeCacheTtlMs,
  });

  const snapshot = scheduleQuery.data ?? EMPTY_SNAPSHOT;

  const itemsForWeek = React.useMemo(() => {
    return snapshot.itemsByWeek.get(safeWeek) ?? [];
  }, [snapshot.itemsByWeek, safeWeek]);

  const reload = React.useCallback(async () => {
    if (!semesterId) return;
    await queryClient.invalidateQueries({ queryKey });
    await queryClient.refetchQueries({ queryKey, type: 'active' });
  }, [queryClient, queryKey, semesterId]);

  const invalidate = React.useCallback(() => {
    if (!semesterId) return;
    queryClient.removeQueries({ queryKey });
  }, [queryClient, queryKey, semesterId]);

  return {
    items: snapshot.items,
    itemsByWeek: snapshot.itemsByWeek,
    itemsForWeek,
    maxWeek: snapshot.maxWeek,
    loadedWeeks: snapshot.loadedWeeks,
    isLoading: scheduleQuery.isLoading,
    isRefreshing: scheduleQuery.isFetching && !scheduleQuery.isLoading,
    error: scheduleQuery.error ? normalizeError(scheduleQuery.error) : null,
    reload,
    invalidate,
  };
};
