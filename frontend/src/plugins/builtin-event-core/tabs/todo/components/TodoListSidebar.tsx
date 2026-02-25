"use no memo";

import React from 'react';
import { CirclePlus, Lock, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    <div className="border-r px-2.5 py-3">
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <CardTitle className="text-sm">Lists</CardTitle>
        {mode === 'semester' ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon-xs"
              variant={listManageMode ? 'secondary' : 'outline'}
              onClick={onToggleListManageMode}
              aria-label={listManageMode ? 'Done editing lists' : 'Edit lists'}
              title={listManageMode ? 'Done' : 'Edit'}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant="outline"
              onClick={onCreateCustomList}
              aria-label="Create new list"
              title="New"
            >
              <CirclePlus className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null}
      </div>

      {semesterCourseListsLoading && mode === 'semester' && allLists.length === 0 ? (
        <p className="mb-2 px-0.5 text-xs text-muted-foreground">Loading lists...</p>
      ) : null}

      <ScrollArea className="h-[560px]">
        <div className="space-y-1.5 pr-1">
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
                    'group relative w-full rounded-md px-2 py-1.5 text-left transition-colors',
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
                    size="icon-xs"
                    className={cn(
                      'absolute right-1 top-1 text-destructive transition-opacity hover:bg-destructive/10 hover:text-destructive',
                      canDeleteList ? 'opacity-100' : 'pointer-events-none opacity-0',
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenDeleteListAlert(list);
                    }}
                    aria-label={`Delete list ${list.name}`}
                    title="Delete list"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
