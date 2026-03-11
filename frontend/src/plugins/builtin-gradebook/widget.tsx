// input:  [course gradebook API, widget runtime contracts, and rebuilt builtin-gradebook summary helpers]
// output: [builtin-gradebook summary widget component and widget definition]
// pos:    [course-scoped read-only summary widget for current results, forecast readiness, and upcoming deadlines]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { ArrowRight, CalendarClock, Gauge, Sparkles, Target } from 'lucide-react';

import api, { type CourseGradebook } from '@/services/api';
import type { WidgetDefinition, WidgetProps } from '@/services/widgetRegistry';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
    BUILTIN_GRADEBOOK_SUMMARY_WIDGET_TYPE,
    BUILTIN_GRADEBOOK_TAB_TYPE,
    OPEN_GRADEBOOK_TAB_EVENT,
    buildComputedGradebookSummary,
    formatGpa,
    formatGradebookDate,
    formatPercent,
    getCategoryBadgeClassName,
    getCategoryBadgeStyle,
} from './shared';

const SummaryTile: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
    <div className="rounded-2xl border border-border/60 bg-background/85 px-3 py-2.5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
        {hint ? <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div> : null}
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
                if (!cancelled) {
                    setGradebook(response);
                }
            })
            .catch((error) => {
                if (!cancelled) {
                    console.error('Failed to load course gradebook summary widget', error);
                    setGradebook(null);
                }
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
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
            </div>
        );
    }

    if (!gradebook) {
        return (
            <Empty className="h-full border-border/70 bg-muted/30">
                <EmptyHeader>
                    <EmptyTitle>Gradebook unavailable</EmptyTitle>
                    <EmptyDescription>Failed to load the latest gradebook summary.</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    const summary = buildComputedGradebookSummary(gradebook);
    const nextDueItems = summary.upcoming_due_items.slice(0, 3);

    return (
        <div className="flex h-full flex-col gap-3 px-3 pb-3 pt-1">
            <Card size="sm" className="overflow-hidden border-border/70 bg-card shadow-none">
                <div className="bg-linear-to-br from-teal-500/10 via-background to-orange-500/10">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                            <CardTitle className="text-sm font-semibold">Gradebook Snapshot</CardTitle>
                            <Badge variant="outline" className={cn('border px-2 py-0 text-[10px]')}>
                                {summary.forecast_percentage === null ? 'History Pending' : 'Forecast Ready'}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-2 pb-3">
                        <SummaryTile
                            label="Current"
                            value={`${formatPercent(summary.current_real_percentage)} · ${formatGpa(summary.current_real_gpa)} GPA`}
                            hint={`${summary.graded_count} graded`}
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <SummaryTile
                                label="Forecast"
                                value={summary.forecast_percentage === null
                                    ? 'Awaiting history'
                                    : `${formatPercent(summary.forecast_percentage)} · ${formatGpa(summary.forecast_gpa)} GPA`}
                                hint={summary.forecast_percentage === null
                                    ? `${summary.missing_history_categories.length} categories missing history`
                                    : 'Category mean estimate'}
                            />
                            <SummaryTile
                                label="Need Avg"
                                value={summary.minimum_required_average === null ? 'N/A' : formatPercent(summary.minimum_required_average)}
                                hint={`${formatGpa(summary.target_gpa)} GPA target`}
                            />
                        </div>
                    </CardContent>
                </div>
            </Card>

            <Card size="sm" className="flex-1 border-border/70 bg-card/70 shadow-none">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <CalendarClock className="h-4 w-4 text-muted-foreground" />
                        Next Due
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pb-3">
                    {nextDueItems.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground">
                            No upcoming assessments with due dates yet.
                        </div>
                    ) : nextDueItems.map((item) => (
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
                                        style={getCategoryBadgeStyle(item.category_color_token)}
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
                        <Gauge className="h-3.5 w-3.5" />
                        Current
                    </div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{formatPercent(summary.current_real_percentage)}</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/85 px-3 py-2">
                    <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                        <Target className="h-3.5 w-3.5" />
                        Target
                    </div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{formatGpa(summary.target_gpa)} GPA</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/85 px-3 py-2">
                    <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5" />
                        Need
                    </div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                        {summary.minimum_required_average === null ? 'N/A' : formatPercent(summary.minimum_required_average)}
                    </div>
                </div>
            </div>

            <Button
                type="button"
                variant="outline"
                className="mt-auto"
                onClick={() => {
                    window.dispatchEvent(new CustomEvent(OPEN_GRADEBOOK_TAB_EVENT, {
                        detail: { tabType: BUILTIN_GRADEBOOK_TAB_TYPE },
                    }));
                }}
            >
                Open Gradebook
                <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
        </div>
    );
};

export const BuiltinGradebookSummaryWidgetDefinition: WidgetDefinition = {
    type: BUILTIN_GRADEBOOK_SUMMARY_WIDGET_TYPE,
    component: BuiltinGradebookSummaryWidget,
};
