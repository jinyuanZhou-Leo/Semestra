// input:  [semester id, semester API, and shared DST-safe Reading Week date helpers]
// output: [`useSemesterCalendarContext()` hook exposing stable semester range/max-week state]
// pos:    [calendar context hook that owns semester time boundaries independently from registered sources]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import api from '@/services/api';
import type { SemesterDateRange } from '@/calendar-core';
import { queryKeys } from '@/services/queryKeys';
import { getWeekFromSemesterDate, resolveSemesterDateRange } from '../../../shared/utils';

const FALLBACK_MAX_WEEK = 16;
const FALLBACK_RANGE: SemesterDateRange = resolveSemesterDateRange(undefined, undefined, FALLBACK_MAX_WEEK);
const getMaxWeekFromRange = (range: SemesterDateRange) => {
  return Math.max(1, getWeekFromSemesterDate(range.startDate, range.endDate));
};

export const useSemesterCalendarContext = (semesterId?: string) => {
  const queryClient = useQueryClient();
  const semesterQuery = useQuery({
    queryKey: semesterId ? queryKeys.semesters.detail(semesterId) : ['semesters', 'detail', 'disabled'],
    queryFn: () => api.getSemester(semesterId!),
    enabled: Boolean(semesterId),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const semesterRange = useMemo(() => (
    semesterQuery.data
      ? resolveSemesterDateRange(
        semesterQuery.data.start_date,
        semesterQuery.data.end_date,
        FALLBACK_MAX_WEEK,
        semesterQuery.data.reading_week_start,
        semesterQuery.data.reading_week_end,
      )
      : FALLBACK_RANGE
  ), [
    semesterQuery.data?.end_date,
    semesterQuery.data?.reading_week_end,
    semesterQuery.data?.reading_week_start,
    semesterQuery.data?.start_date,
  ]);
  const maxWeek = useMemo(() => (
    semesterQuery.data ? getMaxWeekFromRange(semesterRange) : FALLBACK_MAX_WEEK
  ), [semesterQuery.data, semesterRange]);
  const error = useMemo(() => (
    semesterQuery.error instanceof Error ? semesterQuery.error : (
      semesterQuery.error ? new Error(String(semesterQuery.error)) : null
    )
  ), [semesterQuery.error]);

  const reload = async () => {
    if (!semesterId) return;
    await queryClient.invalidateQueries({ queryKey: queryKeys.semesters.detail(semesterId) });
    await semesterQuery.refetch();
  };

  return {
    semesterRange,
    maxWeek,
    error,
    isLoading: semesterQuery.isLoading,
    isReady: Boolean(semesterId) && Boolean(semesterQuery.data),
    reload,
  };
};
