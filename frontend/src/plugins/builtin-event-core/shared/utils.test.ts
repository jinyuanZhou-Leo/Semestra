// input:  [shared calendar date helpers and Vitest assertions]
// output: [regression tests covering semester date parsing, DST-safe week alignment, and Reading Week helpers]
// pos:    [shared event-core test suite for timezone-safe calendar utility behavior]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it } from 'vitest';
import {
  getCalendarVisibleRangeEnd,
  getDisplayMaxWeek,
  getDisplayWeekNumber,
  getVisiblePageStartForDate,
  getWeekFromSemesterDate,
  getWeekStartForSemester,
  isDateInReadingWeek,
  resolveSemesterDateRange,
  shiftCalendarVisibleStartDate,
} from './utils';

describe('shared calendar date helpers', () => {
  it('keeps date-only semester starts on the same local calendar day', () => {
    const range = resolveSemesterDateRange('2026-01-05', '2026-04-30', 16);

    expect(range.startDate.getFullYear()).toBe(2026);
    expect(range.startDate.getMonth()).toBe(0);
    expect(range.startDate.getDate()).toBe(5);
  });

  it('anchors week 1 to the semester start date instead of the previous local day', () => {
    const range = resolveSemesterDateRange('2026-01-05', '2026-04-30', 16);
    const weekOneStart = getWeekStartForSemester(range.startDate, 1);

    expect(weekOneStart.getFullYear()).toBe(2026);
    expect(weekOneStart.getMonth()).toBe(0);
    expect(weekOneStart.getDate()).toBe(5);
  });

  it('keeps Reading Week metadata when the saved range spans a full Monday-to-Sunday week', () => {
    const range = resolveSemesterDateRange('2026-01-05', '2026-04-30', 16, '2026-02-16', '2026-02-22');

    expect(range.readingWeekStart?.toISOString().slice(0, 10)).toBe('2026-02-16');
    expect(range.readingWeekEnd?.toISOString().slice(0, 10)).toBe('2026-02-22');
    expect(isDateInReadingWeek(new Date('2026-02-18T12:00:00'), range)).toBe(true);
    expect(isDateInReadingWeek(new Date('2026-02-23T12:00:00'), range)).toBe(false);
  });

  it('preserves Reading Week ranges that cross the spring DST boundary', () => {
    const range = resolveSemesterDateRange('2026-03-02', '2026-04-30', 16, '2026-03-09', '2026-03-15');

    expect(range.readingWeekStart?.toISOString().slice(0, 10)).toBe('2026-03-09');
    expect(range.readingWeekEnd?.toISOString().slice(0, 10)).toBe('2026-03-15');
  });

  it('skips Reading Week from displayed numbering when the calendar setting is disabled', () => {
    const range = resolveSemesterDateRange('2026-01-05', '2026-04-30', 16, '2026-02-16', '2026-02-22');

    expect(getDisplayWeekNumber(range, 7, false)).toBe(null);
    expect(getDisplayWeekNumber(range, 8, false)).toBe(7);
    expect(getDisplayMaxWeek(range, 16, false)).toBe(15);
    expect(getDisplayWeekNumber(range, 8, true)).toBe(8);
  });

  it('builds weekday-only visible ranges without counting hidden weekends', () => {
    const start = new Date('2026-03-06T00:00:00');
    const end = getCalendarVisibleRangeEnd(start, 3, false);

    expect(end.toISOString().slice(0, 10)).toBe('2026-03-11');
  });

  it('moves visible pages by displayed weekdays when weekends are hidden', () => {
    const start = new Date('2026-03-06T00:00:00');
    const shifted = shiftCalendarVisibleStartDate(start, 2, false);

    expect(shifted.toISOString().slice(0, 10)).toBe('2026-03-10');
  });

  it('finds the page start for a date inside a multi-day week view', () => {
    const pageStart = getVisiblePageStartForDate(new Date('2026-03-12T09:00:00'), 3, false);

    expect(pageStart.toISOString().slice(0, 10)).toBe('2026-03-12');
  });

  it('keeps academic week indexes stable across the spring DST shift', () => {
    const semesterStart = new Date('2026-03-02T00:00:00');

    expect(getWeekFromSemesterDate(semesterStart, new Date('2026-03-09T00:00:00'))).toBe(2);
    expect(getWeekFromSemesterDate(semesterStart, new Date('2026-06-29T00:00:00'))).toBe(18);
  });
});
