// input:  [course names/aliases/categories, optional custom hex colors, optional Program subject-color JSON, and course-id collections]
// output: [subject-code parsing helpers, stable automatic/default course color resolvers, and badge/text style helpers for course UI]
// pos:    [Shared course-color utility layer that keeps Program Dashboard, Course List, Course Settings, and Todo course tags on one color-resolution rule]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type React from 'react';

const CATEGORY_BADGE_COLORS = [
  'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300',
  'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
  'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
];

const CATEGORY_TEXT_COLORS = [
  'text-red-500 dark:text-red-300',
  'text-orange-500 dark:text-orange-300',
  'text-amber-500 dark:text-amber-300',
  'text-yellow-600 dark:text-yellow-300',
  'text-lime-600 dark:text-lime-300',
  'text-green-600 dark:text-green-300',
  'text-emerald-600 dark:text-emerald-300',
  'text-teal-600 dark:text-teal-300',
  'text-cyan-600 dark:text-cyan-300',
  'text-sky-600 dark:text-sky-300',
  'text-blue-600 dark:text-blue-300',
  'text-indigo-500 dark:text-indigo-300',
  'text-violet-500 dark:text-violet-300',
  'text-purple-500 dark:text-purple-300',
  'text-fuchsia-500 dark:text-fuchsia-300',
  'text-pink-500 dark:text-pink-300',
  'text-rose-500 dark:text-rose-300',
];

export const DEFAULT_SUBJECT_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#ea580c',
  '#0891b2',
  '#7c3aed',
  '#ca8a04',
  '#db2777',
  '#0f766e',
  '#4f46e5',
  '#65a30d',
  '#c2410c',
] as const;

type CourseColorSource = {
  name?: string | null;
  alias?: string | null;
  category?: string | null;
  color?: string | null;
};

const normalizeDistinctCourseIds = (courseIds: string[]) => {
  return [...new Set(courseIds.filter((value) => value.trim()))].sort((left, right) => left.localeCompare(right));
};

export const isHexCourseColor = (value: string | null | undefined): value is string => (
  Boolean(value && /^#[0-9a-fA-F]{6}$/.test(value))
);

const hashCourseColor = (category: string, seed?: string) => {
  const source = `${category}::${seed ?? ''}`;
  if (!source.trim()) return -1;

  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = source.charCodeAt(index) + ((hash << 5) - hash);
  }

  return Math.abs(hash);
};

export const normalizeSubjectCode = (value: string | null | undefined) => {
  if (!value) return '';
  const normalized = value.replace(/[^A-Za-z]/g, '').toUpperCase();
  if (normalized.length < 2 || normalized.length > 5) return '';
  return normalized;
};

const extractSubjectCodeFromText = (value: string | null | undefined) => {
  if (!value) return '';
  const match = value.match(/\b([A-Za-z]{2,5})[\s-]*\d{2,4}[A-Za-z0-9]*\b/);
  if (!match) return '';
  return normalizeSubjectCode(match[1]);
};

export const resolveCourseSubjectCode = (course: Pick<CourseColorSource, 'name' | 'alias' | 'category'>) => {
  const categoryCode = normalizeSubjectCode(course.category);
  if (categoryCode) return categoryCode;

  const aliasCode = extractSubjectCodeFromText(course.alias);
  if (aliasCode) return aliasCode;

  return extractSubjectCodeFromText(course.name);
};

export const parseSubjectColorMap = (rawValue: string | null | undefined): Record<string, string> => {
  if (!rawValue) return {};

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.entries(parsed).reduce<Record<string, string>>((accumulator, [key, value]) => {
      const normalizedCode = normalizeSubjectCode(key);
      if (!normalizedCode || typeof value !== 'string' || !isHexCourseColor(value.trim())) {
        return accumulator;
      }

      accumulator[normalizedCode] = value.trim();
      return accumulator;
    }, {});
  } catch {
    return {};
  }
};

export const serializeSubjectColorMap = (value: Record<string, string>) => {
  return JSON.stringify(
    Object.entries(value)
      .filter(([key, color]) => normalizeSubjectCode(key) && isHexCourseColor(color))
      .sort(([left], [right]) => left.localeCompare(right))
      .reduce<Record<string, string>>((accumulator, [key, color]) => {
        accumulator[normalizeSubjectCode(key)] = color;
        return accumulator;
      }, {}),
  );
};

export const getAutomaticSubjectColor = (subjectCode: string) => {
  const normalizedCode = normalizeSubjectCode(subjectCode);
  if (!normalizedCode) return '#3b82f6';

  let hash = 0;
  for (let index = 0; index < normalizedCode.length; index += 1) {
    hash = normalizedCode.charCodeAt(index) + ((hash << 5) - hash);
  }

  return DEFAULT_SUBJECT_COLORS[Math.abs(hash) % DEFAULT_SUBJECT_COLORS.length];
};

export const resolveCourseColor = (
  course: CourseColorSource,
  subjectColorMap: Record<string, string> = {},
) => {
  if (isHexCourseColor(course.color)) return course.color;

  const subjectCode = resolveCourseSubjectCode(course);
  if (!subjectCode) return null;
  return subjectColorMap[subjectCode] ?? getAutomaticSubjectColor(subjectCode);
};

export const getCourseCategoryBadgeClassName = (category: string, seed?: string) => {
  const hash = hashCourseColor(category, seed);
  if (hash < 0) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  return CATEGORY_BADGE_COLORS[hash % CATEGORY_BADGE_COLORS.length];
};

export const getCourseCategoryTextClassName = (category: string, seed?: string) => {
  const hash = hashCourseColor(category, seed);
  if (hash < 0) return 'text-muted-foreground';
  return CATEGORY_TEXT_COLORS[hash % CATEGORY_TEXT_COLORS.length];
};

export const getDistinctCourseBadgeClassName = (courseId: string, courseIds: string[], fallbackCategory = '') => {
  const normalizedCourseIds = normalizeDistinctCourseIds(courseIds);
  const distinctIndex = normalizedCourseIds.indexOf(courseId);
  if (distinctIndex < 0) {
    return getCourseCategoryBadgeClassName(fallbackCategory, courseId);
  }

  return CATEGORY_BADGE_COLORS[distinctIndex % CATEGORY_BADGE_COLORS.length];
};

export const getDistinctCourseTextClassName = (courseId: string, courseIds: string[], fallbackCategory = '') => {
  const normalizedCourseIds = normalizeDistinctCourseIds(courseIds);
  const distinctIndex = normalizedCourseIds.indexOf(courseId);
  if (distinctIndex < 0) {
    return getCourseCategoryTextClassName(fallbackCategory, courseId);
  }

  return CATEGORY_TEXT_COLORS[distinctIndex % CATEGORY_TEXT_COLORS.length];
};

export const getCourseBadgeStyle = (color: string | null | undefined): React.CSSProperties | undefined => {
  if (!isHexCourseColor(color)) return undefined;
  return {
    backgroundColor: `${color}22`,
    color,
  };
};

export const getCourseTextStyle = (color: string | null | undefined): React.CSSProperties | undefined => {
  if (!isHexCourseColor(color)) return undefined;
  return { color };
};
