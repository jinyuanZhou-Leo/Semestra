// input:  [Active todo list metadata, sort state, and list action callbacks]
// output: [TodoMainHeader React component]
// pos:    [Top action bar for list title, sorting, section creation, and task creation]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to
"use no memo";

import React from 'react';
import { ArrowDownAZ, ArrowUpAZ, ArrowUpDown, CirclePlus, ListTree, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import {
  DropdownMenuItem,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TodoListModel, TodoSortDirection, TodoSortMode, TodoSortOption } from '../types';

interface TodoMainHeaderProps {
  activeList: TodoListModel | null;
  sortMode: TodoSortMode;
  sortDirection: TodoSortDirection;
  sortOptions: TodoSortOption[];
  onSortModeChange: (mode: TodoSortMode) => void;
  onSortDirectionChange: (direction: TodoSortDirection) => void;
  onOpenListTitleEditor: (list: TodoListModel) => void;
  onAddSection: (list: TodoListModel) => void;
  onOpenCreateTaskDialog: (list: TodoListModel) => void;
}

export const TodoMainHeader: React.FC<TodoMainHeaderProps> = ({
  activeList,
  sortMode,
  sortDirection,
  sortOptions,
  onSortModeChange,
  onSortDirectionChange,
  onOpenListTitleEditor,
  onAddSection,
  onOpenCreateTaskDialog,
}) => {
  if (!activeList) {
    return (
      <div className="border-b pb-4">
        <CardTitle className="text-xl leading-9">Todo</CardTitle>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 sm:flex-1">
        <div className="flex items-center gap-2">
          <CardTitle className="truncate text-xl leading-9">{activeList.name}</CardTitle>
          {activeList.editableName ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onOpenListTitleEditor(activeList)}
              aria-label={`Edit title for ${activeList.name}`}
              title="Edit list title"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
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
            <DropdownMenuItem
              className="whitespace-nowrap"
              onClick={() => onSortDirectionChange('asc')}
            >
              <ArrowUpAZ className="h-4 w-4" />
              Ascending
              {sortDirection === 'asc' ? <span className="ml-auto text-xs text-muted-foreground">Current</span> : null}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="whitespace-nowrap"
              onClick={() => onSortDirectionChange('desc')}
            >
              <ArrowDownAZ className="h-4 w-4" />
              Descending
              {sortDirection === 'desc' ? <span className="ml-auto text-xs text-muted-foreground">Current</span> : null}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => onAddSection(activeList)}>
          <ListTree className="mr-2 h-4 w-4" />
          Add Section
        </Button>
        <Button type="button" className="flex-1 sm:flex-none" onClick={() => onOpenCreateTaskDialog(activeList)}>
          <CirclePlus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>
    </div>
  );
};
