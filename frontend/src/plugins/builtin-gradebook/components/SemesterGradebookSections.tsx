import { ArrowRightLeft, FlaskConical, GraduationCap, Percent, Sparkles, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import React from 'react';

import { DataTable, type ColumnDef } from '@/components/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { Course } from '@/services/api';
import { cn } from '@/lib/utils';
import { getCourseBadgeStyle, getCourseCategoryBadgeClassName, resolveCourseColor } from '@/utils/courseCategoryBadge';
import type { parseSubjectColorMap } from '@/utils/courseCategoryBadge';
import {
    BUILTIN_GRADEBOOK_TAB_TYPE,
    formatGradebookGpaPercentage,
    type ComputedSemesterGradebookSummary,
} from '../shared';
import type { SemesterGradebookPlanModeUiState } from '../utils/gradebookTabUtils';
import { getSemesterCourseDisplayName } from '../utils/gradebookTabUtils';

interface SemesterGradebookHeaderStatsProps {
    planMode: boolean;
    displayedPercentage: number | null;
    displayedGpa: number | null;
}

export function SemesterGradebookHeaderStats({
    planMode,
    displayedPercentage,
    displayedGpa,
}: SemesterGradebookHeaderStatsProps) {
    return (
        <section className="mb-2.5">
            <div
                className={cn(
                    'grid select-none rounded-lg border overflow-hidden transition-colors duration-300',
                    planMode
                        ? 'border-amber-300/60 dark:border-amber-500/30'
                        : 'border-border/70',
                )}
                style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
            >
                <div className={cn(
                    'min-w-0 px-3.5 py-2.5 transition-colors duration-300',
                    planMode ? 'bg-amber-50/60 dark:bg-amber-950/25' : '',
                )}>
                    <div className="flex min-w-0 items-center gap-1.5">
                        {planMode
                            ? <FlaskConical className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                            : <Percent className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />}
                        <p className={cn(
                            'truncate text-xs font-medium transition-colors duration-300',
                            planMode ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground/80',
                        )}>
                            {planMode ? 'Grade · What If' : 'Grade'}
                        </p>
                    </div>
                    <div className="mt-0.5 min-w-0 overflow-hidden text-sm font-semibold tracking-tight sm:text-lg">
                        {displayedPercentage === null ? 'N/A' : planMode ? (
                            <span className="text-amber-600 dark:text-amber-400">{formatGradebookGpaPercentage(displayedPercentage)}</span>
                        ) : formatGradebookGpaPercentage(displayedPercentage)}
                    </div>
                </div>
                <div className={cn(
                    'min-w-0 border-l px-3.5 py-2.5 transition-colors duration-300',
                    planMode
                        ? 'border-amber-300/60 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-950/25'
                        : 'border-border/70',
                )}>
                    <div className="flex min-w-0 items-center gap-1.5">
                        {planMode
                            ? <FlaskConical className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                            : <GraduationCap className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />}
                        <p className={cn(
                            'truncate text-xs font-medium transition-colors duration-300',
                            planMode ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground/80',
                        )}>
                            {planMode ? 'GPA · What If' : 'GPA'}
                        </p>
                    </div>
                    <div className="mt-0.5 min-w-0 overflow-hidden text-sm font-semibold tracking-tight sm:text-lg">
                        {displayedGpa === null ? 'N/A' : planMode ? (
                            <span className="text-amber-600 dark:text-amber-400">{displayedGpa.toFixed(2)}</span>
                        ) : displayedGpa.toFixed(2)}
                    </div>
                </div>
            </div>
        </section>
    );
}

interface SemesterGradebookActionBarProps {
    planModeState: SemesterGradebookPlanModeUiState;
    onPlanModeCheckedChange: (checked: boolean) => void;
    onTargetDraftChange: (value: string) => void;
    onToggleTargetInputMode: () => void;
    onAutoFill: () => void;
}

export function SemesterGradebookActionBar({
    planModeState,
    onPlanModeCheckedChange,
    onTargetDraftChange,
    onToggleTargetInputMode,
    onAutoFill,
}: SemesterGradebookActionBarProps) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex h-11 w-full shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-start">
                    <Label htmlFor="semester-gradebook-plan-mode" className="flex items-center gap-2 text-sm font-medium tracking-tight">
                        <Sparkles className={cn('h-4 w-4', planModeState.planMode ? 'text-amber-500 dark:text-amber-400' : 'text-muted-foreground')} />
                        <span>Plan Mode</span>
                    </Label>
                    <Switch
                        id="semester-gradebook-plan-mode"
                        checked={planModeState.planMode}
                        onCheckedChange={onPlanModeCheckedChange}
                        className="data-checked:bg-amber-500 data-unchecked:bg-slate-300/80 dark:data-unchecked:bg-slate-700"
                        aria-label="Toggle Plan Mode"
                    />
                </div>
                {planModeState.planMode ? (
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Target className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
                        <Label htmlFor="semester-gradebook-target" className="shrink-0 text-sm font-medium whitespace-nowrap">
                            Target
                        </Label>
                        <InputGroup className="min-w-0 flex-1 sm:w-32 sm:flex-none">
                            <InputGroupInput
                                id="semester-gradebook-target"
                                aria-label={planModeState.targetInputMode === 'gpa' ? 'Target GPA' : 'Target %'}
                                className="tabular-nums"
                                value={planModeState.targetDraft}
                                inputMode="decimal"
                                placeholder={planModeState.targetInputMode === 'gpa' ? '3.70' : '85.0'}
                                onChange={(event) => onTargetDraftChange(event.target.value)}
                            />
                            <InputGroupAddon align="inline-end">
                                <InputGroupText>{planModeState.targetInputMode === 'gpa' ? 'GPA' : '%'}</InputGroupText>
                            </InputGroupAddon>
                        </InputGroup>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onToggleTargetInputMode}
                            aria-label={planModeState.targetInputMode === 'gpa' ? 'Switch target input to GPA Percentage' : 'Switch target input to GPA'}
                            title={planModeState.targetInputMode === 'gpa' ? 'Switch to GPA Percentage' : 'Switch to GPA'}
                        >
                            <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>{planModeState.targetInputMode === 'gpa' ? 'Use %' : 'Use GPA'}</span>
                        </Button>
                    </div>
                ) : null}
            </div>

            <div className="w-full shrink-0 sm:w-auto">
                <div
                    className={cn(
                        'transition-all duration-200 sm:w-[184px]',
                        planModeState.planMode ? 'opacity-100' : 'pointer-events-none invisible opacity-0',
                    )}
                >
                    <Button
                        type="button"
                        onClick={onAutoFill}
                        disabled={!planModeState.planMode}
                        className="w-full bg-amber-500 text-amber-950 hover:bg-amber-400 disabled:bg-muted disabled:text-muted-foreground"
                    >
                        <Sparkles className="mr-2 h-4 w-4 shrink-0" />
                        <span>Auto-fill</span>
                    </Button>
                </div>
            </div>
        </div>
    );
}

