// input:  [LMS course summaries, selected-course ids, optional disabled-course reasons, shadcn checkbox/input/select/field/scroll-area primitives, and optional empty-state copy]
// output: [`LmsCourseSelectionList` component]
// pos:    [Reusable LMS course picker list for Add Course/Add Semester flows with shadcn-native search/select chrome, linked-course disabled states, a single input-radius results shell, unclipped focus treatment, year filtering, and overflow-safe scrollable multi-select rows]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useDeferredValue, useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldContent, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { LmsCourseSummary } from '@/services/api';
import { AppEmptyState } from './AppEmptyState';

const YEAR_PATTERN = /\b(20\d{2})\b/;

const extractLmsCourseYear = (course: LmsCourseSummary): string | null => {
  for (const candidate of [course.start_at, course.end_at]) {
    if (typeof candidate === 'string' && candidate.length >= 4) {
      const year = candidate.slice(0, 4);
      if (/^\d{4}$/.test(year)) {
        return year;
      }
    }
  }

  for (const candidate of [course.name, course.course_code]) {
    if (typeof candidate !== 'string') {
      continue;
    }
    const matchedYear = candidate.match(YEAR_PATTERN)?.[1];
    if (matchedYear) {
      return matchedYear;
    }
  }

  return null;
};

interface LmsCourseSelectionListProps {
  courses: LmsCourseSummary[];
  selectedCourseIds: string[];
  onSelectionChange: (courseIds: string[]) => void;
  disabledCourseReasons?: Record<string, string>;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  noResultsDescription?: string;
  className?: string;
}

export const LmsCourseSelectionList: React.FC<LmsCourseSelectionListProps> = ({
  courses,
  selectedCourseIds,
  onSelectionChange,
  disabledCourseReasons = {},
  searchPlaceholder = 'Search LMS courses...',
  emptyTitle = 'No LMS courses found',
  emptyDescription = 'This Program does not have available LMS courses.',
  noResultsDescription = 'Try a different keyword or year.',
  className,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState('all');
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const yearOptions = useMemo(() => (
    Array.from(new Set(
      courses
        .map((course) => extractLmsCourseYear(course))
        .filter((year): year is string => year !== null)
    )).sort((left, right) => Number(right) - Number(left))
  ), [courses]);

  const filteredCourses = useMemo(() => {
    const normalizedQuery = deferredSearchTerm.trim().toLowerCase();

    return courses.filter((course) => {
      const courseYear = extractLmsCourseYear(course);
      const matchesYear = selectedYear === 'all' || courseYear === selectedYear;
      if (!matchesYear) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        course.name,
        course.course_code ?? '',
        course.external_id,
        courseYear ?? '',
      ].join(' ').toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [courses, deferredSearchTerm, selectedYear]);

  const toggleCourseSelection = (externalId: string, checked: boolean) => {
    onSelectionChange(
      checked
        ? [...selectedCourseIds, externalId]
        : selectedCourseIds.filter((item) => item !== externalId)
    );
  };

  return (
    <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col gap-4', className)}>
      <div className="grid flex-none gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All years" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All years</SelectItem>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="min-h-0 min-w-0 flex-1 rounded-md border border-border/70 bg-muted/15 p-3">
        {courses.length === 0 ? (
          <div className="p-1">
            <AppEmptyState
              scenario="no-results"
              size="modal"
              title={emptyTitle}
              description={emptyDescription}
            />
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="p-1">
            <AppEmptyState
              scenario="no-results"
              size="modal"
              title={emptyTitle}
              description={searchTerm || selectedYear !== 'all' ? noResultsDescription : emptyDescription}
            />
          </div>
        ) : (
          <div className="min-h-0 min-w-0 h-full">
            <ScrollArea className="h-full min-h-0 min-w-0 [&>[data-slot=scroll-area-viewport]]:overflow-x-hidden [&>[data-slot=scroll-area-viewport]>div]:!block [&>[data-slot=scroll-area-viewport]>div]:min-h-full [&>[data-slot=scroll-area-viewport]>div]:w-full [&>[data-slot=scroll-area-viewport]>div]:min-w-0">
              <div className="w-full min-w-0 max-w-full space-y-2 pr-3">
                {filteredCourses.map((course) => {
                  const checked = selectedCourseIds.includes(course.external_id);
                  const disabledReason = disabledCourseReasons[course.external_id];
                  const isDisabled = Boolean(disabledReason);

                  return (
                    <FieldLabel
                      key={course.external_id}
                      data-checked={checked ? 'true' : undefined}
                      className={cn(
                        "rounded-md transition-[border-color,background-color,box-shadow] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20",
                        isDisabled
                          ? "cursor-not-allowed border-border/60 bg-muted/40 opacity-65"
                          : "hover:border-primary/40 hover:bg-accent/40",
                      )}
                    >
                      <Field orientation="horizontal" className="items-start gap-3 p-4">
                        <Checkbox
                          checked={checked}
                          disabled={isDisabled}
                          onCheckedChange={(nextChecked) => toggleCourseSelection(course.external_id, Boolean(nextChecked))}
                          className="mt-0.5 shrink-0"
                        />
                        <FieldContent className="min-w-0 flex-1 space-y-1">
                          <div className="truncate font-semibold">{course.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {course.course_code || course.external_id}
                          </div>
                          {isDisabled ? (
                            <div className="text-xs text-muted-foreground">
                              {disabledReason}
                            </div>
                          ) : null}
                        </FieldContent>
                      </Field>
                    </FieldLabel>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
};
