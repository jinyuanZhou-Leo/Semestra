// input:  [entity initial-data cache helpers and isolated TanStack Query client]
// output: [regression tests proving Semester/Course contexts can bootstrap from cached parent payloads while forcing a stale background refresh]
// pos:    [Unit test coverage for route-level entity initial-data derivation from parent query caches]

import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

import { programKeys, semesterKeys, courseKeys } from '@/data/keys';
import type { Course, Program, Semester } from '@/services/api';

import {
  getCourseInitialData,
  getProgramInitialData,
  getSemesterInitialData,
} from './entityContextInitialData';

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
  },
});

const buildProgram = (): Program & { semesters: Semester[] } => ({
  id: 'program-1',
  name: 'Program One',
  cgpa_scaled: 0,
  cgpa_percentage: 0,
  grad_requirement_credits: 0,
  tab_settings: [],
  semesters: [],
});

const buildCourse = (): Course => ({
  id: 'course-1',
  name: 'Algorithms',
  credits: 0.5,
  grade_scaled: 0,
  grade_percentage: 0,
  program_id: 'program-1',
  semester_id: 'semester-1',
  runtime: {
    runtime_tabs: [],
    tab_catalog_items: [],
    widget_catalog_items: [],
    enabled_plugin_ids: [],
    enabled_plugins: [],
    available_widget_types: [],
  },
});

const buildSemester = (): Semester & { courses: Course[] } => ({
  id: 'semester-1',
  name: 'Fall',
  average_scaled: 0,
  average_percentage: 0,
  program_id: 'program-1',
  runtime: {
    runtime_tabs: [],
    tab_catalog_items: [],
    widget_catalog_items: [],
    enabled_plugin_ids: [],
    enabled_plugins: [],
    available_widget_types: [],
  },
  courses: [],
});

describe('entityContextInitialData', () => {
  it('returns the cached program detail payload when present', () => {
    const queryClient = createQueryClient();
    const program = buildProgram();

    queryClient.setQueryData(programKeys.detail(program.id), program);

    const initialData = getProgramInitialData(queryClient, program.id);

    expect(initialData?.data).toEqual(program);
    expect(initialData?.updatedAt).toBeGreaterThan(0);
  });

  it('derives a semester snapshot from cached program detail data', () => {
    const queryClient = createQueryClient();
    const course = buildCourse();
    const semester = { ...buildSemester(), courses: [course] };
    const program = { ...buildProgram(), semesters: [semester] };

    queryClient.setQueryData(programKeys.detail(program.id), program);

    const initialData = getSemesterInitialData(queryClient, semester.id);

    expect(initialData?.data.id).toBe(semester.id);
    expect(initialData?.data.program?.id).toBe(program.id);
    expect(initialData?.updatedAt).toBe(0);
  });

  it('derives a course snapshot from cached semester detail data', () => {
    const queryClient = createQueryClient();
    const course = buildCourse();
    const semester = {
      ...buildSemester(),
      program: {
        id: 'program-1',
        name: 'Program One',
        cgpa_scaled: 0,
        cgpa_percentage: 0,
        grad_requirement_credits: 0,
      },
      courses: [course],
    };

    queryClient.setQueryData(semesterKeys.detail(semester.id), semester);

    const initialData = getCourseInitialData(queryClient, course.id);

    expect(initialData?.data.id).toBe(course.id);
    expect(initialData?.data.program?.id).toBe('program-1');
    expect(initialData?.updatedAt).toBe(0);
  });

  it('prefers the fully cached course detail over stale parent-derived snapshots', () => {
    const queryClient = createQueryClient();
    const course = {
      ...buildCourse(),
      widgets: [{ id: 'widget-1', widget_type: 'clock', title: 'Clock', layout_config: '{}', settings: '{}' }],
    };

    queryClient.setQueryData(courseKeys.detail(course.id), course);

    const initialData = getCourseInitialData(queryClient, course.id);

    expect(initialData?.data.widgets).toHaveLength(1);
    expect(initialData?.updatedAt).toBeGreaterThan(0);
  });
});
