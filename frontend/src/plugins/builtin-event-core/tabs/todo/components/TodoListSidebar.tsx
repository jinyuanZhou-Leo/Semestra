// input:  [Todo list collection state, loading flags, and list-level callbacks from TodoTab]
// output: [TodoListSidebar React component]
// pos:    [List navigation panel for selecting and managing todo lists in semester mode, including lightweight loading placeholders]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to
"use no memo";

import React from 'react';
import { CirclePlus, Lock, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { TodoListModel, TodoTabMode } from '../types';

interface TodoListSidebarProps {
  mode: TodoTabMode;
  listManageMode: boolean;
  semesterCourseListsLoading: boolean;
  allLists: TodoListModel[];
  activeListId?: string;
  onToggleListManageMode: () => void;
  onCreateCustomList: () => void;
  onSelectList: (listId: string) => void;
  onOpenDeleteListAlert: (list: TodoListModel) => void;
}

export const TodoListSidebar: React.FC<TodoListSidebarProps> = ({
  mode,
  listManageMode,
  semesterCourseListsLoading,
  allLists,
  activeListId,
  onToggleListManageMode,
  onCreateCustomList,
  onSelectList,
  onOpenDeleteListAlert,
}) => {
  return (
    <div className="border-b px-2.5 py-3 md:border-b-0 md:border-r">
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <CardTitle className="text-sm">Lists</CardTitle>
        {mode === 'semester' ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon-sm"
              className="md:size-6"
              variant={listManageMode ? 'secondary' : 'outline'}
              onClick={onToggleListManageMode}
              aria-label={listManageMode ? 'Done editing lists' : 'Edit lists'}
              title={listManageMode ? 'Done' : 'Edit'}
            >
              <Pencil className="h-4 w-4 md:h-3.5 md:w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              className="md:size-6"
              variant="outline"
              onClick={onCreateCustomList}
              aria-label="Create new list"
              title="New"
            >
              <CirclePlus className="h-4 w-4 md:h-3.5 md:w-3.5" />
            </Button>
          </div>
        ) : null}
      </div>

      <ScrollArea className="h-[220px] sm:h-[260px] md:h-[560px]">
        <div className="space-y-1.5 pr-1">
          {semesterCourseListsLoading && mode === 'semester' && allLists.length === 0 ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div
                key={`todo-sidebar-skeleton-${index}`}
                className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-3/5 rounded-full" />
                    <Skeleton className="h-3 w-2/5 rounded-full opacity-70" />
                  </div>
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
              </div>
            ))
          ) : null}

          {allLists.map((list) => {
            const isActive = activeListId === list.id;
            const total = list.tasks.length;
            const completed = list.tasks.filter((task) => task.completed).length;
            const isCustomList = list.source === 'semester-custom';
            const canDeleteList = listManageMode && isCustomList;

            return (
              <div key={list.id} className="relative">
                <button
                  type="button"
                  onClick={() => onSelectList(list.id)}
                  className={cn(
                    'group relative min-h-11 w-full rounded-md px-2 py-1.5 text-left transition-colors',
                    isCustomList && 'pr-8',
                    isActive
                      ? 'bg-accent/80 text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium leading-tight">{list.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {completed}/{total} completed
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {list.source === 'course' ? (
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                          Course
                        </Badge>
                      ) : null}
                      {!list.editableName ? <Lock className="h-3 w-3 text-muted-foreground" /> : null}
                    </div>
                  </div>
                </button>

                {isCustomList ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className={cn(
                      'absolute right-1 top-1 text-destructive transition-opacity hover:bg-destructive/10 hover:text-destructive md:size-6',
                      canDeleteList ? 'opacity-100' : 'pointer-events-none opacity-0',
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenDeleteListAlert(list);
                    }}
                    aria-label={`Delete list ${list.name}`}
                    title="Delete list"
                  >
                    <Trash2 className="h-4 w-4 md:h-3.5 md:w-3.5" />
                  </Button>
                ) : null}
              </div>
            );
          })}

          {allLists.length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">No lists yet.</p>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
};
