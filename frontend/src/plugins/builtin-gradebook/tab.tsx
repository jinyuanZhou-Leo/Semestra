// input:  [course gradebook APIs, shadcn UI primitives, and builtin-gradebook shared forecast/plan helpers]
// output: [course-scoped builtin-gradebook tab component with course-list-style assessment management UI and tab definition]
// pos:    [course-scoped gradebook surface for assessment scores, statistical forecasts, and temporary plan-mode what-if drafts]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, Pencil, Plus, Search, Sparkles, Target, Trash2, X } from 'lucide-react';
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
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
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
import {
    BUILTIN_GRADEBOOK_TAB_TYPE,
    DEFAULT_GRADEBOOK_VIEW_SETTINGS,
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

const ASSESSMENT_FILTER_OPTIONS = [
    { value: 'all', label: 'All Assessments' },
    { value: 'graded', label: 'Graded' },
    { value: 'ungraded', label: 'Ungraded' },
] as const;

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
    <div className="rounded-2xl border border-border/60 bg-background/85 px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
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
    const [gradebook, setGradebook] = React.useState<CourseGradebook | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
    const [isMutating, setIsMutating] = React.useState(false);
    const [assessmentDraft, setAssessmentDraft] = React.useState<AssessmentDraft | null>(null);
    const [assessmentDialogOpen, setAssessmentDialogOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [sortKey, setSortKey] = React.useState<GradebookSortKey>(DEFAULT_SORT_KEY);
    const [sortDirection, setSortDirection] = React.useState<GradebookSortDirection>(DEFAULT_SORT_DIRECTION);
    const [filterKey, setFilterKey] = React.useState(DEFAULT_GRADEBOOK_VIEW_SETTINGS.filter);
    const [scoreDrafts, setScoreDrafts] = React.useState<Record<string, string>>({});
    const [planMode, setPlanMode] = React.useState(false);
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
        } catch (error: unknown) {
            console.error('Failed to update gradebook', error);
            toast.error(getApiErrorMessage(error));
        } finally {
            setIsMutating(false);
        }
    }, []);

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
            const matchesSearch = !normalizedQuery
                || assessment.title.toLowerCase().includes(normalizedQuery)
                || categoryName.includes(normalizedQuery);

            if (!matchesSearch) return false;

            switch (filterKey) {
                case 'graded':
                    return assessment.score !== null;
                case 'ungraded':
                    return assessment.score === null;
                case 'all':
                default:
                    return true;
            }
        });
        return sortAssessments(filtered, categoriesById, sortKey, sortDirection);
    }, [categoriesById, deferredSearchQuery, filterKey, gradebook, sortDirection, sortKey]);

    const requestSort = React.useCallback((nextSortKey: GradebookSortKey) => {
        if (sortKey === nextSortKey) {
            setSortDirection((current) => current === 'none' ? 'asc' : current === 'asc' ? 'desc' : 'none');
            return;
        }
        setSortKey(nextSortKey);
        setSortDirection('asc');
    }, [sortKey]);

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
        if (!courseId) return;
        const nextValue = parseOptionalNumber(scoreDrafts[assessment.id] ?? '');
        if (nextValue === assessment.score) return;
        await commitGradebook(api.updateCourseGradebookAssessment(courseId, assessment.id, {
            score: nextValue,
        }));
    }, [commitGradebook, courseId, scoreDrafts]);

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
    const hasActiveAssessmentFilters = filterKey !== 'all' || deferredSearchQuery.trim().length > 0;

    return (
        <div className="space-y-4">
            <Card className="border-border/60 bg-card shadow-none">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <CardTitle className="text-lg font-semibold">Course Gradebook</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Keep one assessment table with saved scores, then open Plan mode only when you want a what-if path.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {planMode ? (
                            <>
                                <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                                    <Target className="h-4 w-4 text-muted-foreground" />
                                    <Label htmlFor="gradebook-target-gpa" className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Target GPA</Label>
                                    <Input
                                        id="gradebook-target-gpa"
                                        className="h-8 w-20"
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
                                <Button type="button" onClick={() => void handleRunPlan()} disabled={isMutating}>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Run Plan
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setPlanMode(false);
                                        setWhatIfDrafts({});
                                    }}
                                >
                                    Exit Plan
                                </Button>
                            </>
                        ) : (
                            <Button type="button" onClick={() => setPlanMode(true)}>
                                <Target className="mr-2 h-4 w-4" />
                                Enter Plan Mode
                            </Button>
                        )}
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
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                        <div className="hidden items-center gap-2 text-xs text-muted-foreground tabular-nums md:flex">
                            <span>{hasActiveAssessmentFilters ? `${filteredAssessments.length} shown` : `${gradebook.assessments.length} total`}</span>
                            <span aria-hidden="true">·</span>
                            <span>{summary.graded_count} graded</span>
                            <span aria-hidden="true">·</span>
                            <span>{summary.ungraded_count} ungraded</span>
                        </div>
                        <Button
                            type="button"
                            onClick={() => {
                                setAssessmentDraft(createAssessmentDraft(gradebook));
                                setAssessmentDialogOpen(true);
                            }}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Assessment
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div className="relative w-full max-w-sm">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search assessments..."
                                className="h-10 pl-9"
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
                        <Select value={filterKey} onValueChange={(value) => setFilterKey(value as typeof filterKey)}>
                            <SelectTrigger className={cn(
                                'h-10 w-[170px] text-sm',
                                filterKey !== 'all' ? 'border-primary/50 bg-primary/5 text-primary' : '',
                            )}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {ASSESSMENT_FILTER_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="min-h-[300px] rounded-md border bg-card flex flex-col">
                    {filteredAssessments.length === 0 ? (
                        <Empty className="min-h-[300px] border-0 rounded-md">
                            <EmptyHeader>
                                <EmptyTitle>{hasActiveAssessmentFilters ? 'No assessments found' : 'No assessments added yet'}</EmptyTitle>
                                <EmptyDescription>
                                    {hasActiveAssessmentFilters
                                        ? 'Try clearing the search or filter to see more assessments.'
                                        : 'Add your first assessment to start tracking this course.'}
                                </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent className="sm:flex-row sm:justify-center">
                                {hasActiveAssessmentFilters ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setSearchQuery('');
                                            setFilterKey('all');
                                        }}
                                    >
                                        Clear Filters
                                    </Button>
                                ) : null}
                                <Button
                                    type="button"
                                    onClick={() => {
                                        setAssessmentDraft(createAssessmentDraft(gradebook));
                                        setAssessmentDialogOpen(true);
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Assessment
                                </Button>
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
                                        <SortableHead label="Score" sortKey="score" currentSortKey={sortKey} currentDirection={sortDirection} onRequestSort={requestSort} align="right" />
                                        {planMode ? (
                                            <TableHead className="text-right">
                                                <div className="flex items-center justify-end">What If</div>
                                            </TableHead>
                                        ) : null}
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
                                                    className="ml-auto h-8 w-24 border-border/60 bg-muted/20 text-right tabular-nums focus-visible:bg-background"
                                                    value={scoreDrafts[assessment.id] ?? ''}
                                                    inputMode="decimal"
                                                    disabled={isMutating}
                                                    placeholder="--"
                                                    onChange={(event) => {
                                                        const nextValue = event.target.value;
                                                        setScoreDrafts((current) => ({ ...current, [assessment.id]: nextValue }));
                                                    }}
                                                    onBlur={() => void handleSaveScore(assessment)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter') {
                                                            event.preventDefault();
                                                            void handleSaveScore(assessment);
                                                        }
                                                    }}
                                                />
                                            </TableCell>
                                            {planMode ? (
                                                <TableCell className="py-3 text-right">
                                                    {isRealOnly ? (
                                                        <span className="text-xs text-muted-foreground/60">Scored</span>
                                                    ) : (
                                                        <Input
                                                            className="ml-auto h-8 w-24 border-border/60 bg-primary/[0.04] text-right tabular-nums focus-visible:bg-background"
                                                            value={whatIfDrafts[assessment.id] ?? ''}
                                                            inputMode="decimal"
                                                            placeholder="Run plan"
                                                            onChange={(event) => {
                                                                const nextValue = event.target.value;
                                                                setWhatIfDrafts((current) => ({ ...current, [assessment.id]: nextValue }));
                                                            }}
                                                        />
                                                    )}
                                                </TableCell>
                                            ) : null}
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`Edit assessment ${assessment.title}`}
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
        </div>
    );
};

export const BuiltinGradebookTabDefinition: TabDefinition = {
    type: BUILTIN_GRADEBOOK_TAB_TYPE,
    component: BuiltinGradebookTab,
    defaultSettings: {},
};