interface UseSemesterCourseColumnsOptions {
    planMode: boolean;
    whatIfDrafts: Record<string, string>;
    subjectColorMap: ReturnType<typeof parseSubjectColorMap>;
    onWhatIfChange: (courseId: string, value: string) => void;
}

export function useSemesterCourseColumns({
    planMode,
    whatIfDrafts,
    subjectColorMap,
    onWhatIfChange,
}: UseSemesterCourseColumnsOptions): ColumnDef<Course>[] {
    return React.useMemo(() => [
        {
            key: 'name',
            label: 'Course',
            fit: 'fill',
            minWidth: 220,
            sortable: (left, right) => getSemesterCourseDisplayName(left).localeCompare(getSemesterCourseDisplayName(right)),
            cellClassName: 'py-3',
            truncateCell: true,
            cell: (course) => (
                <div className="min-w-0">
                    <Link
                        to={`/courses/${course.id}`}
                        state={{ preferredTabType: BUILTIN_GRADEBOOK_TAB_TYPE }}
                        className="block min-w-0 truncate font-medium text-foreground hover:underline"
                        title={course.name}
                    >
                        {course.name}
                    </Link>
                    {course.alias ? (
                        <div className="truncate text-xs text-muted-foreground" title={course.alias}>
                            {course.alias}
                        </div>
                    ) : null}
                </div>
            ),
        },
        {
            key: 'category',
            label: 'Category',
            width: 132,
            sortable: true,
            cellClassName: 'py-3',
            cell: (course) => course.category?.trim() ? (
                <Badge
                    variant="outline"
                    className={cn(
                        'max-w-full select-none truncate border-0 px-2.5 py-0.5 text-xs font-medium',
                        getCourseCategoryBadgeClassName(course.category),
                    )}
                    style={getCourseBadgeStyle(resolveCourseColor(course, subjectColorMap))}
                    title={course.category}
                >
                    {course.category}
                </Badge>
            ) : (
                <span className="text-xs text-muted-foreground/60">None</span>
            ),
        },
        {
            key: 'credits',
            label: 'Credits',
            width: 96,
            align: 'right',
            sortable: true,
            cellClassName: 'py-3',
            cell: (course) => (
                <div className="flex min-h-8 items-center justify-end">
                    <span className="tabular-nums">{Number(course.credits || 0).toFixed(2)}</span>
                </div>
            ),
        },
        {
            key: 'grade_percentage',
            label: planMode ? 'What If' : 'Grade',
            width: 112,
            align: 'right',
            sortable: true,
            cellClassName: 'py-3',
            cell: (course) => (
                <div className="flex min-h-8 items-center justify-end">
                    {planMode && course.include_in_gpa !== false && Number(course.credits) > 0 && Number(course.grade_percentage || 0) === 0 ? (
                        <Input
                            aria-label={`${course.name} what-if grade`}
                            className="ml-auto h-8 w-24 text-right tabular-nums border-amber-400/80 bg-amber-50/80 text-amber-950 focus-visible:bg-background dark:border-amber-500/50 dark:bg-amber-950/20 dark:text-amber-50"
                            value={whatIfDrafts[course.id] ?? ''}
                            inputMode="decimal"
                            placeholder="What if"
                            onChange={(event) => onWhatIfChange(course.id, event.target.value)}
                        />
                    ) : (
                        <span className="tabular-nums">{formatGradebookGpaPercentage(course.grade_percentage)}</span>
                    )}
                </div>
            ),
        },
        {
            key: 'grade_scaled',
            label: 'GPA',
            width: 96,
            align: 'right',
            sortable: true,
            cellClassName: 'py-3',
            cell: (course) => (
                <div className="flex min-h-8 items-center justify-end">
                    <span className="tabular-nums">{Number(course.grade_scaled || 0).toFixed(2)}</span>
                </div>
            ),
        },
    ], [onWhatIfChange, planMode, subjectColorMap, whatIfDrafts]);
}

interface SemesterCoursesTableProps {
    semesterId: string;
    courses: Course[];
    summary: ComputedSemesterGradebookSummary;
    columns: ColumnDef<Course>[];
}

export function SemesterCoursesTable({
    semesterId,
    courses,
    summary,
    columns,
}: SemesterCoursesTableProps) {
    return (
        <div className="min-h-[400px] rounded-md border bg-card flex flex-col overflow-hidden">
            <DataTable
                title="Semester Courses"
                description={`${summary.included_course_count} course${summary.included_course_count === 1 ? '' : 's'} included in GPA · ${summary.included_credits.toFixed(2)} credits`}
                showHeader={false}
                items={courses}
                columns={columns}
                getRowKey={(course) => course.id}
                emptyMessage="No courses assigned."
                sortPersistenceKey={semesterId ? `gradebook-semester-courses:${semesterId}` : undefined}
                minWidthClassName="min-w-[54rem]"
                maxBodyHeight={600}
                freezeHeader
                rootClassName="flex-1 space-y-0"
                shellClassName="rounded-none border-0"
                tableClassName="[&_th]:bg-card [&_td]:bg-card"
            />
        </div>
    );
}
