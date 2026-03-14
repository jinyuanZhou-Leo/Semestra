// input:  [CalendarToolbar UI, testing-library render helpers, and calendar view props]
// output: [regression tests for compact calendar header summary rendering]
// pos:    [Calendar toolbar test suite covering compact right-side period summary layout]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarToolbar } from './CalendarToolbar';

describe('CalendarToolbar', () => {
  it('renders a stable single-shell summary card with separate week label and date range', () => {
    const { container } = render(
      <CalendarToolbar
        week={9}
        maxWeek={16}
        viewMode="week"
        dateRangeLabel="Apr 27 - May 3"
        periodLabel="Week"
        isCurrentPeriod={false}
        displayWeekNumber={8}
        displayMaxWeek={15}
        isReadingWeek={false}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
        onViewModeChange={vi.fn()}
      />,
    );

    const summaryCard = container.querySelector('[data-slot="calendar-period-summary"]');
    const summaryBadge = container.querySelector('[data-slot="calendar-period-badge"]');
    expect(screen.getByText('Week 8/15')).toBeInTheDocument();
    expect(screen.getByText('Apr 27 - May 3')).toBeInTheDocument();
    expect(summaryCard).not.toBeNull();
    expect(summaryBadge).not.toBeNull();
    expect(summaryCard).toHaveClass('min-w-[208px]');
    expect(summaryCard).toHaveClass('rounded-md', 'border', 'bg-background');
    expect(summaryBadge).toHaveClass('tabular-nums', 'text-sm', 'font-semibold');
    expect(screen.queryByText('Academic week')).not.toBeInTheDocument();
  });

  it('keeps the same summary structure for Reading Week copy', () => {
    const { container } = render(
      <CalendarToolbar
        week={7}
        maxWeek={16}
        viewMode="week"
        dateRangeLabel="Feb 16 - Feb 22"
        periodLabel="Week"
        isCurrentPeriod={false}
        displayWeekNumber={null}
        displayMaxWeek={15}
        isReadingWeek
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
        onViewModeChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Reading Week')).toBeInTheDocument();
    expect(screen.getByText('Feb 16 - Feb 22')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="calendar-period-badge"]')).toHaveTextContent('Reading Week');
  });
});
