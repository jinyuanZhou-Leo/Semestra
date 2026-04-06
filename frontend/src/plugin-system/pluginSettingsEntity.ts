// input:  [plugin settings scope plus dedicated tab-settings query options for Program/Semester/Course]
// output: [single-entity query hook shared across plugin settings panels and field buckets]
// pos:    [Provider-level plugin settings entity loader backed by independent tab-settings queries, decoupled from entity detail]

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getCourseTabSettingsQueryOptions } from '@/data/resources/courses';
import { getProgramTabSettingsQueryOptions } from '@/data/resources/programs';
import { getSemesterTabSettingsQueryOptions } from '@/data/resources/semesters';
import type { TabSetting } from '@/services/api';
import type { PluginSettingsScope } from '@/services/pluginSettingsRegistry';

export type SettingsEntity = { tab_settings: TabSetting[] };

export interface PluginSettingsEntityQueryResult {
  entity: SettingsEntity | null;
  isLoading: boolean;
  refetch: () => Promise<unknown>;
}

export function usePluginSettingsEntityQuery(scope: PluginSettingsScope): PluginSettingsEntityQueryResult {
  const programQuery = useQuery({
    ...getProgramTabSettingsQueryOptions(scope.kind === 'program' ? scope.programId : '__missing__'),
    enabled: scope.kind === 'program',
  });
  const semesterQuery = useQuery({
    ...getSemesterTabSettingsQueryOptions(scope.kind === 'semester' ? scope.semesterId : '__missing__'),
    enabled: scope.kind === 'semester',
  });
  const courseQuery = useQuery({
    ...getCourseTabSettingsQueryOptions(scope.kind === 'course' ? scope.courseId : '__missing__'),
    enabled: scope.kind === 'course',
  });

  return useMemo(() => {
    if (scope.kind === 'program') {
      return {
        entity: programQuery.data ? { tab_settings: programQuery.data } : null,
        isLoading: programQuery.isLoading,
        refetch: programQuery.refetch,
      };
    }

    if (scope.kind === 'semester') {
      return {
        entity: semesterQuery.data ? { tab_settings: semesterQuery.data } : null,
        isLoading: semesterQuery.isLoading,
        refetch: semesterQuery.refetch,
      };
    }

    return {
      entity: courseQuery.data ? { tab_settings: courseQuery.data } : null,
      isLoading: courseQuery.isLoading,
      refetch: courseQuery.refetch,
    };
  }, [
    scope.kind,
    programQuery.data, programQuery.isLoading, programQuery.refetch,
    semesterQuery.data, semesterQuery.isLoading, semesterQuery.refetch,
    courseQuery.data, courseQuery.isLoading, courseQuery.refetch,
  ]);
}
