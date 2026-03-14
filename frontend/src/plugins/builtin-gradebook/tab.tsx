// input:  [course gradebook APIs, course data update context, shared timetable refresh bus, animated stat-strip UI, shadcn UI primitives, switch/dialog primitives, builtin-gradebook shared forecast/plan helpers, and shared business empty-state wrappers]
// output: [course-scoped builtin-gradebook tab component with course-list-style assessment management UI, incomplete-weight warning stats, and tab definition]
// pos:    [course-scoped gradebook surface for assessment scores, Calendar due-date sync, temporary what-if editing, incomplete-weight calculation gating, and semantic empty-state feedback]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, FlaskConical, GraduationCap, Pencil, Percent, Plus, Search, Sparkles, Target, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { AppEmptyState } from '@/components/AppEmptyState';
import api, {
    type CourseGradebook,
    type GradebookAssessment,
    type GradebookAssessmentCategory,
} from '@/services/api';
import type { TabDefinition, TabProps } from '@/services/tabRegistry';

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
import { Calendar } from '@/components/ui/calendar';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
import { useCourseGradebookMutation, useCourseGradebookQuery } from '@/hooks/useCourseGradebookQuery';
import { publishTimetableScheduleChange } from '../builtin-event-core/shared/publishTimetableScheduleChange';
import {
    BUILTIN_GRADEBOOK_TAB_TYPE,
    buildComputedGradebookSummary,
    buildPlanModeResult,
    buildSuggestedWhatIfScores,
    hasCompleteGradebookWeight,
    formatGradebookDate,
    formatGradebookDateInput,
    formatPercent,
    getApiErrorMessage,
    getCategoryBadgeClassName,
    getCategoryBadgeStyle,
    getCategoryById,
    getRelativeDueText,
    isAssessmentOverdue,
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

const publishGradebookAssessmentCalendarRefresh = async (courseId: string, semesterId?: string) => {
    await publishTimetableScheduleChange({
        source: 'course',
        reason: 'gradebook-assessments-updated',
        courseId,
        semesterId,
    });
};

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
                'cursor-pointer select-none transition-colors hover:bg-muted/50',
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
                    <DialogDescription className="sr-only">
                        {draft.id ? 'Edit the details of this assessment.' : 'Enter the details for the new assessment.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-foreground">Details</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2 sm:col-span-2">
                                <Label>Title</Label>
                                <Input value={draft.title} onChange={(event) => setField('title', event.target.value)} placeholder="Final exam" />
                            </div>
                            <div className="space-y-2">
                                <Label>Category</Label>
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
                            </div>
                            <div className="space-y-2">
                                <Label>Due date</Label>
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
                            </div>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-foreground">Grading</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Weight (%)</Label>
                                <Input value={draft.weight} inputMode="decimal" onChange={(event) => setField('weight', event.target.value)} placeholder="20" />
                            </div>
                            <div className="space-y-2">
                                <Label>Score (%)</Label>
                                <Input value={draft.score} inputMode="decimal" onChange={(event) => setField('score', event.target.value)} placeholder="Optional" />
                            </div>
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
    const gradebookQuery = useCourseGradebookQuery(courseId);
    const gradebookMutation = useCourseGradebookMutation(courseId);
    const gradebook = gradebookQuery.data ?? null;

    React.useEffect(() => {
        if (gradebookQuery.error) {
            console.error('Failed to load gradebook tab', gradebookQuery.error);
            setErrorMessage('Failed to load the course gradebook.');
            return;
        }
        setErrorMessage(null);
    }, [gradebookQuery.error]);

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
            const response = await gradebookMutation.mutateAsync(() => promise);
            const nextSummary = buildComputedGradebookSummary(response);
            if (nextSummary.current_real_percentage !== null && nextSummary.current_real_gpa !== null) {
                updateCourse({
                    grade_percentage: nextSummary.current_real_percentage,
                    grade_scaled: nextSummary.current_real_gpa,
                });
            }
            return true;
        } catch (error: unknown) {
            console.error('Failed to update gradebook', error);
            toast.error(getApiErrorMessage(error));
            return false;
        } finally {
            setIsMutating(false);
        }
    }, [gradebookMutation, updateCourse]);

    const categoriesById = React.useMemo(
        () => new Map((gradebook?.categories ?? []).map((category) => [category.id, category])),
        [gradebook?.categories],
    );
    const summary = React.useMemo(
        () => (gradebook ? buildComputedGradebookSummary(gradebook) : null),
        [gradebook],
    );
    const hasCompleteWeight = summary?.has_complete_weight ?? false;

    const parsedWhatIfScores = React.useMemo(
        () => Object.fromEntries(
            Object.entries(whatIfDrafts)
                .map(([assessmentId, value]) => [assessmentId, parseOptionalNumber(value)])
                .filter((entry): entry is [string, number] => entry[1] !== null),
        ),
        [whatIfDrafts],
    );

    // Derive what-if projected values for the stat strip (never persisted).
    // Must live before any early returns to satisfy the Rules of Hooks.
    const whatIfResult = React.useMemo(() => {
        if (!gradebook || !planMode || Object.keys(parsedWhatIfScores).length === 0) return null;
        if (!hasCompleteGradebookWeight(gradebook)) return null;
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
        if (!hasCompleteWeight) {
            toast.error('Gradebook calculations stay disabled until total assessment weight reaches 100%.');
            return;
        }
        setPlanMode(true);
        setPlanModeIntroOpen(false);
    }, [hasCompleteWeight]);

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

        const didSave = assessmentDraft.id
            ? await commitGradebook(api.updateCourseGradebookAssessment(courseId, assessmentDraft.id, payload))
            : await commitGradebook(api.createCourseGradebookAssessment(courseId, payload));
        if (!didSave) {
            return;
        }
        publishGradebookAssessmentCalendarRefresh(courseId, course?.semester_id);

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
        if (!hasCompleteGradebookWeight(gradebook)) {
            toast.error('Gradebook calculations stay disabled until total assessment weight reaches 100%.');
            return;
        }
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
            <AppEmptyState
                scenario="unavailable"
                size="section"
                title="Gradebook unavailable"
                description="This tab requires a course context."
            />
        );
    }

    if (gradebookQuery.isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-44 w-full rounded-2xl" />
                <Skeleton className="h-[520px] w-full rounded-2xl" />
            </div>
        );
    }

    if (!gradebook || errorMessage || !summary) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="section"
                title="Gradebook failed to load"
                description={errorMessage ?? 'Unknown error.'}
                primaryAction={(
                    <Button type="button" onClick={() => void gradebookQuery.refetch()}>
                        Retry
                    </Button>
                )}
            />
        );
    }


    const hasActiveAssessmentFilters = deferredSearchQuery.trim().length > 0;
    const canManageAssessments = !planMode;
    const planModeSwitchLabel = 'Plan Mode';
    const toolbarSecondarySlotClassName = cn(
        'flex h-11 shrink-0 items-center transition-all duration-300 relative z-10',
        planMode ? 'flex-1 min-w-[130px]' : 'w-0 flex-none overflow-hidden opacity-0 p-0 m-0 border-0'
    );
    const toolbarPrimarySlotClassName = cn(
        'flex h-11 flex-1 min-w-[200px] shrink-0 items-center justify-end transition-all duration-300 relative overflow-hidden z-10'
    );

    const showWeightIncompleteState = Boolean(course && summary && !summary.has_complete_weight);

    return (
        <div className="space-y-4">
            {course ? (
                <section className="mb-2.5">
                    <div className={cn(
                        'grid select-none rounded-lg border overflow-hidden transition-colors duration-300',
                        showWeightIncompleteState
                            ? 'border-rose-300/80 bg-rose-50/40 dark:border-rose-500/40 dark:bg-rose-950/15'
                            : planMode
                            ? 'border-amber-300/60 dark:border-amber-500/30'
                            : 'border-border/70',
                    )} style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                        {/* Grade */}
                        <div className={cn(
                            'min-w-0 px-3.5 py-2.5 transition-colors duration-300',
                            showWeightIncompleteState
                                ? 'bg-rose-50/80 dark:bg-rose-950/20'
                                : planMode ? 'bg-amber-50/60 dark:bg-amber-950/25' : '',
                        )}>
                            <div className="flex items-center gap-1.5">
                                {showWeightIncompleteState
                                    ? <Percent className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                                    : planMode
                                    ? <FlaskConical className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                                    : <Percent className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />}
                                <p className={cn(
                                    'truncate text-xs font-medium transition-colors duration-300',
                                    showWeightIncompleteState
                                        ? 'text-rose-700 dark:text-rose-300'
                                        : planMode ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground/80',
                                )}>
                                    {showWeightIncompleteState ? 'Grade · Incomplete Weight' : planMode ? 'Grade · What If' : 'Grade'}
                                </p>
                            </div>
                            <div className="mt-0.5 truncate text-sm font-semibold tracking-tight sm:text-lg">
                                {course.hide_gpa ? '****' : showWeightIncompleteState ? (
                                    <span className="text-rose-600 dark:text-rose-400">Not calculated</span>
                                ) : planMode && whatIfResult ? (
                                    <span className="text-amber-600 dark:text-amber-400">
                                        <AnimatedNumber
                                            value={whatIfResult.projected_percentage}
                                            format={(v) => `${v.toFixed(1)}%`}
                                        />
                                    </span>
                                ) : (
                                    <AnimatedNumber
                                        value={course.grade_percentage}
                                        format={(v) => `${v.toFixed(1)}%`}
                                    />
                                )}
                            </div>
                            {!course.hide_gpa && showWeightIncompleteState ? (
                                <p className="mt-1 text-[11px] text-rose-700/90 dark:text-rose-300/90">
                                    Total weight is {summary.total_weight.toFixed(1)}%. Reach 100% to calculate.
                                </p>
                            ) : null}
                        </div>

                        {/* GPA */}
                        <div className={cn(
                            'min-w-0 border-l px-3.5 py-2.5 transition-colors duration-300',
                            showWeightIncompleteState
                                ? 'border-rose-300/80 bg-rose-50/80 dark:border-rose-500/40 dark:bg-rose-950/20'
                                : planMode
                                ? 'border-amber-300/60 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-950/25'
                                : 'border-border/70',
                        )}>
                            <div className="flex items-center gap-1.5">
                                {showWeightIncompleteState
                                    ? <GraduationCap className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                                    : planMode
                                    ? <FlaskConical className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                                    : <GraduationCap className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />}
                                <p className={cn(
                                    'truncate text-xs font-medium transition-colors duration-300',
                                    showWeightIncompleteState
                                        ? 'text-rose-700 dark:text-rose-300'
                                        : planMode ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground/80',
                                )}>
                                    {showWeightIncompleteState ? 'GPA · Incomplete Weight' : planMode ? 'GPA · What If' : 'GPA (Scaled)'}
                                </p>
                            </div>
                            <div className="mt-0.5 truncate text-sm font-semibold tracking-tight sm:text-lg">
                                {course.hide_gpa ? '****' : showWeightIncompleteState ? (
                                    <span className="text-rose-600 dark:text-rose-400">Not calculated</span>
                                ) : planMode && whatIfResult ? (
                                    <span className="text-amber-600 dark:text-amber-400">
                                        <AnimatedNumber
                                            value={whatIfResult.projected_gpa}
                                            format={(v) => v.toFixed(2)}
                                            rainbowThreshold={3.8}
                                        />
                                    </span>
                                ) : (
                                    <AnimatedNumber
                                        value={course.grade_scaled}
                                            format={(v) => v.toFixed(2)}
                                            rainbowThreshold={3.8}
                                        />
                                )}
                            </div>
                            {!course.hide_gpa && showWeightIncompleteState ? (
                                <p className="mt-1 text-[11px] text-rose-700/90 dark:text-rose-300/90">
                                    Gradebook math stays off while the configured weights are below 100%.
                                </p>
                            ) : null}
                        </div>
                    </div>
                </section>
            ) : null}

            <section className="space-y-3">
                <h2 className="text-lg font-semibold tracking-tight">Assessments</h2>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative w-full lg:max-w-xl min-w-0">
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
                                planMode && 'border-amber-300/50 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-950/30',
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

                    <div className={cn(
                        "flex w-full lg:flex-1 items-center justify-end gap-2 lg:gap-3",
                        planMode ? "flex-wrap lg:flex-nowrap" : "flex-nowrap"
                    )}>
                        <div className={cn(
                            'flex h-11 flex-1 min-w-[140px] shrink-0 select-none items-center justify-between gap-2 lg:gap-3 rounded-md border px-3',
                            planMode ? 'border-amber-400/50 bg-amber-100/50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-100' : 'border-border/60 bg-background/80',
                        )}>
                            <div className="flex items-center gap-2 text-sm font-medium tracking-tight whitespace-nowrap">
                                <Sparkles className={cn('h-4 w-4', planMode ? 'text-amber-500 dark:text-amber-400' : 'text-muted-foreground')} />
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
                            <div className={cn(
                                "absolute left-0 top-0 flex h-11 w-full items-center gap-1.5 sm:gap-2 rounded-md border border-amber-300/70 bg-amber-50/70 px-2 sm:px-3 transition-all duration-300 dark:border-amber-500/40 dark:bg-amber-950/20",
                                planMode ? "opacity-100 visible z-10 translate-x-0" : "opacity-0 invisible -z-10 -translate-x-2"
                            )}>
                                <Target className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
                                <Label htmlFor="gradebook-target-gpa" className="text-xs font-medium text-muted-foreground whitespace-nowrap">Target GPA</Label>
                                <Input
                                    id="gradebook-target-gpa"
                                    className="h-8 flex-1 min-w-0 border-0 bg-transparent px-0 text-right tabular-nums shadow-none focus-visible:ring-0 text-amber-950 dark:text-amber-50 font-medium"
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
                                    disabled={!planMode}
                                    tabIndex={planMode ? 0 : -1}
                                />
                            </div>
                            <div aria-hidden="true" className={cn(
                                "absolute inset-0 h-11 w-full rounded-md border border-transparent transition-all duration-300",
                                planMode ? "opacity-0 invisible" : "opacity-100 visible"
                            )} />
                        </div>

                        <div className={toolbarPrimarySlotClassName}>
                            <div className={cn(
                                "absolute inset-0 transition-all duration-300",
                                planMode ? "opacity-0 invisible translate-y-2" : "opacity-100 visible translate-y-0"
                            )}>
                                <Button
                                    type="button"
                                    disabled={isMutating || planMode}
                                    className="h-11 w-full rounded-md px-3 sm:px-4"
                                    onClick={() => {
                                        setAssessmentDraft(createAssessmentDraft(gradebook));
                                        setAssessmentDialogOpen(true);
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4 shrink-0" />
                                    <span className="truncate">Add Assessment</span>
                                </Button>
                            </div>

                            <div className={cn(
                                "absolute inset-0 transition-all duration-300",
                                planMode ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-2"
                            )}>
                                <Button
                                    type="button"
                                    onClick={() => void handleRunPlan()}
                                    disabled={isMutating || !planMode}
                                    className="h-11 w-full rounded-md bg-amber-500 text-amber-950 hover:bg-amber-400 disabled:bg-muted disabled:text-muted-foreground px-3 sm:px-4"
                                >
                                    <Sparkles className="mr-2 h-4 w-4 shrink-0" />
                                    <span className="truncate">Auto-fill</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="min-h-[400px] rounded-md border bg-card flex flex-col overflow-hidden">
                    {filteredAssessments.length === 0 ? (
                        <AppEmptyState
                            scenario={hasActiveAssessmentFilters ? 'no-results' : 'create'}
                            size="section"
                            surface="inherit"
                            className="min-h-[400px] rounded-md"
                            title={hasActiveAssessmentFilters ? 'No assessments found' : 'No assessments added yet'}
                            description={
                                hasActiveAssessmentFilters
                                    ? 'Try clearing the search to see more assessments.'
                                    : 'Add your first assessment to start tracking this course.'
                            }
                            primaryAction={hasActiveAssessmentFilters ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setSearchQuery('')}
                                >
                                    Clear Search
                                </Button>
                            ) : !planMode ? (
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
                            ) : undefined}
                            secondaryAction={hasActiveAssessmentFilters && !planMode ? (
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
                            ) : undefined}
                        />
                    ) : (
                            <div className="max-h-[600px] overflow-hidden">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-card">
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
                                                            className={cn('select-none border-0 px-2.5 py-0.5 text-xs font-medium', getCategoryBadgeClassName(category.color_token))}
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
                                                            className="select-none"
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
                                                                    className="select-none"
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
                                                                        variant="destructive"
                                                                        onClick={() => {
                                                                            setAssessmentDraft(createAssessmentDraft(gradebook, assessment));
                                                                            void commitGradebook(api.deleteCourseGradebookAssessment(courseId, assessment.id))
                                                                                .then((didDelete) => {
                                                                                    if (!didDelete) return;
                                                                                    publishGradebookAssessmentCalendarRefresh(courseId, course?.semester_id);
                                                                                });
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
                            </div>
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
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>Enter Plan Mode</DialogTitle>
                        <DialogDescription>
                            Simulate <strong>What If</strong> scores on ungraded assessments to forecast your GPA — no real data is modified.
                        </DialogDescription>
                    </DialogHeader>
                    <ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-4">
                        <li><strong>Graded</strong> assessments stay locked to keep results accurate.</li>
                        <li><strong>Add / Edit / Delete</strong> is disabled until you leave Plan Mode.</li>
                        <li>Set a <strong>Target GPA</strong> and tap <strong>Auto-fill</strong>.</li>
                    </ul>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setPlanModeIntroOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" className="bg-amber-500 text-amber-950 hover:bg-amber-400" onClick={enterPlanMode}>
                            Enter Plan Mode
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
                        <AlertDialogAction>Keep Planning</AlertDialogAction>
                        <AlertDialogCancel onClick={exitPlanMode}>
                            Leave Plan Mode
                        </AlertDialogCancel>
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
