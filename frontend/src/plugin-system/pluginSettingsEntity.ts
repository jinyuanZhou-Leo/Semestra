// input:  [plugin settings scope plus app-side Program/Semester/Course detail query options]
// output: [single-entity query hook shared across plugin settings panels and field buckets]
// pos:    [Provider-level plugin settings entity loader that avoids one query observer per bound field]

import { useQuery } from '@tanstack/react-query';

import { getCourseDetailQueryOptions } from '@/data/resources/courses';
import { getProgramDetailQueryOptions } from '@/data/resources/programs';
import { getSemesterDetailQueryOptions } from '@/data/resources/semesters';
import type { Course, Program, Semester } from '@/services/api';
import type { PluginSettingsScope } from '@/services/pluginSettingsRegistry';

export type SettingsEntity = Program | Semester | Course;

export interface PluginSettingsEntityQueryResult {
  entity: SettingsEntity | null;
  isLoading: boolean;
  refetch: () => Promise<unknown>;
}

export function usePluginSettingsEntityQuery(scope: PluginSettingsScope): PluginSettingsEntityQueryResult {
  const programQuery = useQuery({
    ...getProgramDetailQueryOptions(scope.kind === 'program' ? scope.programId : '__missing__'),
    enabled: scope.kind === 'program',
  });
  const semesterQuery = useQuery({
    ...getSemesterDetailQueryOptions(scope.kind === 'semester' ? scope.semesterId : '__missing__'),
    enabled: scope.kind === 'semester',
  });
  const courseQuery = useQuery({
    ...getCourseDetailQueryOptions(scope.kind === 'course' ? scope.courseId : '__missing__'),
    enabled: scope.kind === 'course',
  });

  if (scope.kind === 'program') {
    return {
      entity: (programQuery.data as SettingsEntity | null) ?? null,
      isLoading: programQuery.isLoading,
      refetch: programQuery.refetch,
    };
  }

  if (scope.kind === 'semester') {
    return {
      entity: (semesterQuery.data as SettingsEntity | null) ?? null,
      isLoading: semesterQuery.isLoading,
      refetch: semesterQuery.refetch,
    };
  }

  return {
    entity: (courseQuery.data as SettingsEntity | null) ?? null,
    isLoading: courseQuery.isLoading,
    refetch: courseQuery.refetch,
  };
}
