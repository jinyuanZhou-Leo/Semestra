// input:  [program overview KPI values, visible semesters, unassigned course aggregates, hide_gpa toggle]
// output: [`ProgramStatsSection` overview block with KPI cards and semester GPA/credits charts]
// pos:    [Program Dashboard overview stats and chart presentation layer]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { BookOpen, Eye, EyeOff, GraduationCap, Percent } from 'lucide-react';

import { AppEmptyState } from '@/components/AppEmptyState';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import { Progress } from '@/components/ui/progress';
import { formatGpaPercentageValue } from '@/utils/percentage';

import {
    buildCreditsBySemester,
    buildSemesterGpaSeries,
    CREDITS_CHART_CONFIG,
    GPA_CHART_CONFIG,
    truncateSemesterLabel,
    type SemesterCreditsPoint,
    type StatsSemester,
} from './programDashboardStats';

const CreditsTooltipContent = ({
    active,
    payload,
}: {
    active?: boolean;
    payload?: Array<{ payload?: SemesterCreditsPoint; value?: number }>;
}) => {
    if (!active || !payload?.length) {
        return null;
    }

    const point = payload[0]?.payload;
    const value = payload[0]?.value;

    if (!point || value == null) {
        return null;
    }

    return (
        <div className="grid min-w-32 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
            <div className="font-medium">{point.label}</div>
            <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Credits</span>
                <span className="font-mono font-medium text-foreground tabular-nums">
                    {Number(value).toFixed(1)} · {point.courses} courses
                </span>
            </div>
        </div>
    );
};

export type ProgramStatsSectionProps = {
    cgpaScaled: number;
    cgpaPercentage: number;
    totalCredits: number;
    gradRequirementCredits: number;
    creditsProgressPercent: number;
    hideGpa: boolean;
    programId: string;
    semesters: StatsSemester[];
    unassignedCredits: number;
    unassignedCourseCount: number;
    onToggleHideGpa: () => void;
};

