// input:  [calendar period state, display week metadata, and calendar navigation callbacks]
// output: [`CalendarToolbar` control bar for calendar navigation, view switching, and stable period summary display]
// pos:    [Calendar header controls that use a unified shadcn-style toolbar layout with a compact Reading Week-aware period summary]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { CalendarViewMode } from '../../shared/types';

interface CalendarToolbarProps {
  week: number;
  maxWeek: number;
  viewMode: CalendarViewMode;
  dateRangeLabel: string;
  periodLabel: string;
  isCurrentPeriod: boolean;
  displayWeekNumber: number | null;
  displayMaxWeek: number;
  isReadingWeek: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewModeChange: (viewMode: CalendarViewMode) => void;
}

export const CalendarToolbar: React.FC<CalendarToolbarProps> = ({
  week,
  maxWeek,
  viewMode,
  dateRangeLabel,
  periodLabel,
  isCurrentPeriod,
  displayWeekNumber,
  displayMaxWeek,
  isReadingWeek,
  onPrevious,
  onNext,
  onToday,
  onViewModeChange,
}) => {
  const safeMaxWeek = Math.max(1, maxWeek);
  const safeWeek = Math.max(1, Math.min(safeMaxWeek, week));
  const weekSummaryLabel = isReadingWeek
    ? 'Reading Week'
    : `Week ${displayWeekNumber ?? safeWeek}/${Math.max(1, displayMaxWeek)}`;
  const summaryBadgeLabel = viewMode === 'week' ? weekSummaryLabel : periodLabel;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <ButtonGroup>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Previous ${periodLabel.toLowerCase()}`}
            disabled={viewMode === 'week' && safeWeek <= 1}
            onClick={onPrevious}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={isCurrentPeriod ? 'border-primary/40 text-primary' : undefined}
            onClick={onToday}
            disabled={isCurrentPeriod}
          >
            Today
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Next ${periodLabel.toLowerCase()}`}
            disabled={viewMode === 'week' && safeWeek >= safeMaxWeek}
            onClick={onNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </ButtonGroup>

        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={viewMode}
          onValueChange={(value) => {
            if (!value) return;
            onViewModeChange(value as CalendarViewMode);
          }}
          aria-label="Calendar view mode"
          className="bg-background"
        >
          <ToggleGroupItem
            value="week"
            aria-label="Switch to week view"
            className="min-w-[68px]"
          >
            Week
          </ToggleGroupItem>
          <ToggleGroupItem
            value="month"
            aria-label="Switch to month view"
            className="min-w-[68px]"
          >
            Month
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div
        data-slot="calendar-period-summary"
        className="flex min-w-[220px] items-center justify-end gap-2 rounded-md border bg-background px-2.5 py-1.5 shadow-xs sm:ml-auto sm:min-w-[248px]"
      >
        <Badge
          data-slot="calendar-period-badge"
          variant="secondary"
          className="min-w-[116px] justify-center tabular-nums"
        >
          {summaryBadgeLabel}
        </Badge>
        <p
          data-slot="calendar-period-range"
          className="min-w-0 flex-1 truncate text-right text-sm font-medium text-foreground"
        >
          {dateRangeLabel}
        </p>
      </div>
    </div>
  );
};
