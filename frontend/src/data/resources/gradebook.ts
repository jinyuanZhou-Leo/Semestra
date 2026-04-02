// input:  [course ID, gradebook REST APIs, TanStack Query cache client, and app-side course query keys]
// output: [`useCourseGradebookQuery()` and `useCourseGradebookMutation()` hooks for cached gradebook reads and writes]
// pos:    [App-side gradebook data resource module used by Course-gradebook surfaces and cache invalidation flows]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import api, { type CourseGradebook } from '@/services/api';

import { courseKeys } from '../keys';

export const useCourseGradebookQuery = (courseId?: string) => {
  return useQuery({
    queryKey: courseId ? courseKeys.gradebook(courseId) : ['courses', 'gradebook', 'disabled'],
    queryFn: () => api.getCourseGradebook(courseId!),
    enabled: Boolean(courseId),
    staleTime: 60_000,
  });
};

export const useCourseGradebookMutation = (courseId?: string) => {
  const queryClient = useQueryClient();
  const queryKey = courseId ? courseKeys.gradebook(courseId) : ['courses', 'gradebook', 'disabled'];

  return useMutation({
    mutationFn: async (runner: () => Promise<CourseGradebook>) => runner(),
    onSuccess: (gradebook) => {
      if (!courseId) return;
      queryClient.setQueryData(queryKey, gradebook);
    },
  });
};
