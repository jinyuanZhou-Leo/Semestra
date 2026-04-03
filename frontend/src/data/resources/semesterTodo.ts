// input:  [semester ID, semester todo REST API, TanStack Query cache client, and app-side Semester query keys]
// output: [`useSemesterTodoQuery()` and `useSemesterTodoCache()` helpers for cached todo state reads, lookups, and cache updates]
// pos:    [App-side semester-todo data resource module used by Todo and calendar-adjacent synchronization flows]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import api, { type TodoSemesterStateRecord } from '@/services/api';

import { semesterKeys } from '../keys';

export const useSemesterTodoQuery = (semesterId?: string) => {
  return useQuery({
    queryKey: semesterId ? semesterKeys.todo(semesterId) : ['semesters', 'todo', 'disabled'],
    queryFn: () => api.getSemesterTodo(semesterId!),
    enabled: Boolean(semesterId),
    staleTime: 30_000,
  });
};

export const useSemesterTodoCache = (semesterId?: string) => {
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => (semesterId ? semesterKeys.todo(semesterId) : ['semesters', 'todo', 'disabled']),
    [semesterId],
  );

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
