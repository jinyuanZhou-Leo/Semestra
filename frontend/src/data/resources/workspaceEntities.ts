// input:  [Program/Semester/Course ids, TanStack Query primitives, app-side entity query keys, and host entity REST APIs]
// output: [`useProgramQuery()`, `useSemesterQuery()`, `useCourseQuery()`, and reusable query-option builders for host-owned entity reads]
// pos:    [App-side workspace-entity data resource module keeping host entity query wiring out of pages and contexts]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { queryOptions, useQuery } from '@tanstack/react-query';

import api from '@/services/api';

import { courseKeys, programKeys, semesterKeys } from '../keys';

const ENTITY_STALE_TIME_MS = 60_000;

export const getProgramQueryOptions = (programId: string) => queryOptions({
  queryKey: programKeys.detail(programId),
  queryFn: () => api.getProgram(programId),
  staleTime: ENTITY_STALE_TIME_MS,
});

export const getSemesterQueryOptions = (semesterId: string) => queryOptions({
  queryKey: semesterKeys.detail(semesterId),
  queryFn: () => api.getSemester(semesterId),
  staleTime: ENTITY_STALE_TIME_MS,
});

export const getCourseQueryOptions = (courseId: string) => queryOptions({
  queryKey: courseKeys.detail(courseId),
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
