// input:  [course gradebook APIs, course data update context, LMS assignment APIs, plugin UI-state hooks, shared timetable refresh bus, animated stat-strip UI, shadcn UI/scroll-area primitives, switch/dialog primitives, builtin-gradebook shared forecast/plan helpers plus GPA-threshold resolution helpers, and shared business empty-state wrappers]
// output: [course-scoped builtin-gradebook tab component plus tab definition]
// pos:    [course-scoped gradebook surface for local assessment scores, extracted assessment dialog and sortable table-head subcomponents, Calendar due-date sync, instance-local assessment-sort and plan-mode what-if UI state, exact-100 weight gating, animated mode-specific toolbar controls, and semantic empty-state feedback]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FlaskConical, GraduationCap, Pencil, Percent, Plus, Sparkles, Target, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { AppEmptyState } from '@/components/AppEmptyState';
import api, {
    type CourseGradebook,
    type GradebookAssessment,
} from '@/services/api';
import { queryKeys } from '@/services/queryKeys';
import type { TabDefinition, TabProps } from '@/plugin-system';

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
import { AnimatedNumber } from '@/components/AnimatedNumber';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
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
import { usePluginUiState } from '@/plugin-system';
import { publishTimetableScheduleChange } from '../builtin-event-core/shared/publishTimetableScheduleChange';
import { AssessmentDialog, createAssessmentDraft, type AssessmentDraft } from './components/AssessmentDialog';
import { SortableHead } from './components/SortableHead';
import {
    BUILTIN_GRADEBOOK_TAB_TYPE,
    buildComputedGradebookSummary,
    buildPlanModeResult,
    buildSuggestedWhatIfScores,
    calculateGradebookGpa,
    hasCompleteGradebookWeight,
    formatGradebookDate,
    formatGradebookGpaPercentage,
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

const DEFAULT_SORT_KEY: GradebookSortKey = 'due_date';
const DEFAULT_SORT_DIRECTION: GradebookSortDirection = 'none';
type TargetInputMode = 'gpa' | 'percentage';

interface GradebookPlanModeUiState {
    planMode: boolean;
    whatIfDrafts: Record<string, string>;
    targetInputMode: TargetInputMode;
}

interface GradebookAssessmentViewUiState {
    sortKey: GradebookSortKey;
    sortDirection: GradebookSortDirection;
}

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

const getGradebookAssessmentFingerprint = (assessment: Pick<GradebookAssessment, 'title' | 'due_date'>) => {
    return `${assessment.title.trim().toLowerCase()}::${assessment.due_date ?? ''}`;
};

const formatTargetDraftValue = (
    gradebook: CourseGradebook,
    inputMode: TargetInputMode,
    targetGpa: number = gradebook.target_gpa,
) => {
    if (inputMode === 'percentage') {
        const targetPercentage = resolveTargetPercentageForGpa(targetGpa, gradebook.scaling_table);
        return targetPercentage === null ? '' : String(targetPercentage);
    }
    return String(targetGpa);
};

const parseTargetDraftValue = (
    gradebook: CourseGradebook,
    draftValue: string,
    inputMode: TargetInputMode,
) => {
    const parsed = Number(draftValue);
    if (!Number.isFinite(parsed)) return null;
    if (inputMode === 'percentage') {
        if (parsed < 0 || parsed > 100) return null;
        return calculateGradebookGpa(parsed, gradebook.scaling_table);
    }
    return parsed;
};

const BuiltinGradebookTab: React.FC<TabProps> = ({ courseId }) => {
    const { course, updateCourse } = useCourseData();
    const {
        state: planModeState,
        setState: setPlanModeUiState,
    } = usePluginUiState<GradebookPlanModeUiState>('gradebook-plan-mode', () => ({
        planMode: false,
        whatIfDrafts: {},
        targetInputMode: 'gpa',
    }));
    const {
        state: assessmentViewState,
        setState: setAssessmentViewState,
    } = usePluginUiState<GradebookAssessmentViewUiState>('gradebook-assessment-view', () => ({
        sortKey: DEFAULT_SORT_KEY,
        sortDirection: DEFAULT_SORT_DIRECTION,
    }));
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
    const [isMutating, setIsMutating] = React.useState(false);
    const [assessmentDraft, setAssessmentDraft] = React.useState<AssessmentDraft | null>(null);
    const [assessmentDialogOpen, setAssessmentDialogOpen] = React.useState(false);
    const [scoreDrafts, setScoreDrafts] = React.useState<Record<string, string>>({});
    const [planModeIntroOpen, setPlanModeIntroOpen] = React.useState(false);
    const [planModeExitOpen, setPlanModeExitOpen] = React.useState(false);
    const [targetGpaDraft, setTargetGpaDraft] = React.useState('');
    const sortKey = assessmentViewState.sortKey;
    const sortDirection = assessmentViewState.sortDirection;
    const gradebookQuery = useCourseGradebookQuery(courseId);
    const gradebookMutation = useCourseGradebookMutation(courseId);
    const gradebook = gradebookQuery.data ?? null;
    const lmsLinkQuery = useQuery({
        queryKey: courseId ? queryKeys.courses.lmsLink(courseId) : ['courses', 'lms-link', 'disabled'],
        queryFn: () => api.getCourseLmsLink(courseId!),
        enabled: Boolean(courseId),
        retry: false,
        staleTime: 60_000,
    });
    const lmsAssignmentsQuery = useQuery({
        queryKey: courseId ? queryKeys.courses.lmsAssignments(courseId) : ['courses', 'lms-assignments', 'disabled'],
        queryFn: () => api.getCourseLmsAssignments(courseId!),
        enabled: Boolean(courseId && lmsLinkQuery.data),
        retry: false,
        staleTime: 60_000,
    });
    const importedLmsAssignmentFingerprints = React.useMemo(() => (
        new Set(
            gradebook?.assessments.map((assessment) => getGradebookAssessmentFingerprint(assessment)) ?? [],
        )
    ), [gradebook?.assessments]);
    const planMode = planModeState.planMode;
    const whatIfDrafts = planModeState.whatIfDrafts;
    const targetInputMode = planModeState.targetInputMode;

    const updatePlanModeState = React.useCallback((patch: Partial<GradebookPlanModeUiState>) => {
        setPlanModeUiState((currentState) => ({
            ...currentState,
            ...patch,
        }));
    }, [setPlanModeUiState]);

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
        setTargetGpaDraft(formatTargetDraftValue(gradebook, targetInputMode));
        setScoreDrafts(Object.fromEntries(
            gradebook.assessments.map((assessment) => [
                assessment.id,
                assessment.score === null || assessment.score === undefined ? '' : String(assessment.score),
            ]),
        ));
    }, [gradebook, targetInputMode]);

    React.useEffect(() => {
        if (!gradebook) {
            return;
        }
        const editableAssessmentIds = new Set(
            gradebook.assessments
                .filter((assessment) => assessment.score === null)
                .map((assessment) => assessment.id),
        );
        setPlanModeUiState((currentState) => {
            const nextWhatIfDrafts = Object.fromEntries(
                Object.entries(currentState.whatIfDrafts).filter(([assessmentId]) => editableAssessmentIds.has(assessmentId)),
            );
            const shouldResetPlanMode = currentState.planMode && !hasCompleteGradebookWeight(gradebook);
            const planModeStateChanged = shouldResetPlanMode
                || Object.keys(nextWhatIfDrafts).length !== Object.keys(currentState.whatIfDrafts).length;
            if (!planModeStateChanged) {
                return currentState;
            }
            return {
                planMode: shouldResetPlanMode ? false : currentState.planMode,
                whatIfDrafts: nextWhatIfDrafts,
                targetInputMode: currentState.targetInputMode,
            };
        });
    }, [gradebook, setPlanModeUiState]);

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
        const parsed = parseTargetDraftValue(gradebook, targetGpaDraft, targetInputMode);
        if (parsed === null) return null;
        return buildPlanModeResult(gradebook, parsed, parsedWhatIfScores);
    }, [gradebook, parsedWhatIfScores, planMode, targetGpaDraft, targetInputMode]);

    const filteredAssessments = React.useMemo(() => {
        if (!gradebook) return [];
        return sortAssessments(gradebook.assessments, categoriesById, sortKey, sortDirection);
    }, [categoriesById, gradebook, sortDirection, sortKey]);

    const requestSort = React.useCallback((nextSortKey: GradebookSortKey) => {
        if (assessmentViewState.sortKey === nextSortKey) {
            setAssessmentViewState((current) => ({
                ...current,
                sortDirection: current.sortDirection === 'none' ? 'asc' : current.sortDirection === 'asc' ? 'desc' : 'none',
            }));
            return;
        }
        setAssessmentViewState((current) => ({
            ...current,
            sortKey: nextSortKey,
            sortDirection: 'asc',
        }));
    }, [assessmentViewState.sortKey, setAssessmentViewState]);

    const enterPlanMode = React.useCallback(() => {
        if (!hasCompleteWeight) {
            toast.error('Gradebook calculations stay disabled until total assessment weight is exactly 100%.');
            return;
        }
        updatePlanModeState({ planMode: true });
        setPlanModeIntroOpen(false);
    }, [hasCompleteWeight, updatePlanModeState]);

    const exitPlanMode = React.useCallback(() => {
        updatePlanModeState({
            planMode: false,
            whatIfDrafts: {},
        });
        setPlanModeExitOpen(false);
    }, [updatePlanModeState]);

    const handlePlanModeCheckedChange = React.useCallback((checked: boolean) => {
        if (checked) {
            setPlanModeIntroOpen(true);
            return;
        }
        setPlanModeExitOpen(true);
    }, []);

    const handleSaveAssessment = async () => {
        if (!courseId || !assessmentDraft) return;
        if (!assessmentDraft.id && assessmentDraft.source_mode === 'lms') {
            if (assessmentDraft.selected_lms_assignment_ids.length === 0) {
                toast.error('Select at least one LMS assignment to add.');
                return;
            }
            setIsMutating(true);
            try {
                const selectedAssignments = (lmsAssignmentsQuery.data?.items ?? [])
                    .filter((assignment) => assessmentDraft.selected_lms_assignment_ids.includes(assignment.external_id));
                let latestGradebook: CourseGradebook | null = null;
                for (const assignment of selectedAssignments) {
                    latestGradebook = await api.createCourseGradebookAssessment(courseId, {
                        category_id: assessmentDraft.category_id,
                        title: assignment.title,
                        due_date: assignment.due_date ?? null,
                        weight: 0,
                        score: null,
                        points_earned: null,
                        points_possible: null,
                    });
                }
                if (!latestGradebook) {
                    toast.error('No LMS assignments were selected.');
                    return;
                }
                await gradebookMutation.mutateAsync(() => Promise.resolve(latestGradebook));
                const nextSummary = buildComputedGradebookSummary(latestGradebook);
                if (nextSummary.current_real_percentage !== null && nextSummary.current_real_gpa !== null) {
                    updateCourse({
                        grade_percentage: nextSummary.current_real_percentage,
                        grade_scaled: nextSummary.current_real_gpa,
                    });
                }
                publishGradebookAssessmentCalendarRefresh(courseId, course?.semester_id);
                toast.success(`Added ${selectedAssignments.length} LMS assessment${selectedAssignments.length === 1 ? '' : 's'} to Gradebook.`);
                setAssessmentDialogOpen(false);
                setAssessmentDraft(null);
            } catch (error: unknown) {
                console.error('Failed to add LMS assignments to gradebook', error);
                toast.error(getApiErrorMessage(error));
            } finally {
                setIsMutating(false);
            }
            return;
        }

        const payload = {
            category_id: assessmentDraft.category_id,
            title: assessmentDraft.title.trim(),
            due_date: assessmentDraft.due_date || null,
            weight: Number(assessmentDraft.weight) || 0,
            score: assessmentDraft.score_mode === 'percent' ? parseOptionalNumber(assessmentDraft.score) : null,
            points_earned: assessmentDraft.score_mode === 'points' ? parseOptionalNumber(assessmentDraft.points_earned) : null,
            points_possible: assessmentDraft.score_mode === 'points' ? parseOptionalNumber(assessmentDraft.points_possible) : null,
        };

        if (!payload.title) {
            toast.error('Assessment title is required.');
            return;
        }
        if (assessmentDraft.score_mode === 'points') {
            const hasEitherPoints = payload.points_earned !== null || payload.points_possible !== null;
            if (hasEitherPoints && (payload.points_earned === null || payload.points_possible === null)) {
                toast.error('Enter both points earned and points possible.');
                return;
            }
            if (payload.points_possible !== null && payload.points_possible <= 0) {
                toast.error('Points possible must be greater than 0.');
                return;
            }
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
        if (!targetGpaDraft.trim()) {
            return;
        }
        const parsed = parseTargetDraftValue(gradebook, targetGpaDraft, targetInputMode);
        if (parsed === null) {
            toast.error(targetInputMode === 'percentage' ? 'Enter a valid GPA percentage target.' : 'Enter a valid GPA target.');
            setTargetGpaDraft(formatTargetDraftValue(gradebook, targetInputMode));
            return;
        }
        if (parsed === gradebook.target_gpa) return;
        await commitGradebook(api.updateCourseGradebookPreferences(courseId, { target_gpa: parsed }));
    }, [commitGradebook, courseId, gradebook, targetGpaDraft, targetInputMode]);

    const handleRunPlan = React.useCallback(async () => {
        if (!gradebook) return;
        if (!hasCompleteGradebookWeight(gradebook)) {
            toast.error('Gradebook calculations stay disabled until total assessment weight is exactly 100%.');
            return;
        }
        if (!targetGpaDraft.trim()) {
            toast.error(targetInputMode === 'percentage'
                ? 'Enter a GPA percentage target before running Auto-fill.'
                : 'Enter a GPA target before running Auto-fill.');
            return;
        }
        const parsed = parseTargetDraftValue(gradebook, targetGpaDraft, targetInputMode);
        if (parsed === null) {
            toast.error(targetInputMode === 'percentage'
                ? 'Enter a valid GPA percentage target before running the plan.'
                : 'Enter a valid GPA target before running the plan.');
            return;
        }
        const suggestions = buildSuggestedWhatIfScores(gradebook, parsed);
        updatePlanModeState({
            whatIfDrafts: Object.fromEntries(
                Object.entries(suggestions).map(([assessmentId, score]) => [assessmentId, String(score)]),
            ),
        });
        await handlePersistTargetGpa();
    }, [gradebook, handlePersistTargetGpa, targetGpaDraft, targetInputMode, updatePlanModeState]);

    const handleToggleTargetInputMode = React.useCallback(() => {
        if (!gradebook) return;
        const nextInputMode: TargetInputMode = targetInputMode === 'gpa' ? 'percentage' : 'gpa';
        const parsedTargetGpa = parseTargetDraftValue(gradebook, targetGpaDraft, targetInputMode) ?? gradebook.target_gpa;
        updatePlanModeState({ targetInputMode: nextInputMode });
        setTargetGpaDraft(formatTargetDraftValue(gradebook, nextInputMode, parsedTargetGpa));
    }, [gradebook, targetGpaDraft, targetInputMode, updatePlanModeState]);

    const handleSaveScore = React.useCallback(async (assessment: GradebookAssessment) => {
        if (!courseId || planMode) return;
        const nextValue = parseOptionalNumber(scoreDrafts[assessment.id] ?? '');
        if (nextValue === assessment.score) return;
        await commitGradebook(api.updateCourseGradebookAssessment(courseId, assessment.id, {
            score: nextValue,
            points_earned: null,
            points_possible: null,
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
    const canManageAssessments = !planMode;
    const planModeSwitchLabel = 'Plan Mode';
    const toolbarSecondarySlotClassName = cn(
        'flex min-w-0 shrink items-center overflow-hidden transition-[max-width,opacity] duration-200',
        planMode ? 'max-w-[300px] opacity-100' : 'pointer-events-none max-w-0 opacity-0',
    );

    const showWeightMismatchState = Boolean(course && summary && !summary.has_complete_weight);

    return (
        <div className="space-y-4">
            {course ? (
                <section className="mb-2.5">
                    <div className={cn(
                        'grid select-none rounded-lg border overflow-hidden transition-colors duration-300',
                        showWeightMismatchState
                            ? 'border-rose-300/80 bg-rose-50/40 dark:border-rose-500/40 dark:bg-rose-950/15'
                            : planMode
                            ? 'border-amber-300/60 dark:border-amber-500/30'
                            : 'border-border/70',
                    )} style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                        {/* Grade */}
                        <div className={cn(
                            'min-w-0 px-3.5 py-2.5 transition-colors duration-300',
                            showWeightMismatchState
                                ? 'bg-rose-50/80 dark:bg-rose-950/20'
                                : planMode ? 'bg-amber-50/60 dark:bg-amber-950/25' : '',
                        )}>
                            <div className="flex items-center gap-1.5">
                                {showWeightMismatchState
                                    ? <Percent className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                                    : planMode
                                    ? <FlaskConical className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                                    : <Percent className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />}
                                <p className={cn(
                                    'truncate text-xs font-medium transition-colors duration-300',
                                    showWeightMismatchState
                                        ? 'text-rose-700 dark:text-rose-300'
                                        : planMode ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground/80',
                                )}>
                                    {showWeightMismatchState ? 'Grade · Weight Mismatch' : planMode ? 'Grade · What If' : 'Grade'}
                                </p>
                            </div>
                            <div className="mt-0.5 truncate text-sm font-semibold tracking-tight sm:text-lg">
                                {course.hide_gpa ? '****' : showWeightMismatchState ? (
                                    <span className="text-rose-600 dark:text-rose-400">Not calculated</span>
                                ) : planMode && whatIfResult ? (
                                    <span className="text-amber-600 dark:text-amber-400">
                                        <AnimatedNumber
                                            value={whatIfResult.projected_percentage}
                                            format={formatGradebookGpaPercentage}
                                        />
                                    </span>
                                ) : (
                                    <AnimatedNumber
                                        value={course.grade_percentage}
                                        format={formatGradebookGpaPercentage}
                                    />
                                )}
                            </div>
                            {!course.hide_gpa && showWeightMismatchState ? (
                                <p className="mt-1 text-[11px] text-rose-700/90 dark:text-rose-300/90">
                                    Total weight is {summary.total_weight.toFixed(1)}%. It must be exactly 100.0% to calculate.
                                </p>
                            ) : null}
                        </div>

                        {/* GPA */}
                        <div className={cn(
                            'min-w-0 border-l px-3.5 py-2.5 transition-colors duration-300',
                            showWeightMismatchState
                                ? 'border-rose-300/80 bg-rose-50/80 dark:border-rose-500/40 dark:bg-rose-950/20'
                                : planMode
                                ? 'border-amber-300/60 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-950/25'
                                : 'border-border/70',
                        )}>
                            <div className="flex items-center gap-1.5">
                                {showWeightMismatchState
                                    ? <GraduationCap className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                                    : planMode
                                    ? <FlaskConical className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                                    : <GraduationCap className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />}
                                <p className={cn(
                                    'truncate text-xs font-medium transition-colors duration-300',
                                    showWeightMismatchState
                                        ? 'text-rose-700 dark:text-rose-300'
                                        : planMode ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground/80',
                                )}>
                                    {showWeightMismatchState ? 'GPA · Weight Mismatch' : planMode ? 'GPA · What If' : 'GPA (Scaled)'}
                                </p>
                            </div>
                            <div className="mt-0.5 truncate text-sm font-semibold tracking-tight sm:text-lg">
                                {course.hide_gpa ? '****' : showWeightMismatchState ? (
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
                            {!course.hide_gpa && showWeightMismatchState ? (
                                <p className="mt-1 text-[11px] text-rose-700/90 dark:text-rose-300/90">
                                    Gradebook math stays off unless the configured weights total exactly 100%.
                                </p>
                            ) : null}
                        </div>
                    </div>
                </section>
            ) : null}

            <section className="space-y-3">
                <h2 className="text-lg font-semibold tracking-tight">Assessments</h2>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                        <div className={cn(
                            'flex h-11 w-full shrink-0 select-none items-center justify-between gap-2 rounded-md border px-3 sm:w-[184px]',
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
                            <div className="flex h-11 min-w-[188px] flex-1 items-center gap-2 rounded-md border border-amber-300/70 bg-amber-50/70 px-3 dark:border-amber-500/40 dark:bg-amber-950/20">
                                <Target className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
                                <Label htmlFor="gradebook-target-gpa" className="text-xs font-medium text-muted-foreground whitespace-nowrap">Target</Label>
                                <Input
                                    id="gradebook-target-gpa"
                                    className="h-8 flex-1 min-w-0 border-0 bg-transparent px-0 text-right tabular-nums shadow-none focus-visible:ring-0 text-amber-950 dark:text-amber-50 font-medium"
                                    value={targetGpaDraft}
                                    inputMode="decimal"
                                    placeholder={targetInputMode === 'gpa' ? '3.70' : '85.0'}
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
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0 rounded-md text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-950/35"
                                    onClick={handleToggleTargetInputMode}
                                    disabled={!planMode}
                                    tabIndex={planMode ? 0 : -1}
                                    aria-label={targetInputMode === 'gpa' ? 'Switch target input to GPA Percentage' : 'Switch target input to GPA'}
                                >
                                    {targetInputMode === 'gpa' ? (
                                        <Percent className="h-3.5 w-3.5 shrink-0" />
                                    ) : (
                                        <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="relative h-11 w-full shrink-0 sm:w-[188px]">
                        <div className="absolute inset-0">
                            <div className={cn(
                                "absolute inset-0 transition-all duration-300",
                                planMode ? "opacity-0 invisible" : "opacity-100 visible"
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
                                planMode ? "opacity-100 visible" : "opacity-0 invisible"
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
                            scenario="create"
                            size="section"
                            surface="inherit"
                            className="min-h-[400px] rounded-md"
                            title="No assessments added yet"
                            description="Add your first assessment to start tracking this course."
                            primaryAction={!planMode ? (
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
                                                                setPlanModeUiState((currentState) => ({
                                                                    ...currentState,
                                                                    whatIfDrafts: {
                                                                        ...currentState.whatIfDrafts,
                                                                        [assessment.id]: nextValue,
                                                                    },
                                                                }));
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
                    lmsAssignments={lmsAssignmentsQuery.data?.items ?? []}
                    importedLmsAssignmentFingerprints={importedLmsAssignmentFingerprints}
                    hasLmsLink={Boolean(lmsLinkQuery.data)}
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
                        <li>Set a target in <strong>GPA</strong> or <strong>GPA Percentage</strong>, then tap <strong>Auto-fill</strong>.</li>
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
                        <AlertDialogCancel>Keep Planning</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={exitPlanMode}>
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
