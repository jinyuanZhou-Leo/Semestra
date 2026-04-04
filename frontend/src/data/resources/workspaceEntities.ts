// input:  [Program/Semester/Course ids, TanStack Query primitives, app-side entity query keys, and host entity REST APIs]
// output: [`useProgramQuery()`, `useSemesterQuery()`, `useCourseQuery()`, and reusable query-option builders for host-owned entity reads]
// pos:    [App-side workspace-entity data resource module keeping host entity query wiring out of pages and contexts]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useQuery } from '@tanstack/react-query';

import { getCourseDetailQueryOptions } from './courses';
import { getProgramDetailQueryOptions } from './programs';
import { getSemesterDetailQueryOptions } from './semesters';

export const getProgramQueryOptions = getProgramDetailQueryOptions;
export const getSemesterQueryOptions = getSemesterDetailQueryOptions;
export const getCourseQueryOptions = getCourseDetailQueryOptions;

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
