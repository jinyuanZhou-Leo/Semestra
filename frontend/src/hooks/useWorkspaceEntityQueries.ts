// input:  [Program/Semester/Course ids, TanStack Query primitives, shared query keys, and host entity REST APIs]
// output: [`useProgramQuery()`, `useSemesterQuery()`, `useCourseQuery()`, and reusable query-option builders for host-owned entity reads]
// pos:    [Host data-layer query helpers that keep plugin code on stable entity hooks without coupling plugin runtime contracts to TanStack internals]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { queryOptions, useQuery } from '@tanstack/react-query';

import api from '@/services/api';
import { queryKeys } from '@/services/queryKeys';

const ENTITY_STALE_TIME_MS = 60_000;

export const getProgramQueryOptions = (programId: string) => queryOptions({
  queryKey: queryKeys.programs.detail(programId),
  queryFn: () => api.getProgram(programId),
  staleTime: ENTITY_STALE_TIME_MS,
});

export const getSemesterQueryOptions = (semesterId: string) => queryOptions({
  queryKey: queryKeys.semesters.detail(semesterId),
  queryFn: () => api.getSemester(semesterId),
  staleTime: ENTITY_STALE_TIME_MS,
});

export const getCourseQueryOptions = (courseId: string) => queryOptions({
  queryKey: queryKeys.courses.detail(courseId),
  queryFn: () => api.getCourse(courseId),
  staleTime: ENTITY_STALE_TIME_MS,
});

export const useProgramQuery = (programId?: string) => {
  return useQuery({
    ...(getProgramQueryOptions(programId ?? 'disabled')),
    enabled: Boolean(programId),
  });
};

export const useSemesterQuery = (semesterId?: string) => {
  return useQuery({
    ...(getSemesterQueryOptions(semesterId ?? 'disabled')),
    enabled: Boolean(semesterId),
  });
};

export const useCourseQuery = (courseId?: string) => {
  return useQuery({
    ...(getCourseQueryOptions(courseId ?? 'disabled')),
    enabled: Boolean(courseId),
  });
};
