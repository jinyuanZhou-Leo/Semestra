// input:  [semester ID, semester todo REST API, TanStack Query cache client, and shared semester query keys]
// output: [`useSemesterTodoQuery()` and `useSemesterTodoCache()` helpers for cached todo state reads, lookups, and cache updates]
// pos:    [Semester todo server-state hook layer used by Todo tab and calendar/todo cross-surface canonical-cache synchronization]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import api, { type TodoSemesterStateRecord } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';

export const useSemesterTodoQuery = (semesterId?: string) => {
  return useQuery({
    queryKey: semesterId ? queryKeys.semesters.todo(semesterId) : ['semesters', 'todo', 'disabled'],
    queryFn: () => api.getSemesterTodo(semesterId!),
    enabled: Boolean(semesterId),
    staleTime: 30_000,
  });
};

export const useSemesterTodoCache = (semesterId?: string) => {
  const queryClient = useQueryClient();
  const queryKey = semesterId ? queryKeys.semesters.todo(semesterId) : ['semesters', 'todo', 'disabled'];

  const getTodoState = useCallback(() => {
    if (!semesterId) return undefined;
    return queryClient.getQueryData<TodoSemesterStateRecord>(queryKey);
  }, [queryClient, queryKey, semesterId]);

  const setTodoState = useCallback((nextState: TodoSemesterStateRecord) => {
    if (!semesterId) return;
    queryClient.setQueryData(queryKey, nextState);
  }, [queryClient, queryKey, semesterId]);

  const invalidateTodoState = useCallback(async () => {
    if (!semesterId) return;
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey, semesterId]);

  return {
    getTodoState,
    setTodoState,
    invalidateTodoState,
  };
};
