// input:  [course API, Semester data context, widget runtime contracts, dashboard stat iconography, builtin-gradebook shared GPA-percentage formatting, and shared business empty-state wrappers]
// output: [builtin-gradebook summary widget component and widget definition]
// pos:    [course/semester-scoped read-only KPI widget using CSS-only responsive vertical layout, non-selectable stat tiles, and standardized unavailable empty states]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, GraduationCap, Percent } from 'lucide-react';

import { AppEmptyState } from '@/components/AppEmptyState';
import api from '@/services/api';
import { courseKeys } from '@/services/queryKeys';
import type { WidgetDefinition, WidgetProps } from '@/plugin-system';
import { Skeleton } from '@/components/ui/skeleton';
import { useSemesterData } from '@/contexts/SemesterDataContext';
import { BUILTIN_GRADEBOOK_SUMMARY_WIDGET_TYPE, buildSemesterGradebookSummary, formatGradebookGpaPercentage } from './shared';
import { cn } from '@/lib/utils';

interface SummaryTileProps {
    label: string;
    icon: React.ReactNode;
    value: React.ReactNode;
    className?: string;
    labelClassName?: string;
    valueClassName?: string;
}

const SummaryTile: React.FC<SummaryTileProps> = ({ label, icon, value, className, labelClassName, valueClassName }) => (
    <div className={cn(
        'flex min-h-0 flex-1 select-none items-center justify-between gap-3 rounded-2xl bg-muted/40',
        className,
    )}>
        <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground/80">
            <span className="shrink-0 text-muted-foreground/70">
                {icon}
            </span>
            <p className={cn('truncate font-medium text-muted-foreground/80', labelClassName)}>
                {label}
            </p>
        </div>
        <div className={cn('shrink-0 text-right font-semibold tracking-tight text-foreground', valueClassName)}>
            {value}
        </div>
    </div>
);

const CourseGradebookSummaryWidget: React.FC<Pick<WidgetProps, 'courseId'>> = ({ courseId }) => {
    const courseQuery = useQuery({
        queryKey: courseId ? courseKeys.detail(courseId) : ['courses', 'detail', 'disabled'],
        queryFn: () => api.getCourse(courseId!),
        enabled: Boolean(courseId),
        staleTime: 60_000,
    });

    if (!courseId) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="widget"
                title="Gradebook unavailable"
                description="This widget requires a course context."
            />
        );
    }

    if (courseQuery.isLoading) {
        return (
            <div className="flex h-full min-h-0 flex-col gap-1.5 p-2.5">
                <Skeleton className="min-h-0 flex-1 rounded-2xl" />
                <Skeleton className="min-h-0 flex-1 rounded-2xl" />
                <Skeleton className="min-h-0 flex-1 rounded-2xl" />
            </div>
        );
    }

    const course = courseQuery.data ?? null;

    if (!course) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="widget"
                title="Gradebook unavailable"
                description="Failed to load the latest course metrics."
            />
        );
    }

    return (
        <div className="flex h-full min-h-0 p-2.5">
            <div className="flex h-full min-h-0 w-full flex-col gap-1.5">
                <SummaryTile
                    label="Credits"
                    icon={<BookOpen className="h-3 w-3" aria-hidden="true" />}
                    className="px-2 py-1.5 sm:px-2.5 sm:py-2 md:px-3 md:py-2.5"
                    labelClassName="text-[10px] sm:text-[11px] md:text-xs"
                    valueClassName="text-xs tabular-nums sm:text-sm md:text-base lg:text-lg"
                    value={(
                        <span className="block leading-none">{
                            course.credits.toFixed(2)
                        }</span>
                    )}
                />
                <SummaryTile
                    label="GPA"
                    icon={<GraduationCap className="h-3 w-3" aria-hidden="true" />}
                    className="px-2 py-1.5 sm:px-2.5 sm:py-2 md:px-3 md:py-2.5"
                    labelClassName="text-[10px] sm:text-[11px] md:text-xs"
                    valueClassName="text-xs tabular-nums sm:text-sm md:text-base lg:text-lg"
                    value={(
                        <span className="block leading-none">{course.grade_scaled.toFixed(2)}</span>
                    )}
                />
                <SummaryTile
                    label="GPA Percentage"
                    icon={<Percent className="h-3 w-3" aria-hidden="true" />}
                    className="px-2 py-1.5 sm:px-2.5 sm:py-2 md:px-3 md:py-2.5"
                    labelClassName="text-[10px] sm:text-[11px] md:text-xs"
                    valueClassName="text-xs tabular-nums sm:text-sm md:text-base lg:text-lg"
                    value={(
                        <span className="block leading-none">{formatGradebookGpaPercentage(course.grade_percentage)}</span>
                    )}
                />
            </div>
        </div>
    );
};

