// input:  [course gradebook API, widget runtime contracts, shadcn card/progress primitives, and builtin-gradebook shared calculators/formatters]
// output: [builtin-gradebook summary widget component and widget definition]
// pos:    [course-scoped read-only summary widget that derives projections from gradebook fact data]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { AlertCircle, ArrowRight, CalendarClock, Gauge, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import api, { type CourseGradebook } from '@/services/api';
import type { WidgetDefinition, WidgetProps } from '@/services/widgetRegistry';
import {
    BUILTIN_GRADEBOOK_SUMMARY_WIDGET_TYPE,
    BUILTIN_GRADEBOOK_TAB_TYPE,
    OPEN_GRADEBOOK_TAB_EVENT,
    buildComputedGradebookSummary,
    formatGpa,
    formatGradebookDate,
    formatPercent,
    getCategoryBadgeClassName,
    getFeasibilityBadgeClassName,
    getFeasibilityLabel,
} from './shared';

const SummaryValue: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="rounded-2xl border border-border/60 bg-background/85 px-3 py-2.5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
);

const BuiltinGradebookSummaryWidget: React.FC<WidgetProps> = ({ courseId }) => {
    const [gradebook, setGradebook] = React.useState<CourseGradebook | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        if (!courseId) return;
        let cancelled = false;

        setIsLoading(true);
        api.getCourseGradebook(courseId)
            .then((response) => {
                if (cancelled) return;
                setGradebook(response);
            })
            .catch((error) => {
                if (cancelled) return;
                console.error('Failed to load course gradebook summary widget', error);
                setGradebook(null);
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [courseId]);

    if (!courseId) {
        return (
            <Empty className="h-full border-border/70 bg-muted/30">
                <EmptyHeader>
                    <EmptyTitle>Gradebook unavailable</EmptyTitle>
                    <EmptyDescription>This widget requires a course context.</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    if (isLoading) {
        return (
            <div className="space-y-3 p-3">
                <Skeleton className="h-16 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
            </div>
        );
    }

    if (!gradebook) {
        return (
            <Empty className="h-full border-border/70 bg-muted/30">
                <EmptyHeader>
                    <EmptyTitle>Gradebook unavailable</EmptyTitle>
                    <EmptyDescription>Failed to load the latest projection data.</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    const handleOpenGradebook = () => {
        window.dispatchEvent(new CustomEvent(OPEN_GRADEBOOK_TAB_EVENT, {
            detail: { tabType: BUILTIN_GRADEBOOK_TAB_TYPE },
        }));
    };

    const computedSummary = buildComputedGradebookSummary(gradebook);
    const upcomingItems = computedSummary.upcoming_due_items.slice(0, 3);
    const completionProgress = Math.max(0, Math.min(100, 100 - computedSummary.remaining_weight));

    return (
        <div className="flex h-full flex-col gap-3 px-3 pb-3 pt-1">
            <Card size="sm" className="overflow-hidden border-border/70 bg-card shadow-none">
                <div className="bg-linear-to-br from-teal-500/10 via-background to-orange-500/10">
                <CardHeader className="space-y-3 pb-2">
                    <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm font-semibold">Baseline Projection</CardTitle>
                        <Badge
                            variant="outline"
                            className={cn('border px-2 py-0 text-[10px]', getFeasibilityBadgeClassName(computedSummary.feasibility))}
                        >
                            {getFeasibilityLabel(computedSummary.feasibility)}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3 pb-3">
                    <SummaryValue
                        label="Projected"
                        value={computedSummary.baseline_projected_percentage === null
                            ? 'Unavailable'
                            : `${formatPercent(computedSummary.baseline_projected_percentage)} · ${formatGpa(computedSummary.baseline_projected_gpa)} GPA`}
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <SummaryValue
                            label="Required"
                            value={computedSummary.baseline_required_score === null ? 'N/A' : formatPercent(computedSummary.baseline_required_score)}
                        />
                        <SummaryValue
                            label="Remaining"
                            value={formatPercent(computedSummary.remaining_weight)}
                        />
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/85 px-3 py-3">
                        <div className="flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            <span>Coverage</span>
                            <span>{formatPercent(100 - computedSummary.remaining_weight)}</span>
                        </div>
                        <Progress value={completionProgress} className="mt-3 h-2" />
                    </div>
                </CardContent>
                </div>
            </Card>

            <Card size="sm" className="flex-1 border-border/70 bg-card/70 shadow-none">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <CalendarClock className="h-4 w-4 text-muted-foreground" />
                        Upcoming Deadlines
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pb-3">
                    {upcomingItems.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground">
                            No upcoming assessments with due dates yet.
                        </div>
                    ) : upcomingItems.map((item) => (
                        <div key={item.assessment_id} className="rounded-2xl border border-border/60 bg-background/85 px-3 py-2.5">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
                                    <div className="mt-1 text-xs text-muted-foreground">{formatGradebookDate(item.due_date)}</div>
                                </div>
                                {item.category_name ? (
                                    <Badge
                                        variant="outline"
                                        className={cn('border px-2 py-0 text-[10px]', getCategoryBadgeClassName(item.category_color_token))}
                                    >
                                        {item.category_name}
                                    </Badge>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-border/60 bg-background/85 px-3 py-2">
                    <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                        <Target className="h-3.5 w-3.5" />
                        Target
                    </div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                        {computedSummary.baseline_target_mode === 'gpa'
                            ? `${formatGpa(computedSummary.baseline_target_value)} GPA`
                            : formatPercent(computedSummary.baseline_target_value)}
                    </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/85 px-3 py-2">
                    <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                        <Gauge className="h-3.5 w-3.5" />
                        Actual
                    </div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                        {formatPercent(computedSummary.current_actual_percentage)}
                    </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/85 px-3 py-2">
                    <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Issues
                    </div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                        {computedSummary.validation_issues.length}
                    </div>
                </div>
            </div>

            <Button type="button" variant="secondary" className="w-full justify-between" onClick={handleOpenGradebook}>
                <span>Open Gradebook</span>
                <ArrowRight className="h-4 w-4" />
            </Button>
        </div>
    );
};

export const BuiltinGradebookSummaryWidgetDefinition: WidgetDefinition = {
    type: BUILTIN_GRADEBOOK_SUMMARY_WIDGET_TYPE,
    component: BuiltinGradebookSummaryWidget,
};
