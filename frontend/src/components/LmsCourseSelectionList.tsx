// input:  [LMS course summaries, selected-course ids, optional disabled-course reasons, shadcn checkbox/input/select/card/badge/empty/scroll-area primitives, and optional empty-state copy]
// output: [`LmsCourseSelectionList` component]
// pos:    [Reusable LMS course picker list for Add Course/Add Semester flows with wrapper-light search/filter/card composition, linked-course disabled states, concise result metadata, year filtering, and overflow-safe scrollable multi-select cards]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useDeferredValue, useMemo, useState } from 'react';
import { CalendarRange, Search } from 'lucide-react';

import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { LmsCourseSummary } from '@/services/api';

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
  const visibleCourses = useMemo(
    () => courses.filter((course) => course.name.trim().length > 0),
    [courses],
  );

  const yearOptions = useMemo(() => (
    Array.from(new Set(
      visibleCourses
        .map((course) => extractLmsCourseYear(course))
        .filter((year): year is string => year !== null)
    )).sort((left, right) => Number(right) - Number(left))
  ), [visibleCourses]);

  const filteredCourses = useMemo(() => {
    const normalizedQuery = deferredSearchTerm.trim().toLowerCase();

    return visibleCourses.filter((course) => {
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
  }, [visibleCourses, deferredSearchTerm, selectedYear]);

  const toggleCourseSelection = (externalId: string, checked: boolean) => {
    onSelectionChange(
      checked
        ? [...selectedCourseIds, externalId]
        : selectedCourseIds.filter((item) => item !== externalId)
    );
  };

  return (
    <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col gap-4', className)}>
      <div className="grid flex-none gap-3 px-1.5 pt-1.5 sm:grid-cols-[minmax(0,1fr)_9rem]">
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

      <div className="min-h-0 min-w-0 flex-1">
        {visibleCourses.length === 0 ? (
          <div className="flex h-full min-h-[220px] items-center justify-center">
            <Empty className="border-border/70 bg-muted/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarRange />
                </EmptyMedia>
                <EmptyTitle>{emptyTitle}</EmptyTitle>
                <EmptyDescription>{emptyDescription}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="flex h-full min-h-[220px] items-center justify-center">
            <Empty className="border-border/70 bg-muted/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search />
                </EmptyMedia>
                <EmptyTitle>No matching courses</EmptyTitle>
                <EmptyDescription>
                  {searchTerm || selectedYear !== 'all' ? noResultsDescription : emptyDescription}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <ScrollArea className="h-full min-h-0 min-w-0">
            <div className="grid min-w-0 grid-cols-1 gap-3 px-1.5 py-1 pr-5">
              {filteredCourses.map((course) => {
                const checked = selectedCourseIds.includes(course.external_id);
                const disabledReason = disabledCourseReasons[course.external_id];
                const isDisabled = Boolean(disabledReason);
                const courseYear = extractLmsCourseYear(course);
                const courseCode = course.course_code || course.external_id;

                return (
                  <label
                    key={course.external_id}
                    className={cn(
                      'block',
                      isDisabled
                        ? 'cursor-not-allowed'
                        : 'cursor-pointer',
                    )}
                  >
                    <Card
                      className={cn(
                        'gap-3 py-0 transition-colors',
                        checked && !isDisabled && 'bg-accent/40',
                        isDisabled
                          ? 'opacity-60'
                          : 'hover:bg-accent/20',
                      )}
                    >
                      <CardHeader className="grid-cols-[1fr_auto] gap-x-3 gap-y-3 border-b border-border/60 py-4">
                        <div className="flex min-w-0 flex-col gap-2">
                          <CardTitle className="truncate text-sm">{course.name}</CardTitle>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">{courseCode}</span>
                            {courseYear ? <span className="text-xs text-muted-foreground">{courseYear}</span> : null}
                            {isDisabled ? (
                              <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                Linked
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <Checkbox
                          checked={checked}
                          disabled={isDisabled}
                          onCheckedChange={(nextChecked) => toggleCourseSelection(course.external_id, Boolean(nextChecked))}
                          className="mt-0.5"
                        />
                      </CardHeader>
                    </Card>
                  </label>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};