export const ProgramStatsSection: React.FC<ProgramStatsSectionProps> = ({
    cgpaScaled,
    cgpaPercentage,
    totalCredits,
    gradRequirementCredits,
    creditsProgressPercent,
    hideGpa,
    programId,
    semesters,
    unassignedCredits,
    unassignedCourseCount,
    onToggleHideGpa,
}) => {
    const gpaSeries = useMemo(
        () => buildSemesterGpaSeries(semesters, hideGpa),
        [hideGpa, semesters],
    );
    const creditsSeries = useMemo(
        () => buildCreditsBySemester(semesters, unassignedCredits, unassignedCourseCount),
        [semesters, unassignedCredits, unassignedCourseCount],
    );
    const hasSemesters = semesters.length > 0;
    const gpaDomain = useMemo<[number, number]>(() => {
        if (gpaSeries.length === 0) {
            return [0, 4];
        }

        const values = gpaSeries.map((point) => point.gpa);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const padding = 0.25;

        return [
            Math.max(0, min - padding),
            Math.min(4, max + padding),
        ];
    }, [gpaSeries]);

    return (
        <section className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Overview</h2>

            <div className="md:hidden relative rounded-xl border border-border/60 bg-muted/15 px-4 py-3">
                <Button
                    onClick={onToggleHideGpa}
                    variant="ghost"
                    size="sm"
                    className="absolute right-3 top-3 h-5 w-5 p-0"
                    aria-label={hideGpa ? 'Show GPA' : 'Hide GPA'}
                >
                    {hideGpa ? (
                        <EyeOff className="h-3 w-3" />
                    ) : (
                        <Eye className="h-3 w-3" />
                    )}
                </Button>
                <div className="grid grid-cols-3 gap-4">
                    <div className="min-w-0">
                        <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                            <GraduationCap className="h-3 w-3" />
                            <span>GPA</span>
                        </div>
                        <div className="text-lg font-semibold leading-none">
                            {hideGpa ? '****' : (
                                <AnimatedNumber
                                    value={cgpaScaled}
                                    format={(val) => val.toFixed(2)}
                                    animateOnMount
                                    rainbowThreshold={3.8}
                                />
                            )}
                        </div>
                    </div>
                    <div className="min-w-0">
                        <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                            <Percent className="h-3 w-3" />
                            <span>Avg</span>
                        </div>
                        <div className="text-lg font-semibold leading-none">
                            {hideGpa ? '****' : (
                                <>
                                    <AnimatedNumber
                                        value={cgpaPercentage}
                                        format={formatGpaPercentageValue}
                                        animateOnMount
                                    />
                                    <span className="ml-0.5 text-xs font-normal text-muted-foreground">%</span>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="min-w-0">
                        <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                            <BookOpen className="h-3 w-3" />
                            <span>Credits</span>
                        </div>
                        <div className="text-lg font-semibold leading-none">
                            <AnimatedNumber
                                value={totalCredits}
                                format={(val) => val.toFixed(1)}
                                animateOnMount
                            />
                            <span className="mx-0.5 text-xs font-normal text-muted-foreground">/</span>
                            <span className="text-xs font-normal text-muted-foreground">{gradRequirementCredits}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="hidden gap-4 md:grid md:grid-cols-3">
                <Card className="border-border/50 bg-muted/10 shadow-none">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-1.5">
                        <CardTitle className="text-sm font-medium text-muted-foreground">CGPA (Scaled)</CardTitle>
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="flex min-h-12 items-end pt-0">
                        <div className="flex w-full items-end justify-between gap-3">
                            <div className="text-[1.5rem] font-semibold tracking-tight leading-none">
                                {hideGpa ? '****' : (
                                    <AnimatedNumber
                                        value={cgpaScaled}
                                        format={(val) => val.toFixed(2)}
                                        animateOnMount
                                        rainbowThreshold={3.8}
                                    />
                                )}
                            </div>
                            <Button
                                onClick={onToggleHideGpa}
                                variant="ghost"
                                size="sm"
                                className="-mr-1 -mt-1 h-7 w-7 p-0 text-muted-foreground"
                                aria-label={hideGpa ? 'Show GPA' : 'Hide GPA'}
                            >
                                {hideGpa ? (
                                    <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                    <Eye className="h-3.5 w-3.5" />
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/50 bg-muted/10 shadow-none">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-1.5">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Average</CardTitle>
                        <Percent className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="flex min-h-12 items-end pt-0">
                        <div className="text-[1.5rem] font-semibold tracking-tight leading-none">
                            {hideGpa ? '****' : (
                                <>
                                    <AnimatedNumber
                                        value={cgpaPercentage}
                                        format={formatGpaPercentageValue}
                                        animateOnMount
                                    />
                                    <span className="ml-1 text-base font-normal text-muted-foreground">%</span>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/50 bg-muted/10 shadow-none">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-1.5">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Credits progress</CardTitle>
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="flex min-h-12 flex-col justify-end gap-2 pt-0">
                        {gradRequirementCredits > 0 ? (
                            <>
                                <div className="text-[1.5rem] font-semibold tracking-tight leading-none">
                                    <AnimatedNumber
                                        value={totalCredits}
                                        format={(val) => val.toFixed(1)}
                                        animateOnMount
                                    />
                                    <span className="mx-1 text-base font-normal text-muted-foreground">/</span>
                                    <span className="text-base font-normal text-muted-foreground">{gradRequirementCredits}</span>
                                </div>
                                <Progress value={creditsProgressPercent} />
                            </>
                        ) : (
                            <>
                                <div className="text-[1.5rem] font-semibold tracking-tight leading-none">
                                    <AnimatedNumber
                                        value={totalCredits}
                                        format={(val) => val.toFixed(1)}
                                        animateOnMount
                                    />
                                    <span className="ml-1 text-base font-normal text-muted-foreground">credits</span>
                                </div>
                                <Link
                                    to={`/programs/${programId}/settings`}
                                    className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
                                >
                                    Set graduation target →
                                </Link>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
                <Card className="border-border/50 bg-muted/10 shadow-none">
                    <CardHeader className="gap-1 pb-1">
                        <CardTitle className="text-sm font-semibold">Semester GPA trend</CardTitle>
                        <CardDescription className="text-xs">Average scaled GPA across semesters</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {!hasSemesters ? (
                            <AppEmptyState
                                scenario="create"
                                size="widget"
                                title="No semesters yet"
                                description="Create a semester to start tracking GPA trends over time."
                            />
                        ) : hideGpa ? (
                            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 text-center text-xs text-muted-foreground">
                                GPA hidden. Use the eye icon above to show semester trends.
                            </div>
                        ) : (
                            <ChartContainer config={GPA_CHART_CONFIG} className="aspect-auto h-36 w-full overflow-hidden">
                                <AreaChart accessibilityLayer data={gpaSeries} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis
                                        dataKey="label"
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        height={32}
                                        interval="preserveStartEnd"
                                        tick={{ fontSize: 10 }}
                                        tickFormatter={(value) => truncateSemesterLabel(String(value))}
                                    />
                                    <YAxis
                                        width={32}
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={4}
                                        domain={gpaDomain}
                                        tickFormatter={(value) => Number(value).toFixed(1)}
                                    />
                                    <ChartTooltip
                                        content={(
                                            <ChartTooltipContent
                                                formatter={(value) => (
                                                    <span className="font-mono font-medium tabular-nums">
                                                        {typeof value === 'number' ? value.toFixed(2) : value}
                                                    </span>
                                                )}
                                            />
                                        )}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="gpa"
                                        stroke="var(--color-gpa)"
                                        fill="var(--color-gpa)"
                                        fillOpacity={0.2}
                                        strokeWidth={1.5}
                                        dot={{ r: 2.5, fill: 'var(--color-gpa)' }}
                                    />
                                </AreaChart>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-border/50 bg-muted/10 shadow-none">
                    <CardHeader className="gap-1 pb-1">
                        <CardTitle className="text-sm font-semibold">Credits by semester</CardTitle>
                        <CardDescription className="text-xs">Total credits earned in each semester</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {!hasSemesters && unassignedCourseCount === 0 ? (
                            <AppEmptyState
                                scenario="create"
                                size="widget"
                                title="No credit data yet"
                                description="Add courses to semesters to see how credits are distributed."
                            />
                        ) : (
                            <ChartContainer config={CREDITS_CHART_CONFIG} className="aspect-auto h-36 w-full overflow-hidden">
                                <BarChart accessibilityLayer data={creditsSeries} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis
                                        dataKey="label"
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        height={32}
                                        interval="preserveStartEnd"
                                        tick={{ fontSize: 10 }}
                                        tickFormatter={(value) => truncateSemesterLabel(String(value))}
                                    />
                                    <YAxis
                                        width={32}
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={4}
                                        allowDecimals
                                    />
                                    <ChartTooltip content={<CreditsTooltipContent />} />
                                    <Bar
                                        dataKey="credits"
                                        fill="var(--color-credits)"
                                        radius={4}
                                    />
                                </BarChart>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>
            </div>
        </section>
    );
};
