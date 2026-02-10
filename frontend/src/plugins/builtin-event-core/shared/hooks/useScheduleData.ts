import React from 'react';
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

interface ScheduleCacheEntry {
  snapshot: ScheduleDataSnapshot;
  expiresAt: number;
}

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

const scheduleCache = new Map<string, ScheduleCacheEntry>();
const inflightRequests = new Map<string, Promise<ScheduleDataSnapshot>>();

const normalizeError = (value: unknown) => {
  if (value instanceof Error) return value;
  return new Error(typeof value === 'string' ? value : 'Unknown error');
};

const clampPositiveInteger = (value: number, fallback: number) => {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
};

const buildCacheKey = (options: Required<Pick<UseScheduleDataOptions, 'semesterId' | 'mode' | 'week' | 'withConflicts'>>) => {
  return [
    options.semesterId,
    options.mode,
    options.week,
    options.withConflicts ? 'conflicts:1' : 'conflicts:0',
  ].join('|');
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

const readCachedSnapshot = (cacheKey: string) => {
  const cachedEntry = scheduleCache.get(cacheKey);
  if (!cachedEntry) return null;
  if (cachedEntry.expiresAt < Date.now()) {
    scheduleCache.delete(cacheKey);
    return null;
  }
  return cachedEntry.snapshot;
};

const saveCachedSnapshot = (cacheKey: string, snapshot: ScheduleDataSnapshot, ttlMs: number) => {
  scheduleCache.set(cacheKey, {
    snapshot,
    expiresAt: Date.now() + ttlMs,
  });
};

const loadScheduleSnapshot = async (
  cacheKey: string,
  options: Required<Pick<UseScheduleDataOptions, 'semesterId' | 'mode' | 'week' | 'withConflicts' | 'cacheTtlMs' | 'maxParallelRequests'>>,
  forceRefresh: boolean,
) => {
  if (!forceRefresh) {
    const cachedSnapshot = readCachedSnapshot(cacheKey);
    if (cachedSnapshot) return cachedSnapshot;
  }

  const inflightRequest = inflightRequests.get(cacheKey);
  if (inflightRequest) {
    return inflightRequest;
  }

  const requestPromise = (async () => {
    const snapshot = options.mode === 'all-weeks'
      ? await loadAllWeeksSnapshot(options.semesterId, options.withConflicts, options.maxParallelRequests)
      : await loadSingleWeekSnapshot(options.semesterId, options.week, options.withConflicts);

    saveCachedSnapshot(cacheKey, snapshot, options.cacheTtlMs);
    return snapshot;
  })();

  inflightRequests.set(cacheKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inflightRequests.delete(cacheKey);
  }
};

const invalidateScheduleCache = (semesterId: string, mode: ScheduleDataMode, withConflicts: boolean, week: number) => {
  const cacheKey = buildCacheKey({ semesterId, mode, week, withConflicts });
  scheduleCache.delete(cacheKey);
  inflightRequests.delete(cacheKey);
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

  const safeWeek = clampPositiveInteger(week, DEFAULT_WEEK);
  const safeCacheTtlMs = clampPositiveInteger(cacheTtlMs, SCHEDULE_CACHE_TTL_MS);
  const safeMaxParallelRequests = clampPositiveInteger(maxParallelRequests, SCHEDULE_MAX_PARALLEL_REQUESTS);

  const [snapshot, setSnapshot] = React.useState<ScheduleDataSnapshot>(EMPTY_SNAPSHOT);
  const [error, setError] = React.useState<Error | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const requestCounterRef = React.useRef(0);

  const load = React.useCallback(async (forceRefresh: boolean) => {
    if (!semesterId || !enabled) {
      setSnapshot(EMPTY_SNAPSHOT);
      setError(null);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const cacheKey = buildCacheKey({
      semesterId,
      mode,
      week: safeWeek,
      withConflicts,
    });

    const requestId = requestCounterRef.current + 1;
    requestCounterRef.current = requestId;

    if (snapshot.items.length > 0) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const nextSnapshot = await loadScheduleSnapshot(
        cacheKey,
        {
          semesterId,
          mode,
          week: safeWeek,
          withConflicts,
          cacheTtlMs: safeCacheTtlMs,
          maxParallelRequests: safeMaxParallelRequests,
        },
        forceRefresh,
      );

      if (requestCounterRef.current !== requestId) {
        return;
      }

      setSnapshot(nextSnapshot);
      setError(null);
    } catch (loadError) {
      if (requestCounterRef.current !== requestId) {
        return;
      }

      setError(normalizeError(loadError));
    } finally {
      if (requestCounterRef.current === requestId) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [enabled, mode, safeWeek, semesterId, snapshot.items.length, withConflicts, safeCacheTtlMs, safeMaxParallelRequests]);

  React.useEffect(() => {
    void load(false);

    return () => {
      requestCounterRef.current += 1;
    };
  }, [load]);

  const reload = React.useCallback(async () => {
    await load(true);
  }, [load]);

  const invalidate = React.useCallback(() => {
    if (!semesterId) return;
    invalidateScheduleCache(semesterId, mode, withConflicts, safeWeek);
  }, [mode, safeWeek, semesterId, withConflicts]);

  const itemsForWeek = React.useMemo(() => {
    return snapshot.itemsByWeek.get(safeWeek) ?? [];
  }, [snapshot.itemsByWeek, safeWeek]);

  return {
    items: snapshot.items,
    itemsByWeek: snapshot.itemsByWeek,
    itemsForWeek,
    maxWeek: snapshot.maxWeek,
    loadedWeeks: snapshot.loadedWeeks,
    isLoading,
    isRefreshing,
    error,
    reload,
    invalidate,
  };
};
