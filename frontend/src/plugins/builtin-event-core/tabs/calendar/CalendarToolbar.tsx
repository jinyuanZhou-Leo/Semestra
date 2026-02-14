"use no memo";

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { CalendarViewMode } from '../../shared/types';

interface CalendarToolbarProps {
  week: number;
  maxWeek: number;
  viewMode: CalendarViewMode;
  dateRangeLabel: string;
  isTodayWeek: boolean;
  onWeekChange: (week: number) => void;
  onToday: () => void;
  onViewModeChange: (viewMode: CalendarViewMode) => void;
}

export const CalendarToolbar: React.FC<CalendarToolbarProps> = ({
  week,
  maxWeek,
  viewMode,
  dateRangeLabel,
  isTodayWeek,
  onWeekChange,
  onToday,
  onViewModeChange,
}) => {
  const safeMaxWeek = Math.max(1, maxWeek);
  const safeWeek = Math.max(1, Math.min(safeMaxWeek, week));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-w-[44px] border border-border/60 bg-background hover:bg-muted/30"
          aria-label="Previous week"
          disabled={safeWeek <= 1}
          onClick={() => onWeekChange(safeWeek - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`min-w-[68px] ${
            isTodayWeek
              ? 'border-primary/40 bg-background text-primary hover:bg-primary/10'
              : 'bg-background hover:bg-muted/30'
          }`}
          onClick={onToday}
          disabled={isTodayWeek}
        >
          Today
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-w-[44px] border border-border/60 bg-background hover:bg-muted/30"
          aria-label="Next week"
          disabled={safeWeek >= safeMaxWeek}
          onClick={() => onWeekChange(safeWeek + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

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

      <p className="rounded-md border border-border/70 bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground">
        Week {safeWeek}/{safeMaxWeek} · {dateRangeLabel}
      </p>
    </div>
  );
};
