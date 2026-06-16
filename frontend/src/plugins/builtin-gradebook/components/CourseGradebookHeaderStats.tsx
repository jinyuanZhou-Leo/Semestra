import { FlaskConical, GraduationCap, Percent } from 'lucide-react';

import { AnimatedNumber } from '@/components/AnimatedNumber';
import type { Course } from '@/services/api';
import { cn } from '@/lib/utils';
import type { ComputedGradebookSummary, ComputedPlanModeResult } from '../shared';
import { formatGradebookGpaPercentage } from '../shared';

interface CourseGradebookHeaderStatsProps {
    course: Course;
    summary: ComputedGradebookSummary;
    planMode: boolean;
    whatIfResult: ComputedPlanModeResult | null;
    showWeightMismatchState: boolean;
}

export function CourseGradebookHeaderStats({
    course,
    summary,
    planMode,
    whatIfResult,
    showWeightMismatchState,
}: CourseGradebookHeaderStatsProps) {
    return (
        <section className="mb-2.5">
            <div
                className={cn(
                    'grid select-none rounded-lg border overflow-hidden transition-colors duration-300',
                    showWeightMismatchState
                        ? 'border-rose-300/80 bg-rose-50/40 dark:border-rose-500/40 dark:bg-rose-950/15'
                        : planMode
                          ? 'border-amber-300/60 dark:border-amber-500/30'
                          : 'border-border/70',
                )}
                style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
            >
                <div
                    className={cn(
                        'min-w-0 px-3.5 py-2.5 transition-colors duration-300',
                        showWeightMismatchState
                            ? 'bg-rose-50/80 dark:bg-rose-950/20'
                            : planMode ? 'bg-amber-50/60 dark:bg-amber-950/25' : '',
                    )}
                >
                    <div className="flex min-w-0 items-center gap-1.5">
                        {showWeightMismatchState
                            ? <Percent className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                            : planMode
                              ? <FlaskConical className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                              : <Percent className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />}
                        <p
                            className={cn(
                                'min-w-0 truncate text-xs font-medium transition-colors duration-300',
                                showWeightMismatchState
                                    ? 'text-rose-700 dark:text-rose-300'
                                    : planMode ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground/80',
                            )}
                        >
                            {planMode ? 'Grade · What If' : 'Grade'}
                        </p>
                    </div>
                    <div className="mt-0.5 min-w-0 overflow-hidden text-sm font-semibold tracking-tight sm:text-lg">
                        {showWeightMismatchState ? (
                            <span className="text-rose-600 dark:text-rose-400">N/A</span>
                        ) : (
                            <span className={cn('block max-w-full truncate tabular-nums', planMode ? 'text-amber-600 dark:text-amber-400' : undefined)}>
                                <AnimatedNumber
                                    value={planMode && whatIfResult ? whatIfResult.projected_percentage : summary.effective_percentage ?? course.grade_percentage}
                                    format={formatGradebookGpaPercentage}
                                />
                            </span>
                        )}
                    </div>
                    {showWeightMismatchState ? (
                        <p className="mt-1 truncate text-[11px] text-rose-700/90 dark:text-rose-300/90">
                            Weight {summary.total_weight.toFixed(1)}%. Need 100%.
                        </p>
                    ) : null}
                </div>

                <div
                    className={cn(
                        'min-w-0 border-l px-3.5 py-2.5 transition-colors duration-300',
                        showWeightMismatchState
                            ? 'border-rose-300/80 bg-rose-50/80 dark:border-rose-500/40 dark:bg-rose-950/20'
                            : planMode
                              ? 'border-amber-300/60 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-950/25'
                              : 'border-border/70',
                    )}
                >
                    <div className="flex min-w-0 items-center gap-1.5">
                        {showWeightMismatchState
                            ? <GraduationCap className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                            : planMode
                              ? <FlaskConical className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                              : <GraduationCap className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />}
                        <p
                            className={cn(
                                'min-w-0 truncate text-xs font-medium transition-colors duration-300',
                                showWeightMismatchState
                                    ? 'text-rose-700 dark:text-rose-300'
                                    : planMode ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground/80',
                            )}
                        >
                            {planMode ? 'GPA · What If' : 'GPA'}
                        </p>
                    </div>
                    <div className="mt-0.5 min-w-0 overflow-hidden text-sm font-semibold tracking-tight sm:text-lg">
                        {showWeightMismatchState ? (
                            <span className="text-rose-600 dark:text-rose-400">N/A</span>
                        ) : (
                            <span className={cn('block max-w-full truncate tabular-nums', planMode ? 'text-amber-600 dark:text-amber-400' : undefined)}>
                                <AnimatedNumber
                                    value={planMode && whatIfResult ? whatIfResult.projected_gpa : summary.effective_gpa ?? course.grade_scaled}
                                    format={(v) => v.toFixed(2)}
                                    rainbowThreshold={planMode ? undefined : 3.8}
                                />
                            </span>
                        )}
                    </div>
                    {showWeightMismatchState ? (
                        <p className="mt-1 truncate text-[11px] text-rose-700/90 dark:text-rose-300/90">
                            Set weights to 100%.
                        </p>
                    ) : null}
                </div>
            </div>
        </section>
    );
}
