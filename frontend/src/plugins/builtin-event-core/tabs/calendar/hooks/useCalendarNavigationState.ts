// input:  [semester id, semester range, max-week bounds, and shared calendar date helpers]
// output: [`useCalendarNavigationState()` hook exposing stable week/month navigation state and labels]
// pos:    [calendar navigation hook that isolates toolbar/view state from source loading and edit flows]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import type { SemesterDateRange } from '@/calendar-core';
import type { CalendarViewMode } from '../../../shared/types';
import { CALENDAR_DEFAULT_VIEW_MODE, DEFAULT_WEEK } from '../../../shared/constants';
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
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const getCurrentWeek = (semesterRange: SemesterDateRange, maxWeek: number) => {
  const semesterStart = startOfWeekMonday(semesterRange.startDate).getTime();
  const todayStart = startOfWeekMonday(new Date()).getTime();
  const rawWeek = Math.floor((todayStart - semesterStart) / WEEK_MS) + 1;
  const upperBound = Math.max(1, maxWeek);
  return Math.max(1, Math.min(upperBound, rawWeek));
};

interface UseCalendarNavigationStateOptions {
  semesterId?: string;
  semesterRange: SemesterDateRange;
  maxWeek: number;
  countReadingWeekInWeekNumber: boolean;
}

export const useCalendarNavigationState = ({
  semesterId,
  semesterRange,
  maxWeek,
  countReadingWeekInWeekNumber,
}: UseCalendarNavigationStateOptions) => {
  const [week, setWeek] = React.useState(DEFAULT_WEEK);
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>(CALENDAR_DEFAULT_VIEW_MODE as CalendarViewMode);
  const [monthAnchorDate, setMonthAnchorDate] = React.useState<Date>(semesterRange.startDate);
  const hasUserInteractedWithWeekRef = React.useRef(false);
  const previousSemesterIdRef = React.useRef<string | undefined>(semesterId);

  const currentWeek = React.useMemo(
    () => getCurrentWeek(semesterRange, maxWeek),
    [maxWeek, semesterRange],
  );

  React.useEffect(() => {
    setWeek((current) => {
      const upperBound = Math.max(1, maxWeek);
      return Math.max(1, Math.min(upperBound, current));
    });
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
    const boundedWeek = Math.max(1, Math.min(Math.max(1, maxWeek), targetWeek));
    hasUserInteractedWithWeekRef.current = true;
    setWeek(boundedWeek);
    setMonthAnchorDate(getWeekStartForSemester(semesterRange.startDate, boundedWeek));
  }, [maxWeek, semesterRange.startDate]);

  const handleNavigatePrevious = React.useCallback(() => {
    hasUserInteractedWithWeekRef.current = true;
    if (viewMode === 'month') {
      const targetDate = new Date(monthAnchorDate.getFullYear(), monthAnchorDate.getMonth() - 1, 1);
      setMonthAnchorDate(targetDate);
      setWeek(Math.max(1, Math.min(Math.max(1, maxWeek), getWeekFromSemesterDate(semesterRange.startDate, targetDate))));
      return;
    }

    setWeek((current) => Math.max(1, Math.min(Math.max(1, maxWeek), current - 1)));
  }, [maxWeek, monthAnchorDate, semesterRange.startDate, viewMode]);

  const handleNavigateNext = React.useCallback(() => {
    hasUserInteractedWithWeekRef.current = true;
    if (viewMode === 'month') {
      const targetDate = new Date(monthAnchorDate.getFullYear(), monthAnchorDate.getMonth() + 1, 1);
      setMonthAnchorDate(targetDate);
      setWeek(Math.max(1, Math.min(Math.max(1, maxWeek), getWeekFromSemesterDate(semesterRange.startDate, targetDate))));
      return;
    }

    setWeek((current) => Math.max(1, Math.min(Math.max(1, maxWeek), current + 1)));
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
  const formatWeekLabel = React.useCallback((targetWeek: number) => {
    if (isReadingWeek(semesterRange, targetWeek) && !countReadingWeekInWeekNumber) {
      return 'Reading Week';
    }

    const resolvedWeekNumber = getDisplayWeekNumber(semesterRange, targetWeek, countReadingWeekInWeekNumber) ?? Math.max(1, targetWeek);
    return `Week ${resolvedWeekNumber}/${displayMaxWeek}`;
  }, [countReadingWeekInWeekNumber, displayMaxWeek, semesterRange]);

  return {
    week,
    viewMode,
    monthAnchorDate,
    currentWeek,
    currentPeriodLabel: viewMode === 'month' ? 'Month' : 'Week',
    isCurrentPeriod: viewMode === 'month' ? isCurrentMonth : week === currentWeek,
    dateRangeLabel,
    displayWeekNumber,
    displayMaxWeek,
    shouldShowReadingWeekLabel,
    formatWeekLabel,
    handleWeekChange,
    handleNavigatePrevious,
    handleNavigateNext,
    handleToday,
    handleViewModeChange,
  };
};
