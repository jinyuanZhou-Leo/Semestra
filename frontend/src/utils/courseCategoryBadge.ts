// input:  [Course category strings, optional custom course hex colors, and course-id collections from program, semester, and todo contexts]
// output: [badge/text class helpers plus course-color style helpers for category and distinct per-course rendering]
// pos:    [Shared visual helper that keeps course badges consistent across dashboard and todo surfaces while supporting custom persisted course colors and collision-free todo fallbacks]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

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

const normalizeDistinctCourseIds = (courseIds: string[]) => {
  return [...new Set(courseIds.filter((value) => value.trim()))].sort((left, right) => left.localeCompare(right));
};

const isHexCourseColor = (value: string | null | undefined): value is string => (
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
import type React from 'react';
