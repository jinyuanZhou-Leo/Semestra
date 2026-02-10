import React from 'react';
import { CalendarDays, RefreshCw, Settings2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CalendarViewMode } from '../../shared/types';

interface CalendarToolbarProps {
  week: number;
  maxWeek: number;
  visibleCount: number;
  totalCount: number;
  viewMode: CalendarViewMode;
  isRefreshing: boolean;
  isPending: boolean;
  onViewModeChange: (viewMode: CalendarViewMode) => void;
  onOpenSettings: () => void;
  onReload: () => void;
}

export const CalendarToolbar: React.FC<CalendarToolbarProps> = ({
  week,
  maxWeek,
  visibleCount,
  totalCount,
  viewMode,
  isRefreshing,
  isPending,
  onViewModeChange,
  onOpenSettings,
  onReload,
}) => {
  const safeMaxWeek = Math.max(1, maxWeek);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            Week {week}/{safeMaxWeek}
          </Badge>
          <Badge variant="outline">
            {visibleCount} / {totalCount} events
          </Badge>
          {isPending && <Badge variant="secondary">Updating...</Badge>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[36px] min-w-[44px]"
            onClick={onReload}
            disabled={isRefreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[36px] min-w-[44px]"
            onClick={onOpenSettings}
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      <div className="max-w-[220px] space-y-1.5">
        <span className="text-sm font-medium">View</span>
        <div>
          <Select value={viewMode} onValueChange={(value) => onViewModeChange(value as CalendarViewMode)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
