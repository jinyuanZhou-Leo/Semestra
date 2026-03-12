// input:  [Todo view metadata, sort state, and semester/course action callbacks]
// output: [TodoMainHeader React component]
// pos:    [Top action bar for the Apple Reminder-style todo list header, sorting, and creation controls]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to
"use no memo";

import React from 'react';
import { ArrowDownAZ, ArrowUpAZ, ArrowUpDown, CirclePlus, ListTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TodoSortDirection, TodoSortMode, TodoSortOption, TodoTabMode } from '../types';

interface TodoMainHeaderProps {
  mode: TodoTabMode;
  title: string;
  sortMode: TodoSortMode;
  sortDirection: TodoSortDirection;
  sortOptions: TodoSortOption[];
  onSortModeChange: (mode: TodoSortMode) => void;
  onSortDirectionChange: (direction: TodoSortDirection) => void;
  onAddSection: () => void;
  onOpenCreateTaskDialog: () => void;
}

export const TodoMainHeader: React.FC<TodoMainHeaderProps> = ({
  mode,
  title,
  sortMode,
  sortDirection,
  sortOptions,
  onSortModeChange,
  onSortDirectionChange,
  onAddSection,
  onOpenCreateTaskDialog,
}) => {
  return (
    <div className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center sm:flex-1">
        <CardTitle className="truncate text-2xl font-semibold leading-none tracking-tight">{title}</CardTitle>
      </div>

      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="h-9 w-9" aria-label="Open sorting options">
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-[210px]">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={sortMode}
              onValueChange={(value) => onSortModeChange(value as TodoSortMode)}
            >
              {sortOptions.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value} className="whitespace-nowrap">
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Order</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onSortDirectionChange('asc')}>
              <ArrowUpAZ className="h-4 w-4" />
              Ascending
              {sortDirection === 'asc' ? <span className="ml-auto text-xs text-muted-foreground">Current</span> : null}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortDirectionChange('desc')}>
              <ArrowDownAZ className="h-4 w-4" />
              Descending
              {sortDirection === 'desc' ? <span className="ml-auto text-xs text-muted-foreground">Current</span> : null}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {mode === 'semester' ? (
          <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={onAddSection}>
            <ListTree className="mr-2 h-4 w-4" />
            Add Section
          </Button>
        ) : null}

        <Button type="button" className="flex-1 sm:flex-none" onClick={onOpenCreateTaskDialog}>
          <CirclePlus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>
    </div>
  );
};
