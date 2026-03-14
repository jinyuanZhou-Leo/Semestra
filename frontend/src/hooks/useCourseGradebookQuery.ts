// input:  [course ID, gradebook REST APIs, TanStack Query cache client, and shared course query keys]
// output: [`useCourseGradebookQuery()` and `useCourseGradebookMutation()` hooks for cached gradebook reads and writes]
// pos:    [Course gradebook server-state hook layer used by the gradebook tab, settings, and cache invalidation flows]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import api, { type CourseGradebook } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';

export const useCourseGradebookQuery = (courseId?: string) => {
  return useQuery({
    queryKey: courseId ? queryKeys.courses.gradebook(courseId) : ['courses', 'gradebook', 'disabled'],
    queryFn: () => api.getCourseGradebook(courseId!),
    enabled: Boolean(courseId),
    staleTime: 60_000,
  });
};

export const useCourseGradebookMutation = (courseId?: string) => {
  const queryClient = useQueryClient();
  const queryKey = courseId ? queryKeys.courses.gradebook(courseId) : ['courses', 'gradebook', 'disabled'];

  return useMutation({
    mutationFn: async (runner: () => Promise<CourseGradebook>) => runner(),
    onSuccess: (gradebook) => {
      if (!courseId) return;
      queryClient.setQueryData(queryKey, gradebook);
    },
  });
};
