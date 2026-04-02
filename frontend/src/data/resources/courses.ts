// input:  [TanStack Query primitives, Course APIs, app-side Course/Program/Semester query keys, and QueryClient helpers]
// output: [Course query option builders plus LMS/plugin invalidation helpers for app-side Course resources]
// pos:    [App-side Course data resource module centralizing detail prefetching and LMS-related cache orchestration]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query';

import api, { type Course } from '@/services/api';

import { courseKeys, programKeys, semesterKeys } from '../keys';

const COURSE_DETAIL_STALE_TIME_MS = 300_000;

export const getCourseDetailQueryOptions = (courseId: string) => queryOptions({
  queryKey: courseKeys.detail(courseId),
  queryFn: () => api.getCourse(courseId),
  staleTime: COURSE_DETAIL_STALE_TIME_MS,
});

export const useCourseDetailQuery = (courseId?: string) => {
  return useQuery({
    ...getCourseDetailQueryOptions(courseId ?? 'disabled'),
    enabled: Boolean(courseId),
  });
};

export const setCourseDetailQueryData = (
  queryClient: QueryClient,
  courseId: string,
  updater:
    | Course
    | null
    | undefined
    | ((current: Course | null | undefined) => Course | null | undefined),
) => {
  queryClient.setQueryData<Course | null | undefined>(courseKeys.detail(courseId), updater);
};

export const invalidateCoursePluginQueries = async (queryClient: QueryClient, courseId: string) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: courseKeys.detail(courseId) }),
    queryClient.invalidateQueries({ queryKey: courseKeys.pluginActivations(courseId) }),
  ]);
};

export const invalidateCourseLmsQueries = async (
  queryClient: QueryClient,
  {
    courseId,
    programId,
    semesterId,
    programLmsCoursesParams = { page: 1, page_size: 100 } as Record<string, unknown>,
  }: {
    courseId: string;
    programId?: string | null;
    semesterId?: string | null;
    programLmsCoursesParams?: Record<string, unknown>;
  },
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: courseKeys.lmsLink(courseId) }),
    queryClient.invalidateQueries({ queryKey: courseKeys.lmsAssignments(courseId) }),
    queryClient.invalidateQueries({ queryKey: courseKeys.gradebook(courseId) }),
    ...(programId ? [queryClient.invalidateQueries({ queryKey: programKeys.lmsCourses(programId, programLmsCoursesParams) })] : []),
    ...(semesterId ? [queryClient.invalidateQueries({ queryKey: semesterKeys.lmsAssignments(semesterId) })] : []),
    ...(semesterId ? [queryClient.invalidateQueries({ queryKey: semesterKeys.lmsCalendarEvents(semesterId) })] : []),
  ]);
};
