// input:  [semester id, semester range, max-week bounds, plugin UI-state cache helpers, and DST-safe shared calendar date helpers]
// output: [`useCalendarNavigationState()` hook exposing stable week/month navigation state, labels, and buffered query ranges]
// pos:    [calendar navigation hook that isolates persisted toolbar/view state from source loading and edit flows with DST-safe academic week math and view-aware fetch windows]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React from 'react';
import { usePluginUiState } from '@/plugin-system';
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
const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const fromDateKey = (value: string): Date | null => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

interface UseCalendarNavigationStateOptions {
  semesterId?: string;
  semesterRange: SemesterDateRange;
  maxWeek: number;
  countReadingWeekInWeekNumber: boolean;
  showWeekends: boolean;
  weekViewDayCount: number;
}

interface CalendarNavigationUiState {
  week: number;
  viewMode: CalendarViewMode;
  monthAnchorDateKey: string;
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
  const {
    state,
    setState,
  } = usePluginUiState<CalendarNavigationUiState>(
    `calendar-navigation:${semesterId ?? 'no-semester'}`,
    () => ({
      week: getCurrentWeek(semesterRange, maxWeek),
      viewMode: CALENDAR_DEFAULT_VIEW_MODE as CalendarViewMode,
      monthAnchorDateKey: toDateKey(semesterRange.startDate),
    }),
  );
  const week = state.week;
  const viewMode = state.viewMode;
  const monthAnchorDate = React.useMemo(
    () => fromDateKey(state.monthAnchorDateKey) ?? semesterRange.startDate,
    [semesterRange.startDate, state.monthAnchorDateKey],
  );

  const currentWeek = React.useMemo(
    () => getCurrentWeek(semesterRange, maxWeek),
    [maxWeek, semesterRange],
  );

  React.useEffect(() => {
    setState((current) => {
      const nextWeek = clampWeek(current.week, maxWeek);
      return nextWeek === current.week ? current : { ...current, week: nextWeek };
    });
  }, [maxWeek, setState]);

  React.useEffect(() => {
    if (viewMode !== 'week') return;
    const nextAnchorDate = getWeekStartForSemester(semesterRange.startDate, week);
    const nextAnchorDateKey = toDateKey(nextAnchorDate);
    if (state.monthAnchorDateKey === nextAnchorDateKey) return;
    setState((current) => ({
      ...current,
      monthAnchorDateKey: nextAnchorDateKey,
    }));
  }, [semesterRange.startDate, setState, state.monthAnchorDateKey, viewMode, week]);

  React.useEffect(() => {
    if (viewMode !== 'month') return;
    const anchorMonth = new Date(monthAnchorDate.getFullYear(), monthAnchorDate.getMonth(), 1);
    const semesterStartMonth = new Date(semesterRange.startDate.getFullYear(), semesterRange.startDate.getMonth(), 1);
    const semesterEndMonth = new Date(semesterRange.endDate.getFullYear(), semesterRange.endDate.getMonth(), 1);

    if (anchorMonth.getTime() < semesterStartMonth.getTime() || anchorMonth.getTime() > semesterEndMonth.getTime()) {
      setState((current) => ({
        ...current,
        monthAnchorDateKey: toDateKey(semesterRange.startDate),
      }));
    }
  }, [monthAnchorDate, semesterRange.endDate, semesterRange.startDate, setState, viewMode]);

  const handleWeekChange = React.useCallback((targetWeek: number) => {
    const boundedWeek = clampWeek(targetWeek, maxWeek);
    setState((current) => ({
      ...current,
      week: boundedWeek,
      monthAnchorDateKey: toDateKey(getWeekStartForSemester(semesterRange.startDate, boundedWeek)),
    }));
  }, [maxWeek, semesterRange.startDate, setState]);

  const handleNavigatePrevious = React.useCallback(() => {
    if (viewMode === 'month') {
      const targetDate = new Date(monthAnchorDate.getFullYear(), monthAnchorDate.getMonth() - 1, 1);
      setState((current) => ({
        ...current,
        monthAnchorDateKey: toDateKey(targetDate),
        week: clampWeek(getWeekFromSemesterDate(semesterRange.startDate, targetDate), maxWeek),
      }));
      return;
    }

    setState((current) => ({
      ...current,
      week: clampWeek(current.week - 1, maxWeek),
      monthAnchorDateKey: toDateKey(getWeekStartForSemester(semesterRange.startDate, clampWeek(current.week - 1, maxWeek))),
    }));
  }, [maxWeek, monthAnchorDate, semesterRange.startDate, setState, viewMode]);

  const handleNavigateNext = React.useCallback(() => {
    if (viewMode === 'month') {
      const targetDate = new Date(monthAnchorDate.getFullYear(), monthAnchorDate.getMonth() + 1, 1);
      setState((current) => ({
        ...current,
        monthAnchorDateKey: toDateKey(targetDate),
        week: clampWeek(getWeekFromSemesterDate(semesterRange.startDate, targetDate), maxWeek),
      }));
      return;
    }

    setState((current) => {
      const nextWeek = clampWeek(current.week + 1, maxWeek);
      return {
        ...current,
        week: nextWeek,
        monthAnchorDateKey: toDateKey(getWeekStartForSemester(semesterRange.startDate, nextWeek)),
      };
    });
  }, [maxWeek, monthAnchorDate, semesterRange.startDate, setState, viewMode]);

  const handleToday = React.useCallback(() => {
    const today = new Date();
    setState((current) => ({
      ...current,
      week: currentWeek,
      monthAnchorDateKey: toDateKey(today),
    }));
  }, [currentWeek, setState]);

  const handleViewModeChange = React.useCallback((nextViewMode: CalendarViewMode) => {
    if (nextViewMode === viewMode) return;
    setState((current) => ({
      ...current,
      viewMode: nextViewMode,
      monthAnchorDateKey: nextViewMode === 'month'
        ? toDateKey(getWeekStartForSemester(semesterRange.startDate, week))
        : current.monthAnchorDateKey,
    }));
  }, [semesterRange.startDate, setState, viewMode, week]);

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
