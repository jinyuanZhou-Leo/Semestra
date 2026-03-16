// input:  [semester id, semester range, max-week bounds, and DST-safe shared calendar date helpers]
// output: [`useCalendarNavigationState()` hook exposing stable week/month navigation state, labels, and buffered query ranges]
// pos:    [calendar navigation hook that isolates toolbar/view state from source loading and edit flows with DST-safe academic week math and view-aware fetch windows]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import type { SemesterDateRange } from '@/calendar-core';
import type { CalendarViewMode } from '../../../shared/types';
import { CALENDAR_DEFAULT_VIEW_MODE } from '../../../shared/constants';
import {
  addDays,
  getDisplayMaxWeek,
  getDisplayWeekNumber,
  getWeekFromSemesterDate,
  getWeekStartForSemester,
  isReadingWeek,
  startOfWeekMonday,
} from '../../../shared/utils';

const rangeDateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const monthLabelFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const getCurrentWeek = (semesterRange: SemesterDateRange, maxWeek: number) => {
  const rawWeek = getWeekFromSemesterDate(semesterRange.startDate, new Date());
  const upperBound = Math.max(1, maxWeek);
  return Math.max(1, Math.min(upperBound, rawWeek));
};

interface UseCalendarNavigationStateOptions {
  semesterId?: string;
  semesterRange: SemesterDateRange;
  maxWeek: number;
  countReadingWeekInWeekNumber: boolean;
  showWeekends: boolean;
  weekViewDayCount: number;
}

const clampWeek = (week: number, maxWeek: number) => {
  const upperBound = Math.max(1, maxWeek);
  return Math.max(1, Math.min(upperBound, week));
};

const getMonthGridRange = (anchorDate: Date) => {
  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const monthEndExclusive = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 1);
  const gridStart = startOfWeekMonday(monthStart);
  const gridEnd = addDays(startOfWeekMonday(addDays(monthEndExclusive, -1)), 7);
  return {
    start: gridStart,
    end: gridEnd,
  };
};

const toBufferedQueryRange = (range: { start: Date; end: Date }) => ({
  start: addDays(range.start, -7),
  end: addDays(range.end, 7),
});

