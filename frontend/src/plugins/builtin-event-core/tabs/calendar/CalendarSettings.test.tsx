// input:  [CalendarSettings dialog, testing-library helpers, built-in source ids, and calendar settings fixtures]
// output: [regression tests covering draft-friendly time input behavior and settings-shape stability in legacy calendar settings]
// pos:    [calendar settings regression suite for time-window input handling and stored settings fixtures]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarSettings } from './CalendarSettings';
import type { CalendarSettingsState } from '../../shared/types';
import {
  BUILTIN_CALENDAR_SOURCE_LMS,
  BUILTIN_CALENDAR_SOURCE_SCHEDULE,
  BUILTIN_CALENDAR_SOURCE_TODO,
} from '../../shared/constants';

if (!('scrollIntoView' in HTMLElement.prototype)) {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    value: () => {},
    writable: true,
  });
}

const buildSettings = (): CalendarSettingsState => ({
  eventColors: {
    [BUILTIN_CALENDAR_SOURCE_SCHEDULE]: '#2563eb',
    [BUILTIN_CALENDAR_SOURCE_TODO]: '#16a34a',
    [BUILTIN_CALENDAR_SOURCE_LMS]: '#0f766e',
  },
  sourceVisibility: {
    [BUILTIN_CALENDAR_SOURCE_SCHEDULE]: true,
    [BUILTIN_CALENDAR_SOURCE_TODO]: true,
    [BUILTIN_CALENDAR_SOURCE_LMS]: true,
  },
  highlightConflicts: true,
  showWeekends: true,
  countReadingWeekInWeekNumber: false,
  renderUnsafeLmsDescriptionHtml: false,
  weekViewDayCount: 5,
  dayStartMinutes: 8 * 60,
  dayEndMinutes: 18 * 60,
});

describe('CalendarSettings', () => {
  it('keeps invalid intermediate time drafts until blur', () => {
    render(
      <CalendarSettings
        open
        onOpenChange={vi.fn()}
        settings={buildSettings()}
        onChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    const startInput = screen.getByLabelText(/Day start time/i);
    fireEvent.change(startInput, { target: { value: '' } });

    expect(startInput).toHaveValue('');

    fireEvent.blur(startInput);

    expect(startInput).toHaveValue('08:00');
  });

  it('accepts minute-level time values', () => {
    const handleChange = vi.fn();

    render(
      <CalendarSettings
        open
        onOpenChange={vi.fn()}
        settings={buildSettings()}
        onChange={handleChange}
        onReset={vi.fn()}
      />,
    );

    const startInput = screen.getByLabelText(/Day start time/i);
    fireEvent.change(startInput, { target: { value: '09:15' } });

    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({
      dayStartMinutes: (9 * 60) + 15,
      dayEndMinutes: 18 * 60,
    }));
  });

  it('toggles Reading Week numbering without changing other settings', () => {
    const handleChange = vi.fn();

    render(
      <CalendarSettings
        open
        onOpenChange={vi.fn()}
        settings={buildSettings()}
        onChange={handleChange}
        onReset={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText(/Count Reading Week in week number/i));

    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({
      countReadingWeekInWeekNumber: true,
      showWeekends: true,
    }));
  });

  it('updates the visible day count for week view paging', () => {
    const handleChange = vi.fn();

    render(
      <CalendarSettings
        open
        onOpenChange={vi.fn()}
        settings={buildSettings()}
        onChange={handleChange}
        onReset={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('combobox', { name: /Days per screen/i }));
    fireEvent.click(screen.getByRole('option', { name: '3 days' }));

    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({
      weekViewDayCount: 3,
    }));
  });
});
