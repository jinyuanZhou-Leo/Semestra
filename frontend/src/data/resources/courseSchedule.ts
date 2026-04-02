// input:  [course ids, schedule params, TanStack Query primitives, app-side course/semester query keys, and schedule REST APIs]
// output: [`useCourseEventTypesQuery()`, `useCourseSectionsQuery()`, `useCourseEventsQuery()`, reusable schedule query builders, and shared invalidation helpers]
// pos:    [App-side course-schedule data resource module centralizing Course schedule cache keys and refresh rules]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query';

import scheduleService from '@/services/schedule';

import { courseKeys } from '../keys';

const COURSE_SCHEDULE_STALE_TIME_MS = 30_000;

export const getCourseEventTypesQueryOptions = (courseId: string) => queryOptions({
  queryKey: courseKeys.eventTypes(courseId),
  queryFn: () => scheduleService.getCourseEventTypes(courseId),
  staleTime: COURSE_SCHEDULE_STALE_TIME_MS,
});

export const getCourseSectionsQueryOptions = (courseId: string) => queryOptions({
  queryKey: courseKeys.sections(courseId),
  queryFn: () => scheduleService.getCourseSections(courseId),
  staleTime: COURSE_SCHEDULE_STALE_TIME_MS,
});

export const getCourseEventsQueryOptions = (courseId: string) => queryOptions({
  queryKey: courseKeys.events(courseId),
  queryFn: () => scheduleService.getCourseEvents(courseId),
  staleTime: COURSE_SCHEDULE_STALE_TIME_MS,
});

export const getCourseScheduleQueryOptions = (
  courseId: string,
  params: { week?: number; withConflicts?: boolean } = {},
) => queryOptions({
  queryKey: courseKeys.schedule(courseId, params),
  queryFn: () => scheduleService.getCourseSchedule(courseId, params),
  staleTime: COURSE_SCHEDULE_STALE_TIME_MS,
});

export const useCourseEventTypesQuery = (courseId?: string) => {
  return useQuery({
    ...(getCourseEventTypesQueryOptions(courseId ?? 'disabled')),
    enabled: Boolean(courseId),
  });
};

export const useCourseSectionsQuery = (courseId?: string) => {
  return useQuery({
    ...(getCourseSectionsQueryOptions(courseId ?? 'disabled')),
    enabled: Boolean(courseId),
  });
};

export const useCourseEventsQuery = (courseId?: string) => {
  return useQuery({
    ...(getCourseEventsQueryOptions(courseId ?? 'disabled')),
    enabled: Boolean(courseId),
  });
};

export const useCourseScheduleSnapshotQuery = (
  courseId?: string,
  params: { week?: number; withConflicts?: boolean } = {},
  enabled = true,
) => {
  return useQuery({
    ...getCourseScheduleQueryOptions(courseId ?? 'disabled', params),
    enabled: Boolean(courseId) && enabled,
  });
};

export const invalidateCourseScheduleRelatedQueries = async (
  queryClient: QueryClient,
  {
    courseId,
    semesterId,
  }: {
    courseId: string;
    semesterId?: string;
  },
) => {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: courseKeys.eventTypes(courseId) }),
    queryClient.invalidateQueries({ queryKey: courseKeys.sections(courseId) }),
    queryClient.invalidateQueries({ queryKey: courseKeys.events(courseId) }),
    queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'schedule'] }),
  ];

  if (semesterId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: ['semesters', semesterId, 'schedule'] }),
      queryClient.invalidateQueries({ queryKey: ['semesters', semesterId, 'calendar-schedule'] }),
    );
  }

  await Promise.all(invalidations);
};
