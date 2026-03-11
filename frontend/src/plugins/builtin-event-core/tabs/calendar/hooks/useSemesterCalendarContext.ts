// input:  [semester id, semester API, and shared DST-safe Reading Week date helpers]
// output: [`useSemesterCalendarContext()` hook exposing stable semester range/max-week state]
// pos:    [calendar context hook that owns semester time boundaries independently from registered sources]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import api from '@/services/api';
import type { SemesterDateRange } from '@/calendar-core';
import { getWeekFromSemesterDate, resolveSemesterDateRange } from '../../../shared/utils';

const FALLBACK_MAX_WEEK = 16;
const FALLBACK_RANGE: SemesterDateRange = resolveSemesterDateRange(undefined, undefined, FALLBACK_MAX_WEEK);
const getMaxWeekFromRange = (range: SemesterDateRange) => {
  return Math.max(1, getWeekFromSemesterDate(range.startDate, range.endDate));
};

interface SemesterCalendarContextState {
  semesterRange: SemesterDateRange;
  maxWeek: number;
  error: Error | null;
  isLoading: boolean;
  isReady: boolean;
}

export const useSemesterCalendarContext = (semesterId?: string) => {
  const [state, setState] = React.useState<SemesterCalendarContextState>({
    semesterRange: FALLBACK_RANGE,
    maxWeek: FALLBACK_MAX_WEEK,
    error: null,
    isLoading: false,
    isReady: false,
  });

  const requestCounterRef = React.useRef(0);

  const load = React.useCallback(async () => {
    if (!semesterId) {
      setState({
        semesterRange: FALLBACK_RANGE,
        maxWeek: FALLBACK_MAX_WEEK,
        error: null,
        isLoading: false,
        isReady: false,
      });
      return;
    }

    const requestId = requestCounterRef.current + 1;
    requestCounterRef.current = requestId;

    setState((current) => ({
      ...current,
      isLoading: true,
      error: null,
    }));

    try {
      const semester = await api.getSemester(semesterId);
      if (requestCounterRef.current !== requestId) return;

      const semesterRange = resolveSemesterDateRange(
        semester.start_date,
        semester.end_date,
        FALLBACK_MAX_WEEK,
        semester.reading_week_start,
        semester.reading_week_end,
      );
      setState({
        semesterRange,
        maxWeek: getMaxWeekFromRange(semesterRange),
        error: null,
        isLoading: false,
        isReady: true,
      });
    } catch (error) {
      if (requestCounterRef.current !== requestId) return;
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error : new Error(String(error)),
        isLoading: false,
        isReady: current.isReady,
      }));
    }
  }, [semesterId]);

  React.useEffect(() => {
    void load();

    return () => {
      requestCounterRef.current += 1;
    };
  }, [load]);

  const reload = React.useCallback(async () => {
    await load();
  }, [load]);

  return {
    ...state,
    reload,
  };
};
