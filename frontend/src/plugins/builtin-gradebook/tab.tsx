// input:  [course gradebook APIs, course data update context, LMS assignment APIs, plugin UI-state hooks, shared timetable refresh bus, animated stat-strip UI, shadcn UI/scroll-area primitives, switch/dialog primitives, builtin-gradebook shared forecast/plan helpers plus GPA-threshold resolution helpers, and shared business empty-state wrappers]
// output: [course-scoped builtin-gradebook tab component plus tab definition]
// pos:    [course-scoped gradebook surface for local assessment scores, extracted assessment dialog and sortable table-head subcomponents, Calendar due-date sync, instance-local assessment-sort and plan-mode what-if UI state, exact-100 weight gating, animated mode-specific toolbar controls, and semantic empty-state feedback]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, isValid, parseISO } from 'date-fns';
import { ArrowRightLeft, CalendarDays, FlaskConical, GraduationCap, Pencil, Percent, Plus, Sparkles, Target, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { AppEmptyState } from '@/components/AppEmptyState';
import { DataTable, DataTableActionMenu, type ColumnDef } from '@/components/DataTable';
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
import {
    DropdownMenuItem,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { cn } from '@/lib/utils';
import { useCourseData } from '@/contexts/CourseDataContext';
import { useCourseGradebookMutation, useCourseGradebookQuery } from '@/hooks/useCourseGradebookQuery';
import { usePluginUiState } from '@/plugin-system';
import { publishTimetableScheduleChange } from '../builtin-event-core/shared/publishTimetableScheduleChange';
import { AssessmentDialog, createAssessmentDraft, type AssessmentDraft } from './components/AssessmentDialog';
import {
    BUILTIN_GRADEBOOK_TAB_TYPE,
    buildComputedGradebookSummary,
    buildPlanModeResult,
    buildSuggestedWhatIfScores,
    calculateGradebookGpa,
    hasCompleteGradebookWeight,
    formatGradebookDate,
    formatGradebookDateInput,
    formatGradebookGpaPercentage,
    formatPercent,
    getApiErrorMessage,
    getCategoryBadgeClassName,
    getCategoryBadgeStyle,
    getCategoryById,
    getRelativeDueText,
    isAssessmentOverdue,
    resolveTargetPercentageForGpa,
} from './shared';
type TargetInputMode = 'gpa' | 'percentage';

interface ParsedTargetDraftValue {
    targetGpa: number;
    targetPercentage: number | null;
}

interface GradebookPlanModeUiState {
    planMode: boolean;
    whatIfDrafts: Record<string, string>;
    targetInputMode: TargetInputMode;
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

const parseDraftDate = (value: string): Date | undefined => {
    if (!value) return undefined;
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : undefined;
};

const isBoundedPercentageInput = (value: string) => {
    if (!value.trim()) return true;
    if (!/^\d*\.?\d*$/.test(value)) return false;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
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
) : ParsedTargetDraftValue | null => {
    const parsed = Number(draftValue);
    if (!Number.isFinite(parsed)) return null;
    if (inputMode === 'percentage') {
        if (parsed < 0 || parsed > 100) return null;
        return {
            targetGpa: calculateGradebookGpa(parsed, gradebook.scaling_table) ?? 0,
            targetPercentage: parsed,
        };
    }
    return {
        targetGpa: parsed,
        targetPercentage: resolveTargetPercentageForGpa(parsed, gradebook.scaling_table),
    };
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
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
    const [isMutating, setIsMutating] = React.useState(false);
    const [assessmentDraft, setAssessmentDraft] = React.useState<AssessmentDraft | null>(null);
    const [assessmentDialogOpen, setAssessmentDialogOpen] = React.useState(false);
    const [pendingDeleteAssessment, setPendingDeleteAssessment] = React.useState<GradebookAssessment | null>(null);
    const [scoreDrafts, setScoreDrafts] = React.useState<Record<string, string>>({});
    const [weightDrafts, setWeightDrafts] = React.useState<Record<string, string>>({});
    const [dueDateDrafts, setDueDateDrafts] = React.useState<Record<string, string>>({});
    const [editingWeightAssessmentId, setEditingWeightAssessmentId] = React.useState<string | null>(null);
    const [editingDueDateAssessmentId, setEditingDueDateAssessmentId] = React.useState<string | null>(null);
    const [planModeIntroOpen, setPlanModeIntroOpen] = React.useState(false);
    const [planModeExitOpen, setPlanModeExitOpen] = React.useState(false);
    const [targetGpaDraft, setTargetGpaDraft] = React.useState('');
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
        setTargetGpaDraft((currentValue) => {
            if (targetInputMode === 'percentage' && currentValue.trim()) {
                return currentValue;
            }
            return formatTargetDraftValue(gradebook, targetInputMode);
        });
        setScoreDrafts(Object.fromEntries(
            gradebook.assessments.map((assessment) => [
                assessment.id,
                assessment.score === null || assessment.score === undefined ? '' : String(assessment.score),
            ]),
        ));
        setWeightDrafts(Object.fromEntries(
            gradebook.assessments.map((assessment) => [
                assessment.id,
                String(assessment.weight),
            ]),
        ));
        setDueDateDrafts(Object.fromEntries(
            gradebook.assessments.map((assessment) => [
                assessment.id,
                formatGradebookDateInput(assessment.due_date),
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
        return buildPlanModeResult(gradebook, parsed.targetGpa, parsed.targetPercentage, parsedWhatIfScores);
    }, [gradebook, parsedWhatIfScores, planMode, targetGpaDraft, targetInputMode]);

    const enterPlanMode = React.useCallback(() => {
        if (!hasCompleteWeight) {
            toast.error('Weights must total 100%.');
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
        if (parsed.targetGpa === gradebook.target_gpa) return;
        await commitGradebook(api.updateCourseGradebookPreferences(courseId, { target_gpa: parsed.targetGpa }));
    }, [commitGradebook, courseId, gradebook, targetGpaDraft, targetInputMode]);

    const handleRunPlan = React.useCallback(async () => {
        if (!gradebook) return;
        if (!hasCompleteGradebookWeight(gradebook)) {
            toast.error('Weights must total 100%.');
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
        const suggestions = buildSuggestedWhatIfScores(gradebook, parsed.targetPercentage);
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
        const parsedTargetGpa = parseTargetDraftValue(gradebook, targetGpaDraft, targetInputMode)?.targetGpa ?? gradebook.target_gpa;
        updatePlanModeState({ targetInputMode: nextInputMode });
        setTargetGpaDraft(formatTargetDraftValue(gradebook, nextInputMode, parsedTargetGpa));
    }, [gradebook, targetGpaDraft, targetInputMode, updatePlanModeState]);

    const handleSaveScore = React.useCallback(async (assessment: GradebookAssessment) => {
        if (!courseId || planMode) return;
        const nextValue = parseOptionalNumber(scoreDrafts[assessment.id] ?? '');
        if (nextValue !== null && (nextValue < 0 || nextValue > 100)) {
            setScoreDrafts((current) => ({
                ...current,
                [assessment.id]: assessment.score === null || assessment.score === undefined ? '' : String(assessment.score),
            }));
            toast.error('Score must stay between 0 and 100.');
            return;
        }
        if (nextValue === assessment.score) return;
        await commitGradebook(api.updateCourseGradebookAssessment(courseId, assessment.id, {
            score: nextValue,
            points_earned: null,
            points_possible: null,
        }));
    }, [commitGradebook, courseId, planMode, scoreDrafts]);

    const handleSaveWeight = React.useCallback(async (assessment: GradebookAssessment) => {
        if (!courseId || planMode) return;
        const rawValue = weightDrafts[assessment.id] ?? '';
        const parsedWeight = rawValue.trim() ? Number(rawValue) : 0;
        if (!Number.isFinite(parsedWeight) || parsedWeight < 0 || parsedWeight > 100) {
            setWeightDrafts((current) => ({
                ...current,
                [assessment.id]: String(assessment.weight),
            }));
            toast.error('Weight must stay between 0 and 100.');
            return;
        }
        setEditingWeightAssessmentId(null);
        if (parsedWeight === assessment.weight) return;
        await commitGradebook(api.updateCourseGradebookAssessment(courseId, assessment.id, {
            weight: parsedWeight,
        }));
    }, [commitGradebook, courseId, planMode, weightDrafts]);

    const handleSaveDueDate = React.useCallback(async (assessment: GradebookAssessment, nextDueDate: string) => {
        if (!courseId || planMode) return;
        setDueDateDrafts((current) => ({
            ...current,
            [assessment.id]: nextDueDate,
        }));
        setEditingDueDateAssessmentId(null);
        const normalizedDueDate = nextDueDate || '';
        const currentDueDate = formatGradebookDateInput(assessment.due_date);
        if (normalizedDueDate === currentDueDate) {
            return;
        }
        const didSave = await commitGradebook(api.updateCourseGradebookAssessment(courseId, assessment.id, {
            due_date: normalizedDueDate || null,
        }));
        if (!didSave) {
            setDueDateDrafts((current) => ({
                ...current,
                [assessment.id]: currentDueDate,
            }));
            return;
        }
        publishGradebookAssessmentCalendarRefresh(courseId, course?.semester_id);
    }, [commitGradebook, course?.semester_id, courseId, planMode]);

    const canManageAssessments = !planMode;
    const assessmentColumns: ColumnDef<GradebookAssessment>[] = !gradebook ? [] : [
            {
                key: 'title',
                label: 'Assessment',
                fit: 'fill',
                minWidth: 220,
                sortable: (left, right) => left.title.localeCompare(right.title),
                cellClassName: 'py-3',
                truncateCell: true,
                cell: (assessment) => (
                    <div className="min-w-0 truncate font-medium text-foreground" title={assessment.title}>
                        {assessment.title}
                    </div>
                ),
            },
            {
                key: 'category',
                label: 'Category',
                width: 132,
                sortable: (left, right) => {
                    const leftName = categoriesById.get(left.category_id ?? '')?.name ?? '';
                    const rightName = categoriesById.get(right.category_id ?? '')?.name ?? '';
                    return leftName.localeCompare(rightName);
                },
                cellClassName: 'py-3',
                cell: (assessment) => {
                    const category = getCategoryById(gradebook.categories, assessment.category_id);
                    return category ? (
                        <Badge
                            variant="outline"
                            className={cn('max-w-full select-none truncate border-0 px-2.5 py-0.5 text-xs font-medium', getCategoryBadgeClassName(category.color_token))}
                            style={getCategoryBadgeStyle(category.color_token)}
                            title={category.name}
                        >
                            {category.name}
                        </Badge>
                    ) : (
                        <span className="text-xs text-muted-foreground/60">Uncategorized</span>
                    );
                },
            },
            {
                key: 'due_date',
                label: 'Due',
                width: 156,
                sortable: (left, right) => (left.due_date ?? '9999-12-31').localeCompare(right.due_date ?? '9999-12-31'),
                cellClassName: 'py-3',
                cell: (assessment) => {
                    const dueDateValue = dueDateDrafts[assessment.id] ?? formatGradebookDateInput(assessment.due_date);
                    const dueDate = parseDraftDate(dueDateValue);
                    const overdue = assessment.due_date ? isAssessmentOverdue({
                        ...assessment,
                        due_date: dueDateValue || null,
                    }) : false;
                    return (
                        <Popover
                            open={editingDueDateAssessmentId === assessment.id}
                            onOpenChange={(open) => {
                                setEditingDueDateAssessmentId(open ? assessment.id : null);
                            }}
                        >
                            <PopoverTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-auto w-full justify-start px-0 py-0 text-left hover:bg-transparent"
                                    disabled={!canManageAssessments}
                                >
                                    <div className="flex min-h-8 w-full items-center">
                                        {dueDateValue ? (
                                            <div className="min-w-0 space-y-0.5">
                                                <div className={cn('text-sm', overdue ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-foreground')}>
                                                    {formatGradebookDate(dueDateValue)}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground">{getRelativeDueText(dueDateValue)}</div>
                                            </div>
                                        ) : (
                                            <div className="flex min-h-8 items-center gap-2 text-xs text-muted-foreground/60">
                                                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                                <span>No due date</span>
                                            </div>
                                        )}
                                    </div>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    autoFocus
                                    mode="single"
                                    selected={dueDate}
                                    onSelect={(date) => {
                                        void handleSaveDueDate(
                                            assessment,
                                            date ? format(date, 'yyyy-MM-dd') : '',
                                        );
                                    }}
                                />
                                {dueDateValue ? (
                                    <div className="flex justify-end border-t px-3 py-2">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                void handleSaveDueDate(assessment, '');
                                            }}
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                ) : null}
                            </PopoverContent>
                        </Popover>
                    );
                },
            },
            {
                key: 'weight',
                label: 'Weight',
                width: 96,
                align: 'right',
                sortable: (left, right) => left.weight - right.weight,
                cellClassName: 'py-3',
                cell: (assessment) => (
                    <div className="flex justify-end">
                        {editingWeightAssessmentId === assessment.id ? (
                            <Input
                                autoFocus
                                className="ml-auto h-8 w-24 text-right tabular-nums focus-visible:bg-background"
                                inputMode="decimal"
                                value={weightDrafts[assessment.id] ?? ''}
                                disabled={!canManageAssessments || isMutating}
                                onFocus={(event) => event.currentTarget.select()}
                                onChange={(event) => {
                                    const nextValue = event.target.value;
                                    if (!isBoundedPercentageInput(nextValue)) {
                                        return;
                                    }
                                    setWeightDrafts((current) => ({ ...current, [assessment.id]: nextValue }));
                                }}
                                onBlur={() => {
                                    void handleSaveWeight(assessment);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        void handleSaveWeight(assessment);
                                    }
                                    if (event.key === 'Escape') {
                                        setWeightDrafts((current) => ({
                                            ...current,
                                            [assessment.id]: String(assessment.weight),
                                        }));
                                        setEditingWeightAssessmentId(null);
                                    }
                                }}
                            />
                        ) : (
                            <Button
                                type="button"
                                variant="ghost"
                                className="ml-auto h-auto px-0 py-0 text-right tabular-nums hover:bg-transparent"
                                disabled={!canManageAssessments}
                                onClick={() => setEditingWeightAssessmentId(assessment.id)}
                            >
                                {formatPercent(assessment.weight)}
                            </Button>
                        )}
                    </div>
                ),
            },
            {
                key: 'score',
                label: planMode ? 'What If' : 'Score',
                width: 112,
                align: 'right',
                sortable: (left, right) => (left.score ?? -1) - (right.score ?? -1),
                cellClassName: 'py-3',
                cell: (assessment) => {
                    const isRealOnly = assessment.score !== null;
                    return (
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
                                if (!isBoundedPercentageInput(nextValue)) {
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
                    );
                },
            },
            {
                key: 'actions',
                label: 'Actions',
                width: 88,
                align: 'right',
                cell: (assessment) => (
                    <DataTableActionMenu
                        triggerLabel={`Open actions for ${assessment.title}`}
                        disabled={!canManageAssessments}
                    >
                        <DropdownMenuItem
                            disabled={!canManageAssessments}
                            onClick={() => {
                                setAssessmentDraft(createAssessmentDraft(gradebook, assessment));
                                setAssessmentDialogOpen(true);
                            }}
                        >
                            <Pencil className="h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            variant="destructive"
                            disabled={!canManageAssessments}
                            onClick={() => setPendingDeleteAssessment(assessment)}
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DataTableActionMenu>
                    ),
            },
        ];

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
                                    {planMode ? 'Grade · What If' : 'Grade'}
                                </p>
                            </div>
                            <div className="mt-0.5 truncate text-sm font-semibold tracking-tight sm:text-lg">
                                {course.hide_gpa ? '****' : showWeightMismatchState ? (
                                    <span className="text-rose-600 dark:text-rose-400">N/A</span>
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
                                    Weight {summary.total_weight.toFixed(1)}%. Need 100%.
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
                                    {planMode ? 'GPA · What If' : 'GPA'}
                                </p>
                            </div>
                            <div className="mt-0.5 truncate text-sm font-semibold tracking-tight sm:text-lg">
                                {course.hide_gpa ? '****' : showWeightMismatchState ? (
                                    <span className="text-rose-600 dark:text-rose-400">N/A</span>
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
                                    Set weights to 100%.
                                </p>
                            ) : null}
                        </div>
                    </div>
                </section>
            ) : null}

            <section className="space-y-3">
                <h2 className="text-lg font-semibold tracking-tight">Assessments</h2>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex h-11 w-full shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-start">
                            <Label htmlFor="gradebook-plan-mode" className="flex items-center gap-2 text-sm font-medium tracking-tight">
                                <Sparkles className={cn('h-4 w-4', planMode ? 'text-amber-500 dark:text-amber-400' : 'text-muted-foreground')} />
                                <span>Plan Mode</span>
                            </Label>
                            <Switch
                                id="gradebook-plan-mode"
                                checked={planMode}
                                onCheckedChange={handlePlanModeCheckedChange}
                                disabled={isMutating}
                                className="data-checked:bg-amber-500 data-unchecked:bg-slate-300/80 dark:data-unchecked:bg-slate-700"
                                aria-label="Toggle Plan Mode"
                            />
                        </div>

                        {planMode ? (
                            <div className="flex min-w-0 items-center gap-2">
                                <Target className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
                                <Label htmlFor="gradebook-target-gpa" className="shrink-0 text-sm font-medium whitespace-nowrap">
                                    Target
                                </Label>
                                <InputGroup className="min-w-0 flex-1 sm:w-32 sm:flex-none">
                                    <InputGroupInput
                                        id="gradebook-target-gpa"
                                        aria-label={targetInputMode === 'gpa' ? 'Target GPA' : 'Target %'}
                                        className="tabular-nums"
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
                                    />
                                    <InputGroupAddon align="inline-end">
                                        <InputGroupText>{targetInputMode === 'gpa' ? 'GPA' : '%'}</InputGroupText>
                                    </InputGroupAddon>
                                </InputGroup>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="shrink-0"
                                    onClick={handleToggleTargetInputMode}
                                    aria-label={targetInputMode === 'gpa' ? 'Switch target input to GPA Percentage' : 'Switch target input to GPA'}
                                    title={targetInputMode === 'gpa' ? 'Switch to GPA Percentage' : 'Switch to GPA'}
                                >
                                    <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" />
                                    <span>{targetInputMode === 'gpa' ? 'Use %' : 'Use GPA'}</span>
                                </Button>
                            </div>
                        ) : null}
                    </div>

                    <div className="w-full shrink-0 sm:w-auto">
                        <div className="relative w-full sm:w-[184px]">
                            <div
                                className={cn(
                                    'transition-all duration-200',
                                    planMode ? 'pointer-events-none invisible opacity-0' : 'opacity-100',
                                )}
                            >
                                <Button
                                    type="button"
                                    disabled={isMutating || planMode}
                                    className="w-full"
                                    onClick={() => {
                                        setAssessmentDraft(createAssessmentDraft(gradebook));
                                        setAssessmentDialogOpen(true);
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4 shrink-0" />
                                    <span>Add Assessment</span>
                                </Button>
                            </div>

                            <div
                                className={cn(
                                    'absolute inset-0 transition-all duration-200',
                                    planMode ? 'opacity-100' : 'pointer-events-none invisible opacity-0',
                                )}
                            >
                                <Button
                                    type="button"
                                    onClick={() => void handleRunPlan()}
                                    disabled={isMutating || !planMode}
                                    className="w-full bg-amber-500 text-amber-950 hover:bg-amber-400 disabled:bg-muted disabled:text-muted-foreground"
                                >
                                    <Sparkles className="mr-2 h-4 w-4 shrink-0" />
                                    <span>Auto-fill</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="min-h-[400px] rounded-md border bg-card flex flex-col overflow-hidden">
                    {gradebook.assessments.length === 0 ? (
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
                        <DataTable
                            title="Assessments"
                            description="Track weights, due dates, and scores for this course."
                            showHeader={false}
                            items={gradebook.assessments}
                            columns={assessmentColumns}
                            getRowKey={(assessment) => assessment.id}
                            sortPersistenceKey={courseId ? `gradebook-assessments:${courseId}` : undefined}
                            minWidthClassName="min-w-[54rem]"
                            maxBodyHeight={600}
                            freezeHeader
                            rootClassName="flex-1 space-y-0"
                            shellClassName="rounded-none border-0"
                            tableClassName="[&_th]:bg-card [&_td]:bg-card"
                        />
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

            <AlertDialog open={pendingDeleteAssessment !== null} onOpenChange={(open) => !open && setPendingDeleteAssessment(null)}>
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {pendingDeleteAssessment ? `Delete assessment ${pendingDeleteAssessment.title}?` : 'Delete assessment?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() => {
                                if (!pendingDeleteAssessment) return;
                                void commitGradebook(api.deleteCourseGradebookAssessment(courseId, pendingDeleteAssessment.id))
                                    .then((didDelete) => {
                                        if (!didDelete) return;
                                        publishGradebookAssessmentCalendarRefresh(courseId, course?.semester_id);
                                        setPendingDeleteAssessment(null);
                                    });
                            }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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
};
