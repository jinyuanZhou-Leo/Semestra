// input:  [course gradebook APIs, course data update context, shared animated stat-strip UI, shadcn UI primitives, switch/dialog primitives, and builtin-gradebook shared forecast/plan helpers]
// output: [course-scoped builtin-gradebook tab component with course-list-style assessment management UI and tab definition]
// pos:    [course-scoped gradebook surface for assessment scores, moved course stat strip, and a mode-aware plan workflow with stable toolbar layout and temporary what-if editing]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { ArrowDown, ArrowUp, ArrowUpDown, BookOpen, CalendarDays, GraduationCap, Pencil, Percent, Plus, Search, Sparkles, Target, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import api, {
    type CourseGradebook,
    type GradebookAssessment,
    type GradebookAssessmentCategory,
} from '@/services/api';
import type { TabDefinition, TabProps } from '@/services/tabRegistry';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { WorkspaceOverviewStats } from '@/components/WorkspaceOverviewStats';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useCourseData } from '@/contexts/CourseDataContext';
import {
    BUILTIN_GRADEBOOK_TAB_TYPE,
    buildComputedGradebookSummary,
    buildPlanModeResult,
    buildSuggestedWhatIfScores,
    formatGpa,
    formatGradebookDate,
    formatGradebookDateInput,
    formatPercent,
    getApiErrorMessage,
    getCategoryBadgeClassName,
    getCategoryBadgeStyle,
    getCategoryById,
    getRelativeDueText,
    isAssessmentOverdue,
    resolveTargetPercentageForGpa,
    sortAssessments,
    type GradebookSortDirection,
    type GradebookSortKey,
} from './shared';

type AssessmentDraft = {
    id: string | null;
    title: string;
    category_id: string | null;
    due_date: string;
    weight: string;
    score: string;
};

const DEFAULT_SORT_KEY: GradebookSortKey = 'due_date';
const DEFAULT_SORT_DIRECTION: GradebookSortDirection = 'none';

