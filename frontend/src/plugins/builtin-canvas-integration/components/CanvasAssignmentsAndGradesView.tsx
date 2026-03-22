// input:  [Canvas assignment and grade payloads, Canvas tab links, Canvas timestamp/link helpers, and shadcn business primitives]
// output: [CanvasAssignmentsView and CanvasGradesView presentational components plus exported gradebook recommendation card]
// pos:    [assignment and grade section renderers for the Canvas integration tab with flattened section layouts and a standalone Gradebook handoff CTA card]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { ArrowRight, ChartColumnIncreasing, ExternalLink, FileSpreadsheet } from 'lucide-react';

import { AppEmptyState } from '@/components/AppEmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { LmsAssignmentSummary, LmsGradeSummary } from '@/services/api';

import { openExternalUrl } from '../tab-helpers';
import { formatCanvasPageTimestamp } from '../shared';

type CanvasGradebookRecommendationCardProps = {
    sectionLabel: string;
    canvasHref?: string | null;
    onOpenGradebook: () => void;
};

export const CanvasGradebookRecommendationCard: React.FC<CanvasGradebookRecommendationCardProps> = ({
    sectionLabel,
    canvasHref,
    onOpenGradebook,
}) => (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-[linear-gradient(135deg,rgba(230,174,140,0.1),rgba(168,206,207,0.14))] p-4 dark:bg-[linear-gradient(135deg,rgba(116,82,66,0.2),rgba(74,110,114,0.24))]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-1">
                <h2 className="text-base font-semibold text-foreground">Manage {sectionLabel.toLowerCase()} in Gradebook</h2>
                <p className="text-sm text-muted-foreground">
                    Use Semestra Gradebook for planning, scoring, and course-level organization.
                </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" size="sm" className="min-w-40" onClick={onOpenGradebook}>
                    Open Gradebook
                    <ArrowRight className="size-4" />
                </Button>
                {canvasHref ? (
                    <Button asChild type="button" size="sm" variant="outline" className="min-w-32 bg-background/75">
                        <a href={canvasHref} target="_blank" rel="noreferrer">
                            Open in Canvas
                        </a>
                    </Button>
                ) : null}
            </div>
        </div>
    </section>
);

const CanvasAssignmentsLoading: React.FC = () => (
    <div className="space-y-4 p-5">
        <Skeleton className="h-7 w-44 rounded-md" />
        {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-20 rounded-2xl" />
        ))}
    </div>
);

