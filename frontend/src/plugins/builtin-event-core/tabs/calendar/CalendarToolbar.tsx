import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { CalendarViewMode } from '../../shared/types';

interface CalendarToolbarProps {
  week: number;
  maxWeek: number;
  viewMode: CalendarViewMode;
  dateRangeLabel: string;
  onWeekChange: (week: number) => void;
  onViewModeChange: (viewMode: CalendarViewMode) => void;
}

export const CalendarToolbar: React.FC<CalendarToolbarProps> = ({
  week,
  maxWeek,
  viewMode,
  dateRangeLabel,
  onWeekChange,
  onViewModeChange,
}) => {
  const safeMaxWeek = Math.max(1, maxWeek);
  const safeWeek = Math.max(1, Math.min(safeMaxWeek, week));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <ToggleGroup type="multiple" variant="outline" size="sm" value={[]} aria-label="Switch week">
          <ToggleGroupItem
            value="prev-week"
            className="min-w-[44px]"
            aria-label="Previous week"
            disabled={safeWeek <= 1}
            onClick={() => onWeekChange(safeWeek - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="next-week"
            className="min-w-[44px]"
            aria-label="Next week"
            disabled={safeWeek >= safeMaxWeek}
            onClick={() => onWeekChange(safeWeek + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>

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
        >
          <ToggleGroupItem value="week" aria-label="Switch to week view">Week</ToggleGroupItem>
          <ToggleGroupItem value="month" aria-label="Switch to month view">Month</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <p className="text-sm text-muted-foreground">
        Week {safeWeek}/{safeMaxWeek} · {dateRangeLabel}
      </p>
    </div>
  );
};