const SemesterGradebookSummaryWidget: React.FC = () => {
    const { semester, isLoading } = useSemesterData();

    if (isLoading && !semester) {
        return (
            <div className="flex h-full min-h-0 flex-col gap-1.5 p-2.5">
                <Skeleton className="min-h-0 flex-1 rounded-2xl" />
                <Skeleton className="min-h-0 flex-1 rounded-2xl" />
                <Skeleton className="min-h-0 flex-1 rounded-2xl" />
            </div>
        );
    }

    if (!semester) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="widget"
                title="Gradebook unavailable"
                description="Failed to load semester metrics."
            />
        );
    }

    const summary = buildSemesterGradebookSummary(semester.courses ?? []);

    return (
        <div className="flex h-full min-h-0 p-2.5">
            <div className="flex h-full min-h-0 w-full flex-col gap-1.5">
                <SummaryTile
                    label="Credits"
                    icon={<BookOpen className="h-3 w-3" aria-hidden="true" />}
                    className="px-2 py-1.5 sm:px-2.5 sm:py-2 md:px-3 md:py-2.5"
                    labelClassName="text-[10px] sm:text-[11px] md:text-xs"
                    valueClassName="text-xs tabular-nums sm:text-sm md:text-base lg:text-lg"
                    value={<span className="block leading-none">{summary.included_credits.toFixed(2)}</span>}
                />
                <SummaryTile
                    label="GPA"
                    icon={<GraduationCap className="h-3 w-3" aria-hidden="true" />}
                    className="px-2 py-1.5 sm:px-2.5 sm:py-2 md:px-3 md:py-2.5"
                    labelClassName="text-[10px] sm:text-[11px] md:text-xs"
                    valueClassName="text-xs tabular-nums sm:text-sm md:text-base lg:text-lg"
                    value={<span className="block leading-none">{summary.current_gpa === null ? 'N/A' : summary.current_gpa.toFixed(2)}</span>}
                />
                <SummaryTile
                    label="GPA Percentage"
                    icon={<Percent className="h-3 w-3" aria-hidden="true" />}
                    className="px-2 py-1.5 sm:px-2.5 sm:py-2 md:px-3 md:py-2.5"
                    labelClassName="text-[10px] sm:text-[11px] md:text-xs"
                    valueClassName="text-xs tabular-nums sm:text-sm md:text-base lg:text-lg"
                    value={<span className="block leading-none">{summary.current_percentage === null ? 'N/A' : formatGradebookGpaPercentage(summary.current_percentage)}</span>}
                />
            </div>
        </div>
    );
};

const BuiltinGradebookSummaryWidget: React.FC<WidgetProps> = ({ courseId, semesterId }) => {
    if (courseId) {
        return <CourseGradebookSummaryWidget courseId={courseId} />;
    }
    if (semesterId) {
        return <SemesterGradebookSummaryWidget />;
    }
    return (
        <AppEmptyState
            scenario="unavailable"
            size="widget"
            title="Gradebook unavailable"
            description="This widget requires a course or semester context."
        />
    );
};

export const BuiltinGradebookSummaryWidgetDefinition: WidgetDefinition = {
    type: BUILTIN_GRADEBOOK_SUMMARY_WIDGET_TYPE,
    component: BuiltinGradebookSummaryWidget,
};
