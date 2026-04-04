// input:  [TanStack Query client state plus cached Program/Semester/Course detail payloads]
// output: [helpers that derive route-safe initial entity snapshots from existing parent caches]
// pos:    [Context bootstrap helpers that let Semester/Course pages render immediately from cached parent payloads while still forcing a background detail refresh]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { QueryClient } from '@tanstack/react-query';

import { programKeys, semesterKeys, courseKeys } from '@/data/keys';
import type { Course, Program, Semester } from '@/services/api';

export interface EntityInitialData<T> {
  data: T;
  updatedAt: number;
}

const STALE_INITIAL_DATA_UPDATED_AT = 0;

const findProgramSummaries = (queryClient: QueryClient): Array<Program & { semesters: Semester[] }> => {
  return queryClient.getQueriesData<Program & { semesters: Semester[] }>({
    queryKey: ['programs', 'detail'],
  })
    .map(([, program]) => program)
    .filter((program): program is Program & { semesters: Semester[] } => program != null);
};

const findSemesterSummaries = (queryClient: QueryClient): Array<Semester & { courses: Course[] }> => {
  return queryClient.getQueriesData<Semester & { courses: Course[] }>({
    queryKey: ['semesters', 'detail'],
  })
    .map(([, semester]) => semester)
    .filter((semester): semester is Semester & { courses: Course[] } => semester != null);
};

export const getProgramInitialData = (
  queryClient: QueryClient,
  programId: string,
): EntityInitialData<Program & { semesters: Semester[] }> | undefined => {
  const cachedProgram = queryClient.getQueryData<Program & { semesters: Semester[] }>(programKeys.detail(programId));
  if (!cachedProgram) {
    return undefined;
  }

  return {
    data: cachedProgram,
    updatedAt: queryClient.getQueryState(programKeys.detail(programId))?.dataUpdatedAt ?? Date.now(),
  };
};

export const getSemesterInitialData = (
  queryClient: QueryClient,
  semesterId: string,
): EntityInitialData<Semester & { courses: Course[] }> | undefined => {
  const cachedSemester = queryClient.getQueryData<Semester & { courses: Course[] }>(semesterKeys.detail(semesterId));
  if (cachedSemester) {
    return {
      data: cachedSemester,
      updatedAt: queryClient.getQueryState(semesterKeys.detail(semesterId))?.dataUpdatedAt ?? Date.now(),
    };
  }

  for (const program of findProgramSummaries(queryClient)) {
    const nestedSemester = program.semesters.find((semester) => semester.id === semesterId);
    if (!nestedSemester) {
      continue;
    }

    return {
      data: {
        ...nestedSemester,
        courses: nestedSemester.courses ?? [],
        program: nestedSemester.program ?? {
          id: program.id,
          name: program.name,
          cgpa_scaled: program.cgpa_scaled,
          cgpa_percentage: program.cgpa_percentage,
          grad_requirement_credits: program.grad_requirement_credits,
          gpa_scaling_table: program.gpa_scaling_table,
          subject_color_map: program.subject_color_map,
          hide_gpa: program.hide_gpa,
          lms_integration_id: program.lms_integration_id,
          has_lms_dependencies: program.has_lms_dependencies,
          lms_integration: program.lms_integration,
          tab_settings: program.tab_settings,
        },
      },
      updatedAt: STALE_INITIAL_DATA_UPDATED_AT,
    };
  }

  return undefined;
};

export const getCourseInitialData = (
  queryClient: QueryClient,
  courseId: string,
): EntityInitialData<Course> | undefined => {
  const cachedCourse = queryClient.getQueryData<Course>(courseKeys.detail(courseId));
  if (cachedCourse) {
    return {
      data: cachedCourse,
      updatedAt: queryClient.getQueryState(courseKeys.detail(courseId))?.dataUpdatedAt ?? Date.now(),
    };
  }

  for (const semester of findSemesterSummaries(queryClient)) {
    const nestedCourse = semester.courses?.find((course) => course.id === courseId);
    if (!nestedCourse) {
      continue;
    }

    return {
      data: {
        ...nestedCourse,
        program: nestedCourse.program ?? semester.program,
      },
      updatedAt: STALE_INITIAL_DATA_UPDATED_AT,
    };
  }

  for (const program of findProgramSummaries(queryClient)) {
    for (const semester of program.semesters) {
      const nestedCourse = semester.courses?.find((course) => course.id === courseId);
      if (!nestedCourse) {
        continue;
      }

      return {
        data: {
          ...nestedCourse,
          program: nestedCourse.program ?? {
            id: program.id,
            name: program.name,
            cgpa_scaled: program.cgpa_scaled,
            cgpa_percentage: program.cgpa_percentage,
            grad_requirement_credits: program.grad_requirement_credits,
            gpa_scaling_table: program.gpa_scaling_table,
            subject_color_map: program.subject_color_map,
            hide_gpa: program.hide_gpa,
            lms_integration_id: program.lms_integration_id,
            has_lms_dependencies: program.has_lms_dependencies,
            lms_integration: program.lms_integration,
            tab_settings: program.tab_settings,
          },
        },
        updatedAt: STALE_INITIAL_DATA_UPDATED_AT,
      };
    }
  }

  return undefined;
};