const parseOptionalNumber = (value: string): number | null => {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const parseDraftDate = (value: string): Date | undefined => {
    if (!value) return undefined;
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : undefined;
};

const createAssessmentDraft = (
    gradebook: CourseGradebook,
    assessment?: GradebookAssessment | null,
): AssessmentDraft => ({
    id: assessment?.id ?? null,
    title: assessment?.title ?? '',
    category_id: assessment?.category_id ?? gradebook.categories.find((category) => !category.is_archived)?.id ?? null,
    due_date: formatGradebookDateInput(assessment?.due_date),
    weight: assessment ? String(assessment.weight) : '',
    score: assessment?.score === null || assessment?.score === undefined ? '' : String(assessment.score),
});

const StatCard: React.FC<{
    label: string;
    value: string;
    hint?: string;
}> = ({ label, value, hint }) => (
    <div className="rounded-md border border-border/60 bg-background/85 px-4 py-3">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 text-xl font-semibold tracking-tight text-foreground">{value}</div>
        {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
);

const SortableHead: React.FC<{
    label: string;
    sortKey: GradebookSortKey;
    currentSortKey: GradebookSortKey;
    currentDirection: GradebookSortDirection;
    onRequestSort: (sortKey: GradebookSortKey) => void;
    align?: 'left' | 'right';
}> = ({ label, sortKey, currentSortKey, currentDirection, onRequestSort, align = 'left' }) => {
    const isActive = currentSortKey === sortKey;
    const icon = isActive
        ? currentDirection === 'asc'
            ? <ArrowUp className="ml-2 h-4 w-4 text-foreground" />
            : currentDirection === 'desc'
                ? <ArrowDown className="ml-2 h-4 w-4 text-foreground" />
                : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />
        : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;

    return (
        <TableHead
            className={cn(
                'cursor-pointer transition-colors hover:bg-muted/50',
                align === 'right' ? 'text-right' : '',
            )}
            onClick={() => onRequestSort(sortKey)}
        >
            <div className={cn('flex items-center', align === 'right' ? 'justify-end' : '')}>
                <span>{label}</span>
                {icon}
            </div>
        </TableHead>
    );
};

const AssessmentDialog: React.FC<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
    draft: AssessmentDraft;
    onDraftChange: React.Dispatch<React.SetStateAction<AssessmentDraft | null>>;
    categories: GradebookAssessmentCategory[];
    isSaving: boolean;
    onSave: () => Promise<void>;
}> = ({ open, onOpenChange, draft, onDraftChange, categories, isSaving, onSave }) => {
    const setField = <K extends keyof AssessmentDraft>(field: K, value: AssessmentDraft[K]) => {
        onDraftChange((current) => current ? { ...current, [field]: value } : current);
    };
    const dueDate = parseDraftDate(draft.due_date);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
                <DialogHeader>
                    <DialogTitle>{draft.id ? 'Edit Assessment' : 'Add Assessment'}</DialogTitle>
                </DialogHeader>

                <div className="space-y-5">
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-foreground">Details</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="space-y-2 sm:col-span-2">
                                <span className="text-sm font-medium text-foreground">Title</span>
                                <Input value={draft.title} onChange={(event) => setField('title', event.target.value)} placeholder="Final exam" />
                            </label>
                            <label className="space-y-2">
                                <span className="text-sm font-medium text-foreground">Category</span>
                                <Select value={draft.category_id ?? 'none'} onValueChange={(value) => setField('category_id', value === 'none' ? null : value)}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select a category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Uncategorized</SelectItem>
                                        {categories.filter((category) => !category.is_archived).map((category) => (
                                            <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </label>
                            <label className="space-y-2">
                                <span className="text-sm font-medium text-foreground">Due date</span>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className={cn(
                                                'w-full justify-start overflow-hidden text-left font-normal',
                                                !dueDate && 'text-muted-foreground',
                                            )}
                                        >
                                            <CalendarDays className="mr-2 h-4 w-4" />
                                            <span className="truncate">
                                                {dueDate ? format(dueDate, 'MMM d, yyyy') : 'Pick a date'}
                                            </span>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            autoFocus
                                            mode="single"
                                            selected={dueDate}
                                            onSelect={(date) => setField('due_date', date ? format(date, 'yyyy-MM-dd') : '')}
                                        />
                                        {dueDate ? (
                                            <div className="flex justify-end border-t px-3 py-2">
                                                <Button type="button" variant="ghost" size="sm" onClick={() => setField('due_date', '')}>
                                                    Clear
                                                </Button>
                                            </div>
                                        ) : null}
                                    </PopoverContent>
                                </Popover>
                            </label>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-foreground">Grading</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="space-y-2">
                                <span className="text-sm font-medium text-foreground">Weight (%)</span>
                                <Input value={draft.weight} inputMode="decimal" onChange={(event) => setField('weight', event.target.value)} placeholder="20" />
                            </label>
                            <label className="space-y-2">
                                <span className="text-sm font-medium text-foreground">Score (%)</span>
                                <Input value={draft.score} inputMode="decimal" onChange={(event) => setField('score', event.target.value)} placeholder="Optional" />
                            </label>
                        </div>
                    </div>
                </div>

                <DialogFooter className="w-full">
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="button" onClick={() => void onSave()} disabled={isSaving}>
                            {draft.id ? 'Save Changes' : 'Add Assessment'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const BuiltinGradebookTab: React.FC<TabProps> = ({ courseId }) => {
    const { course, updateCourse } = useCourseData();
    const [gradebook, setGradebook] = React.useState<CourseGradebook | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
    const [isMutating, setIsMutating] = React.useState(false);
    const [assessmentDraft, setAssessmentDraft] = React.useState<AssessmentDraft | null>(null);
    const [assessmentDialogOpen, setAssessmentDialogOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [sortKey, setSortKey] = React.useState<GradebookSortKey>(DEFAULT_SORT_KEY);
    const [sortDirection, setSortDirection] = React.useState<GradebookSortDirection>(DEFAULT_SORT_DIRECTION);
    const [scoreDrafts, setScoreDrafts] = React.useState<Record<string, string>>({});
    const [planMode, setPlanMode] = React.useState(false);
    const [planModeIntroOpen, setPlanModeIntroOpen] = React.useState(false);
    const [planModeExitOpen, setPlanModeExitOpen] = React.useState(false);
    const [targetGpaDraft, setTargetGpaDraft] = React.useState('');
    const [whatIfDrafts, setWhatIfDrafts] = React.useState<Record<string, string>>({});
    const deferredSearchQuery = React.useDeferredValue(searchQuery);

    const loadGradebook = React.useCallback(async () => {
        if (!courseId) return;
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const response = await api.getCourseGradebook(courseId);
            setGradebook(response);
        } catch (error) {
            console.error('Failed to load gradebook tab', error);
            setErrorMessage('Failed to load the course gradebook.');
        } finally {
            setIsLoading(false);
        }
    }, [courseId]);

    React.useEffect(() => {
        void loadGradebook();
    }, [loadGradebook]);

    React.useEffect(() => {
        if (!gradebook) return;
        setTargetGpaDraft(String(gradebook.target_gpa));
        setScoreDrafts(Object.fromEntries(
            gradebook.assessments.map((assessment) => [
                assessment.id,
                assessment.score === null || assessment.score === undefined ? '' : String(assessment.score),
            ]),
        ));
    }, [gradebook]);

    const commitGradebook = React.useCallback(async (promise: Promise<CourseGradebook>) => {
        setIsMutating(true);
        try {
            const response = await promise;
            setGradebook(response);
            const nextSummary = buildComputedGradebookSummary(response);
            updateCourse({
                grade_percentage: nextSummary.current_real_percentage,
                grade_scaled: nextSummary.current_real_gpa,
            });
        } catch (error: unknown) {
            console.error('Failed to update gradebook', error);
            toast.error(getApiErrorMessage(error));
        } finally {
            setIsMutating(false);
        }
    }, [updateCourse]);

    const categoriesById = React.useMemo(
        () => new Map((gradebook?.categories ?? []).map((category) => [category.id, category])),
        [gradebook?.categories],
    );
    const summary = React.useMemo(
        () => (gradebook ? buildComputedGradebookSummary(gradebook) : null),
        [gradebook],
    );

    const parsedWhatIfScores = React.useMemo(
        () => Object.fromEntries(
            Object.entries(whatIfDrafts)
                .map(([assessmentId, value]) => [assessmentId, parseOptionalNumber(value)])
                .filter((entry): entry is [string, number] => entry[1] !== null),
        ),
        [whatIfDrafts],
    );
    const planResult = React.useMemo(() => {
        if (!gradebook || !planMode || Object.keys(parsedWhatIfScores).length === 0) return null;
        const parsed = Number(targetGpaDraft);
        if (!Number.isFinite(parsed)) return null;
        return buildPlanModeResult(gradebook, parsed, parsedWhatIfScores);
    }, [gradebook, parsedWhatIfScores, planMode, targetGpaDraft]);

    const filteredAssessments = React.useMemo(() => {
        if (!gradebook) return [];
        const normalizedQuery = deferredSearchQuery.trim().toLowerCase();
        const filtered = gradebook.assessments.filter((assessment) => {
            const categoryName = categoriesById.get(assessment.category_id ?? '')?.name.toLowerCase() ?? '';
            return !normalizedQuery
                || assessment.title.toLowerCase().includes(normalizedQuery)
                || categoryName.includes(normalizedQuery);
        });
        return sortAssessments(filtered, categoriesById, sortKey, sortDirection);
    }, [categoriesById, deferredSearchQuery, gradebook, sortDirection, sortKey]);

    const requestSort = React.useCallback((nextSortKey: GradebookSortKey) => {
        if (sortKey === nextSortKey) {
            setSortDirection((current) => current === 'none' ? 'asc' : current === 'asc' ? 'desc' : 'none');
            return;
        }
        setSortKey(nextSortKey);
        setSortDirection('asc');
    }, [sortKey]);

    const enterPlanMode = React.useCallback(() => {
        setPlanMode(true);
        setPlanModeIntroOpen(false);
    }, []);

    const exitPlanMode = React.useCallback(() => {
        setPlanMode(false);
        setWhatIfDrafts({});
        setPlanModeExitOpen(false);
    }, []);

    const handlePlanModeCheckedChange = React.useCallback((checked: boolean) => {
        if (checked) {
            setPlanModeIntroOpen(true);
            return;
        }
        setPlanModeExitOpen(true);
    }, []);

    const handleSaveAssessment = async () => {
        if (!courseId || !assessmentDraft) return;
        const payload = {
            category_id: assessmentDraft.category_id,
            title: assessmentDraft.title.trim(),
            due_date: assessmentDraft.due_date || null,
            weight: Number(assessmentDraft.weight) || 0,
            score: parseOptionalNumber(assessmentDraft.score),
        };

        if (!payload.title) {
            toast.error('Assessment title is required.');
            return;
        }

        if (assessmentDraft.id) {
            await commitGradebook(api.updateCourseGradebookAssessment(courseId, assessmentDraft.id, payload));
        } else {
            await commitGradebook(api.createCourseGradebookAssessment(courseId, payload));
        }

        setAssessmentDialogOpen(false);
        setAssessmentDraft(null);
    };

    const handlePersistTargetGpa = React.useCallback(async () => {
        if (!courseId || !gradebook) return;
        const parsed = Number(targetGpaDraft);
        if (!Number.isFinite(parsed)) {
            toast.error('Enter a valid GPA target.');
            setTargetGpaDraft(String(gradebook.target_gpa));
            return;
        }
        if (parsed === gradebook.target_gpa) return;
        await commitGradebook(api.updateCourseGradebookPreferences(courseId, { target_gpa: parsed }));
    }, [commitGradebook, courseId, gradebook, targetGpaDraft]);

    const handleRunPlan = React.useCallback(async () => {
        if (!gradebook) return;
        const parsed = Number(targetGpaDraft);
        if (!Number.isFinite(parsed)) {
            toast.error('Enter a valid GPA target before running the plan.');
            return;
        }
        const suggestions = buildSuggestedWhatIfScores(gradebook, parsed);
        setWhatIfDrafts(Object.fromEntries(
            Object.entries(suggestions).map(([assessmentId, score]) => [assessmentId, String(score)]),
        ));
        await handlePersistTargetGpa();
    }, [gradebook, handlePersistTargetGpa, targetGpaDraft]);

    const handleSaveScore = React.useCallback(async (assessment: GradebookAssessment) => {
        if (!courseId || planMode) return;
        const nextValue = parseOptionalNumber(scoreDrafts[assessment.id] ?? '');
        if (nextValue === assessment.score) return;
        await commitGradebook(api.updateCourseGradebookAssessment(courseId, assessment.id, {
            score: nextValue,
        }));
    }, [commitGradebook, courseId, planMode, scoreDrafts]);

    if (!courseId) {
        return (
            <Empty className="bg-muted/40">
                <EmptyHeader>
                    <EmptyTitle>Gradebook unavailable</EmptyTitle>
                    <EmptyDescription>This tab requires a course context.</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-44 w-full rounded-2xl" />
                <Skeleton className="h-[520px] w-full rounded-2xl" />
            </div>
        );
    }

    if (!gradebook || errorMessage || !summary) {
        return (
            <Empty className="border-border/70 bg-muted/40">
                <EmptyHeader>
                    <EmptyTitle>Gradebook failed to load</EmptyTitle>
                    <EmptyDescription>{errorMessage ?? 'Unknown error.'}</EmptyDescription>
                </EmptyHeader>
                <div className="px-6 pb-6">
                    <Button type="button" onClick={() => void loadGradebook()}>Retry</Button>
                </div>
            </Empty>
        );
    }

    const targetPercentage = resolveTargetPercentageForGpa(Number(targetGpaDraft), gradebook.scaling_table);
    const hasActiveAssessmentFilters = deferredSearchQuery.trim().length > 0;
    const canManageAssessments = !planMode;
    const showTargetControl = planMode;
    const showPlanGeneration = planMode;
    const showAddAssessment = !planMode;
    const planModeSwitchLabel = 'Plan Mode';
    const toolbarSecondarySlotClassName = 'flex h-11 w-[156px] items-center';
    const toolbarPrimarySlotClassName = 'flex h-11 w-[210px] items-center justify-end';

    return (
        <div className="space-y-4">
            {course ? (
                <WorkspaceOverviewStats
                    items={[
                        {
                            label: 'Credits',
                            icon: <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />,
                            value: (
                                <span className={cn(course.credits === 0 && 'text-destructive')}>
                                    <AnimatedNumber
                                        value={course.credits}
                                        format={(value) => value.toFixed(2)}
                                    />
                                </span>
                            ),
                        },
                        {
                            label: 'Grade',
                            icon: <Percent className="h-3.5 w-3.5" aria-hidden="true" />,
                            value: course.hide_gpa ? '****' : (
                                <AnimatedNumber
                                    value={course.grade_percentage}
                                    format={(value) => `${value.toFixed(1)}%`}
                                />
                            ),
                        },
                        {
                            label: 'GPA (Scaled)',
                            icon: <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />,
                            value: course.hide_gpa ? '****' : (
                                <AnimatedNumber
                                    value={course.grade_scaled}
                                    format={(value) => value.toFixed(2)}
                                    rainbowThreshold={3.8}
                                />
                            ),
                        },
                    ]}
                />
            ) : null}

            <Card className="border-border/60 bg-card shadow-none">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <CardTitle className="text-lg font-semibold">Course Gradebook</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Keep one assessment table with saved scores, then switch into Plan Mode for temporary What If scenarios.
                        </p>
                    </div>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Current"
                        value={`${formatPercent(summary.current_real_percentage)} · ${formatGpa(summary.current_real_gpa)} GPA`}
                        hint={`${summary.graded_count} graded`}
                    />
                    <StatCard
                        label="Forecast"
                        value={summary.forecast_percentage === null
                            ? 'Unavailable'
                            : `${formatPercent(summary.forecast_percentage)} · ${formatGpa(summary.forecast_gpa)} GPA`}
                        hint={summary.forecast_percentage === null
                            ? gradebook.forecast_model === 'simple_minimum_needed'
                                ? 'Simple mode skips statistical forecasting.'
                                : summary.missing_history_categories.length > 0
                                    ? 'Need at least one graded sample for each remaining category.'
                                    : 'No forecast yet.'
                            : 'Projected from category history'}
                    />
                    <StatCard
                        label="Remaining Weight"
                        value={formatPercent(summary.remaining_weight)}
                        hint={`${summary.ungraded_count} assessments pending`}
                    />
                    <StatCard
                        label={planMode ? 'Plan Target' : 'Next Due'}
                        value={planMode
                            ? targetPercentage === null
                                ? 'Unavailable'
                                : `${formatPercent(targetPercentage)} threshold`
                            : summary.upcoming_due_items[0]
                                ? summary.upcoming_due_items[0].title
                                : 'No due date'}
                        hint={planMode
                            ? `${formatGpa(Number(targetGpaDraft) || gradebook.target_gpa)} GPA target`
                            : summary.upcoming_due_items[0]?.due_date
                                ? formatGradebookDate(summary.upcoming_due_items[0].due_date)
                                : 'Nothing scheduled'}
                    />
                </CardContent>
            </Card>

            {summary.missing_history_categories.length > 0 && gradebook.forecast_model === 'auto' ? (
                <Alert className="border-amber-200/60 bg-amber-50/70 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                    <AlertDescription>
                        Forecast is blank because some remaining categories have no released scores yet.
                    </AlertDescription>
                </Alert>
            ) : null}

            {planMode && planResult ? (
                <Card className="border-border/60 bg-card shadow-none">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Plan Result</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-3">
                        <StatCard
                            label="Projected"
                            value={`${formatPercent(planResult.projected_percentage)} · ${formatGpa(planResult.projected_gpa)} GPA`}
                            hint={planResult.is_feasible ? 'You can still tune any What If value.' : 'Target is not reachable with the remaining weight.'}
                        />
                        <StatCard
                            label="Needed Avg"
                            value={formatPercent(planResult.required_average)}
                            hint={gradebook.forecast_model === 'simple_minimum_needed' ? 'Simple minimum-needed mode' : 'Likelihood-weighted recommendation'}
                        />
                        <StatCard
                            label="Target"
                            value={planResult.target_percentage === null ? 'Unavailable' : formatPercent(planResult.target_percentage)}
                            hint={`${formatGpa(planResult.target_gpa)} GPA threshold`}
                        />
                    </CardContent>
                </Card>
            ) : null}

            <section className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <h2 className="text-lg font-semibold tracking-tight">Assessments</h2>
                    <div className="hidden items-center gap-2 text-xs text-muted-foreground tabular-nums md:flex">
                        <span>{hasActiveAssessmentFilters ? `${filteredAssessments.length} shown` : `${gradebook.assessments.length} total`}</span>
                        <span aria-hidden="true">·</span>
                        <span>{summary.graded_count} graded</span>
                        <span aria-hidden="true">·</span>
                        <span>{summary.ungraded_count} ungraded</span>
                    </div>
                </div>

                <div className="rounded-md border border-border/70 bg-muted/[0.28] p-3 sm:p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="relative w-full max-w-xl min-w-0">
                            <Search className={cn(
                                'pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2',
                                planMode ? 'text-amber-600/80 dark:text-amber-300/80' : 'text-muted-foreground',
                            )} />
                            <Input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search assessments..."
                                className={cn(
                                    'h-11 w-full rounded-md border-border/60 bg-background pl-9 pr-10',
                                    planMode && 'border-amber-300/70 bg-amber-50/70 dark:border-amber-500/40 dark:bg-amber-950/20',
                                )}
                            />
                            {searchQuery ? (
                                <button
                                    type="button"
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                                    onClick={() => setSearchQuery('')}
                                    aria-label="Clear assessment search"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            ) : null}
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-3 lg:flex-nowrap">
                            <div className={cn(
                                'flex h-11 items-center gap-3 rounded-md border px-3',
                                planMode ? 'border-amber-400/70 bg-amber-100/70 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-50' : 'border-border/60 bg-background/80',
                            )}>
                                <div className="flex items-center gap-2 text-sm font-medium tracking-tight">
                                    <Sparkles className={cn('h-4 w-4', planMode ? 'text-amber-600 dark:text-amber-300' : 'text-muted-foreground')} />
                                    <span>{planModeSwitchLabel}</span>
                                </div>
                                <Switch
                                    checked={planMode}
                                    onCheckedChange={handlePlanModeCheckedChange}
                                    disabled={isMutating}
                                    className="data-checked:bg-amber-500 data-unchecked:bg-slate-300/80 dark:data-unchecked:bg-slate-700"
                                    aria-label="Toggle Plan Mode"
                                />
                            </div>

                            <div className={toolbarSecondarySlotClassName}>
                                {showTargetControl ? (
                                    <div className="flex h-11 w-full items-center gap-2 rounded-md border border-amber-300/70 bg-amber-50/70 px-3 dark:border-amber-500/40 dark:bg-amber-950/20">
                                        <Target className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                                        <Label htmlFor="gradebook-target-gpa" className="text-xs font-medium text-muted-foreground">Target</Label>
                                        <Input
                                            id="gradebook-target-gpa"
                                            className="h-8 w-20 border-0 bg-transparent px-0 text-right tabular-nums shadow-none focus-visible:ring-0"
                                            value={targetGpaDraft}
                                            inputMode="decimal"
                                            onChange={(event) => setTargetGpaDraft(event.target.value)}
                                            onBlur={() => void handlePersistTargetGpa()}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    void handlePersistTargetGpa();
                                                }
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div aria-hidden="true" className="h-11 w-full rounded-md border border-transparent" />
                                )}
                            </div>

                            <div className={toolbarPrimarySlotClassName}>
                                {showAddAssessment ? (
                                    <Button
                                        type="button"
                                        disabled={isMutating}
                                        className="h-11 w-full rounded-md"
                                        onClick={() => {
                                            setAssessmentDraft(createAssessmentDraft(gradebook));
                                            setAssessmentDialogOpen(true);
                                        }}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Assessment
                                    </Button>
                                ) : null}

                                {showPlanGeneration ? (
                                    <Button
                                        type="button"
                                        onClick={() => void handleRunPlan()}
                                        disabled={isMutating}
                                        className="h-11 w-full rounded-md bg-amber-500 text-amber-950 hover:bg-amber-400 disabled:bg-muted disabled:text-muted-foreground"
                                    >
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        Generate What If Scores
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="min-h-[300px] rounded-md border bg-card flex flex-col overflow-hidden">
                    {filteredAssessments.length === 0 ? (
                        <Empty className="min-h-[300px] border-0 rounded-md">
                            <EmptyHeader>
                                <EmptyTitle>{hasActiveAssessmentFilters ? 'No assessments found' : 'No assessments added yet'}</EmptyTitle>
                                <EmptyDescription>
                                    {hasActiveAssessmentFilters
                                        ? 'Try clearing the search to see more assessments.'
                                        : 'Add your first assessment to start tracking this course.'}
                                </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent className="sm:flex-row sm:justify-center">
                                {hasActiveAssessmentFilters ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setSearchQuery('')}
                                    >
                                        Clear Search
                                    </Button>
                                ) : null}
                                {showAddAssessment ? (
                                    <Button
                                        type="button"
                                        disabled={isMutating}
                                        onClick={() => {
                                            setAssessmentDraft(createAssessmentDraft(gradebook));
                                            setAssessmentDialogOpen(true);
                                        }}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Assessment
                                    </Button>
                                ) : null}
                            </EmptyContent>
                        </Empty>
                    ) : (
                        <Table>
                            <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <SortableHead label="Assessment" sortKey="title" currentSortKey={sortKey} currentDirection={sortDirection} onRequestSort={requestSort} />
                                        <SortableHead label="Category" sortKey="category" currentSortKey={sortKey} currentDirection={sortDirection} onRequestSort={requestSort} />
                                        <SortableHead label="Due" sortKey="due_date" currentSortKey={sortKey} currentDirection={sortDirection} onRequestSort={requestSort} />
                                        <SortableHead label="Weight" sortKey="weight" currentSortKey={sortKey} currentDirection={sortDirection} onRequestSort={requestSort} align="right" />
                                        <SortableHead label={planMode ? 'What If' : 'Score'} sortKey="score" currentSortKey={sortKey} currentDirection={sortDirection} onRequestSort={requestSort} align="right" />
                                        <TableHead className="text-right">
                                            <div className="flex items-center justify-end">Actions</div>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAssessments.map((assessment) => {
                                        const category = getCategoryById(gradebook.categories, assessment.category_id);
                                    const overdue = isAssessmentOverdue(assessment);
                                    const isRealOnly = assessment.score !== null;
                                    return (
                                        <TableRow key={assessment.id} className="group">
                                            <TableCell className="py-3">
                                                <div className="font-medium text-foreground">{assessment.title}</div>
                                            </TableCell>
                                            <TableCell className="py-3">
                                                {category ? (
                                                    <Badge
                                                        variant="outline"
                                                        className={cn('border-0 px-2.5 py-0.5 text-xs font-medium', getCategoryBadgeClassName(category.color_token))}
                                                        style={getCategoryBadgeStyle(category.color_token)}
                                                    >
                                                        {category.name}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground/60">Uncategorized</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-3">
                                                {assessment.due_date ? (
                                                    <div className="space-y-0.5">
                                                        <div className={cn('text-sm', overdue ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-foreground')}>
                                                            {formatGradebookDate(assessment.due_date)}
                                                        </div>
                                                        <div className="text-[11px] text-muted-foreground">{getRelativeDueText(assessment.due_date)}</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground/60">No due date</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-3 text-right tabular-nums">{formatPercent(assessment.weight)}</TableCell>
                                            <TableCell className="py-3 text-right">
                                                <Input
                                                    className={cn(
                                                        'ml-auto h-8 w-24 text-right tabular-nums focus-visible:bg-background',
                                                        planMode
                                                            ? isRealOnly
                                                                ? 'border-border/60 bg-muted/30 text-muted-foreground'
                                                                : 'border-amber-400/80 bg-amber-50/80 text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/20 dark:text-amber-50'
                                                            : 'border-border/60 bg-muted/20',
                                                    )}
                                                    value={planMode
                                                        ? isRealOnly
                                                            ? (scoreDrafts[assessment.id] ?? '')
                                                            : (whatIfDrafts[assessment.id] ?? '')
                                                        : (scoreDrafts[assessment.id] ?? '')}
                                                    inputMode="decimal"
                                                    disabled={isMutating || (planMode && isRealOnly)}
                                                    placeholder={planMode ? 'What if' : '--'}
                                                    onChange={(event) => {
                                                        const nextValue = event.target.value;
                                                        if (planMode) {
                                                            setWhatIfDrafts((current) => ({ ...current, [assessment.id]: nextValue }));
                                                            return;
                                                        }
                                                        setScoreDrafts((current) => ({ ...current, [assessment.id]: nextValue }));
                                                    }}
                                                    onBlur={() => {
                                                        if (!planMode) {
                                                            void handleSaveScore(assessment);
                                                        }
                                                    }}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter' && !planMode) {
                                                            event.preventDefault();
                                                            void handleSaveScore(assessment);
                                                        }
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`Edit assessment ${assessment.title}`}
                                                        disabled={!canManageAssessments}
                                                        onClick={() => {
                                                            setAssessmentDraft(createAssessmentDraft(gradebook, assessment));
                                                            setAssessmentDialogOpen(true);
                                                        }}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                variant="destructive"
                                                                size="icon"
                                                                aria-label={`Delete assessment ${assessment.title}`}
                                                                disabled={!canManageAssessments}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent size="sm">
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Delete assessment {assessment.title}?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    This action cannot be undone.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction
                                                                    onClick={() => {
                                                                        setAssessmentDraft(createAssessmentDraft(gradebook, assessment));
                                                                        void commitGradebook(api.deleteCourseGradebookAssessment(courseId, assessment.id));
                                                                    }}
                                                                >
                                                                    Delete
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </section>

            {assessmentDraft ? (
                <AssessmentDialog
                    open={assessmentDialogOpen}
                    onOpenChange={(open) => {
                        setAssessmentDialogOpen(open);
                        if (!open) {
                            setAssessmentDraft(null);
                        }
                    }}
                    draft={assessmentDraft}
                    onDraftChange={setAssessmentDraft}
                    categories={gradebook.categories}
                    isSaving={isMutating}
                    onSave={handleSaveAssessment}
                />
            ) : null}

            <Dialog open={planModeIntroOpen} onOpenChange={setPlanModeIntroOpen}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle>Enter Plan Mode</DialogTitle>
                        <DialogDescription>
                            Plan Mode turns the Score column into temporary What If inputs for ungraded assessments only.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 text-sm text-muted-foreground">
                        <p>Released scores stay locked so you always plan from real results.</p>
                        <p>Assessment add, edit, and delete actions are disabled until you leave Plan Mode.</p>
                        <p>What If values never overwrite saved course scores unless you manually enter them later.</p>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setPlanModeIntroOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" className="bg-amber-500 text-amber-950 hover:bg-amber-400" onClick={enterPlanMode}>
                            Continue
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={planModeExitOpen} onOpenChange={setPlanModeExitOpen}>
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Leave Plan Mode?</AlertDialogTitle>
                        <AlertDialogDescription>
                            What If scores are temporary and will not be saved after you leave Plan Mode.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep Planning</AlertDialogCancel>
                        <AlertDialogAction onClick={exitPlanMode}>
                            Leave Plan Mode
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export const BuiltinGradebookTabDefinition: TabDefinition = {
    type: BUILTIN_GRADEBOOK_TAB_TYPE,
    component: BuiltinGradebookTab,
    defaultSettings: {},
};
