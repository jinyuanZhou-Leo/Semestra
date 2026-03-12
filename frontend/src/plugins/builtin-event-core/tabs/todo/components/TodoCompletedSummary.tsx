// input:  [Completed task counts, visibility state, and clear/toggle callbacks]
// output: [TodoCompletedSummary React component]
// pos:    [Top summary strip that mirrors Apple Reminders completed affordances without rendering a dedicated completed section]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to
"use no memo";

import React from 'react';
import { Button } from '@/components/ui/button';

interface TodoCompletedSummaryProps {
  completedCount: number;
  showCompleted: boolean;
  onToggleShowCompleted: () => void;
  onClearCompleted: () => void;
}

export const TodoCompletedSummary: React.FC<TodoCompletedSummaryProps> = ({
  completedCount,
  showCompleted,
  onToggleShowCompleted,
  onClearCompleted,
}) => {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3 text-sm">
      <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <span className="truncate text-base">{completedCount} Completed</span>
        <span aria-hidden="true">&bull;</span>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto px-0 text-base text-primary"
          onClick={onClearCompleted}
          disabled={completedCount === 0}
        >
          Clear
        </Button>
      </div>

      <Button type="button" variant="link" size="sm" className="h-auto px-0 text-base text-primary" onClick={onToggleShowCompleted}>
        {showCompleted ? 'Hide' : 'Show'}
      </Button>
    </div>
  );
};