export const useCalendarNavigationState = ({
  semesterId,
  semesterRange,
  maxWeek,
  countReadingWeekInWeekNumber,
}: UseCalendarNavigationStateOptions) => {
  const [week, setWeek] = React.useState(1);
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>(CALENDAR_DEFAULT_VIEW_MODE as CalendarViewMode);
  const [monthAnchorDate, setMonthAnchorDate] = React.useState<Date>(semesterRange.startDate);
  const hasUserInteractedWithWeekRef = React.useRef(false);
  const previousSemesterIdRef = React.useRef<string | undefined>(semesterId);

  const currentWeek = React.useMemo(
    () => getCurrentWeek(semesterRange, maxWeek),
    [maxWeek, semesterRange],
  );

  React.useEffect(() => {
    setWeek((current) => clampWeek(current, maxWeek));
  }, [maxWeek]);

  React.useEffect(() => {
    if (previousSemesterIdRef.current === semesterId) return;
    previousSemesterIdRef.current = semesterId;
    hasUserInteractedWithWeekRef.current = false;
    setMonthAnchorDate(semesterRange.startDate);
  }, [semesterId, semesterRange.startDate]);

  React.useEffect(() => {
    if (hasUserInteractedWithWeekRef.current) return;
    setWeek((current) => (current === currentWeek ? current : currentWeek));
  }, [currentWeek]);

  React.useEffect(() => {
    if (viewMode !== 'week') return;
    const nextAnchorDate = getWeekStartForSemester(semesterRange.startDate, week);
    setMonthAnchorDate((current) => (
      current.getTime() === nextAnchorDate.getTime()
        ? current
        : nextAnchorDate
    ));
  }, [semesterRange.startDate, viewMode, week]);

  React.useEffect(() => {
    if (viewMode !== 'month') return;
    const anchorMonth = new Date(monthAnchorDate.getFullYear(), monthAnchorDate.getMonth(), 1);
    const semesterStartMonth = new Date(semesterRange.startDate.getFullYear(), semesterRange.startDate.getMonth(), 1);
    const semesterEndMonth = new Date(semesterRange.endDate.getFullYear(), semesterRange.endDate.getMonth(), 1);

    if (anchorMonth.getTime() < semesterStartMonth.getTime() || anchorMonth.getTime() > semesterEndMonth.getTime()) {
      setMonthAnchorDate(semesterRange.startDate);
    }
  }, [monthAnchorDate, semesterRange.endDate, semesterRange.startDate, viewMode]);

  const handleWeekChange = React.useCallback((targetWeek: number) => {
    hasUserInteractedWithWeekRef.current = true;
    const boundedWeek = clampWeek(targetWeek, maxWeek);
    setWeek(boundedWeek);
    setMonthAnchorDate(getWeekStartForSemester(semesterRange.startDate, boundedWeek));
  }, [maxWeek, semesterRange.startDate]);

  const handleNavigatePrevious = React.useCallback(() => {
    hasUserInteractedWithWeekRef.current = true;
    if (viewMode === 'month') {
      const targetDate = new Date(monthAnchorDate.getFullYear(), monthAnchorDate.getMonth() - 1, 1);
      setMonthAnchorDate(targetDate);
      setWeek(clampWeek(getWeekFromSemesterDate(semesterRange.startDate, targetDate), maxWeek));
      return;
    }

    setWeek((current) => clampWeek(current - 1, maxWeek));
  }, [maxWeek, monthAnchorDate, semesterRange.startDate, viewMode]);

  const handleNavigateNext = React.useCallback(() => {
    hasUserInteractedWithWeekRef.current = true;
    if (viewMode === 'month') {
      const targetDate = new Date(monthAnchorDate.getFullYear(), monthAnchorDate.getMonth() + 1, 1);
      setMonthAnchorDate(targetDate);
      setWeek(clampWeek(getWeekFromSemesterDate(semesterRange.startDate, targetDate), maxWeek));
      return;
    }

    setWeek((current) => clampWeek(current + 1, maxWeek));
  }, [maxWeek, monthAnchorDate, semesterRange.startDate, viewMode]);

  const handleToday = React.useCallback(() => {
    hasUserInteractedWithWeekRef.current = true;
    const today = new Date();
    setWeek(currentWeek);
    setMonthAnchorDate(today);
  }, [currentWeek]);

  const handleViewModeChange = React.useCallback((nextViewMode: CalendarViewMode) => {
    if (nextViewMode === viewMode) return;
    if (nextViewMode === 'month') {
      setMonthAnchorDate(getWeekStartForSemester(semesterRange.startDate, week));
    }
    setViewMode(nextViewMode);
  }, [semesterRange.startDate, viewMode, week]);

  const isCurrentMonth = React.useMemo(() => {
    const today = new Date();
    return today.getFullYear() === monthAnchorDate.getFullYear() && today.getMonth() === monthAnchorDate.getMonth();
  }, [monthAnchorDate]);

  const dateRangeLabel = React.useMemo(() => {
    if (viewMode === 'month') {
      return monthLabelFormatter.format(monthAnchorDate);
    }

    const safeWeek = Math.max(1, week);
    const weekStart = addDays(startOfWeekMonday(semesterRange.startDate), (safeWeek - 1) * 7);
    const weekEnd = addDays(weekStart, 6);
    return `${rangeDateFormatter.format(weekStart)} - ${rangeDateFormatter.format(weekEnd)}`;
  }, [monthAnchorDate, semesterRange.startDate, viewMode, week]);

  const displayWeekNumber = React.useMemo(
    () => getDisplayWeekNumber(semesterRange, week, countReadingWeekInWeekNumber),
    [countReadingWeekInWeekNumber, semesterRange, week],
  );
  const displayMaxWeek = React.useMemo(
    () => getDisplayMaxWeek(semesterRange, maxWeek, countReadingWeekInWeekNumber),
    [countReadingWeekInWeekNumber, maxWeek, semesterRange],
  );
  const shouldShowReadingWeekLabel = React.useMemo(
    () => isReadingWeek(semesterRange, week) && !countReadingWeekInWeekNumber,
    [countReadingWeekInWeekNumber, semesterRange, week],
  );
  const visibleRange = React.useMemo(() => {
    if (viewMode === 'month') {
      return getMonthGridRange(monthAnchorDate);
    }

    const start = getWeekStartForSemester(semesterRange.startDate, week);
    return {
      start,
      end: addDays(start, 7),
    };
  }, [monthAnchorDate, semesterRange.startDate, viewMode, week]);
  const queryRange = React.useMemo(() => toBufferedQueryRange(visibleRange), [visibleRange]);
  const prefetchQueryRanges = React.useMemo(() => {
    if (viewMode === 'month') {
      return [
        toBufferedQueryRange(getMonthGridRange(new Date(monthAnchorDate.getFullYear(), monthAnchorDate.getMonth() - 1, 1))),
        toBufferedQueryRange(getMonthGridRange(new Date(monthAnchorDate.getFullYear(), monthAnchorDate.getMonth() + 1, 1))),
      ];
    }

    const previousVisibleRange = {
      start: addDays(visibleRange.start, -7),
      end: addDays(visibleRange.end, -7),
    };
    const nextVisibleRange = {
      start: addDays(visibleRange.start, 7),
      end: addDays(visibleRange.end, 7),
    };
    return [
      toBufferedQueryRange(previousVisibleRange),
      toBufferedQueryRange(nextVisibleRange),
    ];
  }, [monthAnchorDate, viewMode, visibleRange]);
  const formatWeekLabel = React.useCallback((targetWeek: number) => {
    if (isReadingWeek(semesterRange, targetWeek) && !countReadingWeekInWeekNumber) {
      return 'Reading Week';
    }

    const resolvedWeekNumber = getDisplayWeekNumber(semesterRange, targetWeek, countReadingWeekInWeekNumber) ?? Math.max(1, targetWeek);
    return `Week ${resolvedWeekNumber}/${displayMaxWeek}`;
  }, [countReadingWeekInWeekNumber, displayMaxWeek, semesterRange]);

  return {
    week,
    weekViewStartDate: getWeekStartForSemester(semesterRange.startDate, week),
    viewMode,
    monthAnchorDate,
    currentWeek,
    currentPeriodLabel: viewMode === 'month' ? 'Month' : 'Week',
    isCurrentPeriod: viewMode === 'month' ? isCurrentMonth : week === currentWeek,
    dateRangeLabel,
    displayWeekNumber,
    displayMaxWeek,
    shouldShowReadingWeekLabel,
    visibleRange,
    queryRange,
    prefetchQueryRanges,
    formatWeekLabel,
    handleWeekChange,
    handleNavigatePrevious,
    handleNavigateNext,
    handleToday,
    handleViewModeChange,
  };
};