const CanvasGradesLoading: React.FC = () => (
    <div className="space-y-4 p-5">
        <Skeleton className="h-7 w-32 rounded-md" />
        {[0, 1].map((index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
    </div>
);

const formatGradeScore = (value?: number | null) => (typeof value === 'number' ? `${value.toFixed(1)}%` : 'Not available');

const formatGradePoints = (value?: number | null) => (typeof value === 'number' ? value.toFixed(1) : 'Not available');

const formatGradeLabel = (value?: string | null) => {
    const normalized = `${value ?? ''}`.trim();
    return normalized || 'Not available';
};

const formatEnrollmentState = (value?: string | null) => {
    const normalized = `${value ?? ''}`.trim();
    if (!normalized) {
        return null;
    }
    return normalized
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
};

export const CanvasAssignmentsView: React.FC<{
    heading: string;
    items: LmsAssignmentSummary[];
    isLoading?: boolean;
    errorMessage?: string | null;
}> = ({ heading, items, isLoading = false, errorMessage }) => (
    <div className="min-h-0 overflow-y-auto">
        <div className="border-b border-border/60 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-foreground">{heading}</h2>
                {!isLoading && !errorMessage && items.length > 0 ? <Badge variant="outline">{items.length}</Badge> : null}
            </div>
        </div>
        {isLoading ? (
            <CanvasAssignmentsLoading />
        ) : errorMessage ? (
            <AppEmptyState
                scenario="unavailable"
                size="section"
                surface="inherit"
                title="Assignments unavailable"
                description={errorMessage}
                className="h-full"
            />
        ) : items.length === 0 ? (
            <AppEmptyState
                scenario="no-results"
                size="section"
                surface="inherit"
                title="No assignments"
                description="Canvas does not currently expose any assignments for this course."
                className="h-full"
            />
        ) : (
            <div className="divide-y divide-border/60">
                {items.map((assignment) => (
                    <button
                        key={assignment.external_id}
                        type="button"
                        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/35"
                        onClick={() => openExternalUrl(assignment.html_url)}
                    >
                        <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="inline-flex size-8 items-center justify-center rounded-xl bg-muted/55 text-muted-foreground">
                                    <FileSpreadsheet className="size-4" />
                                </div>
                                <h3
                                    className={cn(
                                        'truncate text-base font-semibold text-foreground decoration-current underline-offset-4',
                                        assignment.html_url ? 'hover:underline' : '',
                                    )}
                                >
                                    {assignment.title}
                                </h3>
                                {!assignment.published ? <Badge variant="outline">Hidden</Badge> : null}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                <span>Due {formatCanvasPageTimestamp(assignment.due_at ?? assignment.due_date)}</span>
                                {assignment.unlock_at ? <span>Unlocks {formatCanvasPageTimestamp(assignment.unlock_at)}</span> : null}
                                {assignment.lock_at ? <span>Closes {formatCanvasPageTimestamp(assignment.lock_at)}</span> : null}
                            </div>
                            {assignment.submission_types.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {assignment.submission_types.slice(0, 3).map((submissionType) => (
                                        <Badge key={submissionType} variant="secondary" className="font-normal">
                                            {submissionType.replace(/_/g, ' ')}
                                        </Badge>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                        {assignment.html_url ? <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> : null}
                    </button>
                ))}
            </div>
        )}
    </div>
);

export const CanvasGradesView: React.FC<{
    heading: string;
    items: LmsGradeSummary[];
    isLoading?: boolean;
    errorMessage?: string | null;
    canvasHref?: string | null;
}> = ({ heading, items, isLoading = false, errorMessage, canvasHref }) => {
    if (isLoading) {
        return <CanvasGradesLoading />;
    }

    if (errorMessage) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="section"
                surface="inherit"
                title="Grades unavailable"
                description={errorMessage}
                className="h-full"
            />
        );
    }

    if (items.length === 0) {
        return (
            <AppEmptyState
                scenario="no-results"
                size="section"
                surface="inherit"
                title="No grades"
                description="Canvas did not return any student grade records for this course."
                primaryAction={canvasHref ? (
                    <Button asChild variant="outline" size="sm">
                        <a href={canvasHref} target="_blank" rel="noreferrer">
                            Open Canvas Grades
                        </a>
                    </Button>
                ) : undefined}
                className="h-full"
            />
        );
    }

    return (
        <div className="min-h-0 overflow-y-auto">
            <div className="border-b border-border/60 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-foreground">{heading}</h2>
                    {canvasHref ? (
                        <Button asChild variant="outline" size="sm">
                            <a href={canvasHref} target="_blank" rel="noreferrer">
                                <ExternalLink className="size-3.5" />
                                Open Canvas Grades
                            </a>
                        </Button>
                    ) : null}
                </div>
            </div>
            <div className="divide-y divide-border/60">
                {items.map((grade, index) => (
                    <div key={grade.enrollment_id} className="px-5 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="inline-flex size-8 items-center justify-center rounded-xl bg-muted/55 text-muted-foreground">
                                        <ChartColumnIncreasing className="size-4" />
                                    </div>
                                    <h3 className="text-base font-semibold text-foreground">
                                        {index === 0 ? 'Course grade' : `Enrollment ${index + 1}`}
                                    </h3>
                                {grade.current_grading_period_title ? (
                                    <Badge variant="secondary" className="font-normal">
                                        {grade.current_grading_period_title}
                                    </Badge>
                                ) : null}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {[
                                        grade.enrollment_role ?? grade.enrollment_type ?? 'Student enrollment',
                                        formatEnrollmentState(grade.enrollment_state),
                                    ].filter(Boolean).join(' · ')}
                                </p>
                            </div>
                        </div>
                        <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                            <div className="space-y-1">
                                <dt className="text-xs font-medium text-muted-foreground">Current grade</dt>
                                <dd className="text-lg font-semibold text-foreground">{formatGradeLabel(grade.current_grade)}</dd>
                                <dd className="text-sm text-muted-foreground">{formatGradeScore(grade.current_score)}</dd>
                            </div>
                            <div className="space-y-1">
                                <dt className="text-xs font-medium text-muted-foreground">Final grade</dt>
                                <dd className="text-lg font-semibold text-foreground">{formatGradeLabel(grade.final_grade)}</dd>
                                <dd className="text-sm text-muted-foreground">{formatGradeScore(grade.final_score)}</dd>
                            </div>
                            <div className="space-y-1">
                                <dt className="text-xs font-medium text-muted-foreground">Current points</dt>
                                <dd className="text-lg font-semibold text-foreground">{formatGradePoints(grade.current_points)}</dd>
                                <dd className="text-sm text-muted-foreground">Canvas reported points</dd>
                            </div>
                            <div className="space-y-1">
                                <dt className="text-xs font-medium text-muted-foreground">Current period</dt>
                                <dd className="text-lg font-semibold text-foreground">
                                    {formatGradeLabel(grade.current_period_current_grade)}
                                </dd>
                                <dd className="text-sm text-muted-foreground">
                                    {formatGradeScore(grade.current_period_current_score)}
                                </dd>
                            </div>
                            <div className="space-y-1">
                                <dt className="text-xs font-medium text-muted-foreground">Current period final</dt>
                                <dd className="text-lg font-semibold text-foreground">
                                    {formatGradeLabel(grade.current_period_final_grade)}
                                </dd>
                                <dd className="text-sm text-muted-foreground">
                                    {formatGradeScore(grade.current_period_final_score)}
                                </dd>
                            </div>
                        </dl>
                    </div>
                ))}
            </div>
        </div>
    );
};
