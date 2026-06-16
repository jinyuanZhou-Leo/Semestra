import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { AppEmptyState } from '@/components/AppEmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import api, { type CourseGradebook, type GradebookAssessment } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';
import type { TabProps } from '@/plugin-system';
import { useCourseData } from '@/contexts/CourseDataContext';
import { useCourseGradebookMutation, useCourseGradebookQuery } from '@/hooks/useCourseGradebookQuery';
import { usePluginUiState } from '@/plugin-system';

import { AssessmentDialog, createAssessmentDraft, type AssessmentDraft } from './components/AssessmentDialog';
import {
    CourseAssessmentsTable,
    useCourseAssessmentColumns,
} from './components/CourseAssessmentsTable';
import { CourseFinalGradeSection } from './components/CourseFinalGradeSection';
import { CourseGradebookActionBar } from './components/CourseGradebookActionBar';
import { CourseGradebookConfirmDialogs } from './components/PlanModeDialogs';
import { CourseGradebookHeaderStats } from './components/CourseGradebookHeaderStats';
import { PlanModeDialogs } from './components/PlanModeDialogs';
import {
    buildComputedGradebookSummary,
    buildPlanModeResult,
    buildSuggestedWhatIfScores,
    formatGradebookDateInput,
    getApiErrorMessage,
    hasCompleteGradebookWeight,
} from './shared';
import {
    formatTargetDraftValue,
    getGradebookAssessmentFingerprint,
    type GradebookPlanModeUiState,
    parseOptionalNumber,
    parseTargetDraftValue,
    publishGradebookAssessmentCalendarRefresh,
    type TargetInputMode,
} from './utils/gradebookTabUtils';

export const CourseGradebookTab: React.FC<TabProps> = ({ courseId }) => {
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
    const [editingScoreAssessmentId, setEditingScoreAssessmentId] = React.useState<string | null>(null);
    const [editingWeightAssessmentId, setEditingWeightAssessmentId] = React.useState<string | null>(null);
    const [editingDueDateAssessmentId, setEditingDueDateAssessmentId] = React.useState<string | null>(null);
    const [planModeIntroOpen, setPlanModeIntroOpen] = React.useState(false);
    const [planModeExitOpen, setPlanModeExitOpen] = React.useState(false);
    const [targetGpaDraft, setTargetGpaDraft] = React.useState('');
    const [finalGradeConfirmOpen, setFinalGradeConfirmOpen] = React.useState(false);
    const [finalGradeRemoveConfirmOpen, setFinalGradeRemoveConfirmOpen] = React.useState(false);
    const [finalGradeDraft, setFinalGradeDraft] = React.useState('');
    const [finalGradeError, setFinalGradeError] = React.useState<string | null>(null);
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
        setScoreDrafts((current) => Object.fromEntries(
            gradebook.assessments.map((assessment) => [
                assessment.id,
                assessment.id === editingScoreAssessmentId
                    ? (current[assessment.id] ?? '')
                    : (assessment.score === null || assessment.score === undefined ? '' : String(assessment.score)),
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
        setFinalGradeDraft(gradebook.final_grade_percentage_override == null ? '' : String(gradebook.final_grade_percentage_override));
    }, [gradebook, targetInputMode, editingScoreAssessmentId]);

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
            if (nextSummary.effective_percentage !== null && nextSummary.effective_gpa !== null) {
                updateCourse({
                    grade_percentage: nextSummary.effective_percentage,
                    grade_scaled: nextSummary.effective_gpa,
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
    const hasFinalGradeOverride = summary?.has_final_grade_override ?? false;

    const parsedWhatIfScores = React.useMemo(
        () => Object.fromEntries(
            Object.entries(whatIfDrafts)
                .map(([assessmentId, value]) => [assessmentId, parseOptionalNumber(value)])
                .filter((entry): entry is [string, number] => entry[1] !== null),
        ),
        [whatIfDrafts],
    );

    const whatIfResult = React.useMemo(() => {
        if (!gradebook || !planMode || Object.keys(parsedWhatIfScores).length === 0) return null;
        if (!hasCompleteGradebookWeight(gradebook)) return null;
        const parsed = parseTargetDraftValue(gradebook, targetGpaDraft, targetInputMode);
        if (parsed === null) return null;
        return buildPlanModeResult(gradebook, parsed.targetGpa, parsed.targetPercentage, parsedWhatIfScores);
    }, [gradebook, parsedWhatIfScores, planMode, targetGpaDraft, targetInputMode]);

    const enterPlanMode = React.useCallback(() => {
        if (hasFinalGradeOverride) {
            toast.error('Remove the final grade override before using Plan Mode.');
            return;
        }
        if (!hasCompleteWeight) {
            toast.error('Weights must total 100%.');
            return;
        }
        updatePlanModeState({ planMode: true });
        setPlanModeIntroOpen(false);
    }, [hasCompleteWeight, hasFinalGradeOverride, updatePlanModeState]);

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
            const selectedAssignments = (lmsAssignmentsQuery.data?.items ?? [])
                .filter((assignment) => assessmentDraft.selected_lms_assignment_ids.includes(assignment.external_id));
            setIsMutating(true);
            let latestGradebook: CourseGradebook | null = null;
            try {
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
            } catch (error: unknown) {
                console.error('Failed to add LMS assignments to gradebook', error);
                toast.error(getApiErrorMessage(error));
                setIsMutating(false);
                return;
            }
            if (!latestGradebook) {
                toast.error('No LMS assignments were selected.');
                setIsMutating(false);
                return;
            }
            const success = await commitGradebook(Promise.resolve(latestGradebook));
            if (!success) return;
            publishGradebookAssessmentCalendarRefresh(courseId, course?.semester_id);
            toast.success(`Added ${selectedAssignments.length} LMS assessment${selectedAssignments.length === 1 ? '' : 's'} to Gradebook.`);
            setAssessmentDialogOpen(false);
            setAssessmentDraft(null);
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

    const parseFinalGradeDraft = React.useCallback(() => {
        const parsed = parseOptionalNumber(finalGradeDraft);
        if (parsed === null || parsed < 0 || parsed > 100) {
            setFinalGradeError('Enter a percentage between 0 and 100.');
            return null;
        }
        return parsed;
    }, [finalGradeDraft]);

    const handleSetFinalGradeClick = React.useCallback(() => {
        setFinalGradeDraft('');
        setFinalGradeError(null);
        setFinalGradeConfirmOpen(true);
    }, []);

    const handleSaveFinalGradeOverride = React.useCallback(async (nextValue?: number) => {
        if (!courseId || !gradebook) return;
        const parsed = nextValue ?? parseFinalGradeDraft();
        if (parsed === null) return;
        if (parsed === gradebook.final_grade_percentage_override) return;
        const didSave = await commitGradebook(api.updateCourseGradebookPreferences(courseId, {
            final_grade_percentage_override: parsed,
        }));
        if (!didSave) return;
        setFinalGradeError(null);
        setFinalGradeConfirmOpen(false);
    }, [commitGradebook, courseId, gradebook, parseFinalGradeDraft]);

    const handleSaveExistingFinalGradeOverride = React.useCallback(async () => {
        if (!summary?.has_final_grade_override) return;
        await handleSaveFinalGradeOverride();
    }, [handleSaveFinalGradeOverride, summary?.has_final_grade_override]);

    const handleClearFinalGradeOverride = React.useCallback(async () => {
        if (!courseId || !gradebook) return;
        const didSave = await commitGradebook(api.updateCourseGradebookPreferences(courseId, {
            final_grade_percentage_override: null,
        }));
        if (!didSave) return;
        if (summary?.current_real_percentage === null || summary?.current_real_gpa === null) {
            updateCourse({
                grade_percentage: 0,
                grade_scaled: 0,
            });
        }
        setFinalGradeDraft('');
        setFinalGradeError(null);
        setFinalGradeConfirmOpen(false);
        setFinalGradeRemoveConfirmOpen(false);
    }, [commitGradebook, courseId, gradebook, summary?.current_real_gpa, summary?.current_real_percentage, updateCourse]);

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

    const openAddAssessmentDialog = React.useCallback(() => {
        if (!gradebook) return;
        setAssessmentDraft(createAssessmentDraft(gradebook));
        setAssessmentDialogOpen(true);
    }, [gradebook]);

    const canManageAssessments = !planMode;

    const assessmentTableActions = React.useMemo(() => ({
        setScoreDrafts,
        setWeightDrafts,
        setDueDateDrafts,
        setEditingScoreAssessmentId,
        setEditingWeightAssessmentId,
        setEditingDueDateAssessmentId,
        setWhatIfDrafts: (patch: Record<string, string>) => {
            setPlanModeUiState((currentState) => ({
                ...currentState,
                whatIfDrafts: {
                    ...currentState.whatIfDrafts,
                    ...patch,
                },
            }));
        },
        onSaveScore: (assessment: GradebookAssessment) => void handleSaveScore(assessment),
        onSaveWeight: (assessment: GradebookAssessment) => void handleSaveWeight(assessment),
        onSaveDueDate: (assessment: GradebookAssessment, nextDueDate: string) => void handleSaveDueDate(assessment, nextDueDate),
        onEditAssessment: (assessment: GradebookAssessment) => {
            if (!gradebook) return;
            setAssessmentDraft(createAssessmentDraft(gradebook, assessment));
            setAssessmentDialogOpen(true);
        },
        onDeleteAssessment: setPendingDeleteAssessment,
        onAddAssessment: openAddAssessmentDialog,
    }), [
        gradebook,
        handleSaveDueDate,
        handleSaveScore,
        handleSaveWeight,
        openAddAssessmentDialog,
        setPlanModeUiState,
    ]);

    const assessmentColumns = useCourseAssessmentColumns({
        gradebook,
        categoriesById,
        state: {
            planMode,
            canManageAssessments,
            isMutating,
            scoreDrafts,
            weightDrafts,
            dueDateDrafts,
            whatIfDrafts,
            editingScoreAssessmentId,
            editingWeightAssessmentId,
            editingDueDateAssessmentId,
        },
        actions: assessmentTableActions,
    });

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

    const showWeightMismatchState = Boolean(course && summary && !summary.has_complete_weight && !summary.has_final_grade_override);

    return (
        <div className="space-y-4">
            {course ? (
                <CourseGradebookHeaderStats
                    course={course}
                    summary={summary}
                    planMode={planMode}
                    whatIfResult={whatIfResult}
                    showWeightMismatchState={showWeightMismatchState}
                />
            ) : null}

            <CourseFinalGradeSection
                summary={summary}
                finalGradeDraft={finalGradeDraft}
                finalGradeError={finalGradeError}
                isMutating={isMutating}
                onFinalGradeDraftChange={(value) => {
                    setFinalGradeDraft(value);
                    setFinalGradeError(null);
                }}
                onSaveExistingFinalGradeOverride={handleSaveExistingFinalGradeOverride}
                onSetFinalGradeClick={handleSetFinalGradeClick}
                onRemoveFinalGradeClick={() => setFinalGradeRemoveConfirmOpen(true)}
            />

            <section className="space-y-3">
                <h2 className="text-lg font-semibold tracking-tight">Assessments</h2>

                <CourseGradebookActionBar
                    planMode={planMode}
                    targetInputMode={targetInputMode}
                    targetGpaDraft={targetGpaDraft}
                    isMutating={isMutating}
                    hasFinalGradeOverride={hasFinalGradeOverride}
                    onPlanModeCheckedChange={handlePlanModeCheckedChange}
                    onTargetGpaDraftChange={setTargetGpaDraft}
                    onPersistTargetGpa={handlePersistTargetGpa}
                    onToggleTargetInputMode={handleToggleTargetInputMode}
                    onAddAssessment={openAddAssessmentDialog}
                    onRunPlan={handleRunPlan}
                />

                <CourseAssessmentsTable
                    courseId={courseId}
                    gradebook={gradebook}
                    columns={assessmentColumns}
                    planMode={planMode}
                    isMutating={isMutating}
                    onAddAssessment={openAddAssessmentDialog}
                />
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

            <CourseGradebookConfirmDialogs
                finalGradeConfirmOpen={finalGradeConfirmOpen}
                finalGradeRemoveConfirmOpen={finalGradeRemoveConfirmOpen}
                pendingDeleteAssessment={pendingDeleteAssessment}
                finalGradeDraft={finalGradeDraft}
                finalGradeError={finalGradeError}
                isMutating={isMutating}
                onFinalGradeConfirmOpenChange={setFinalGradeConfirmOpen}
                onFinalGradeRemoveConfirmOpenChange={setFinalGradeRemoveConfirmOpen}
                onPendingDeleteAssessmentChange={setPendingDeleteAssessment}
                onFinalGradeDraftChange={(value) => {
                    setFinalGradeDraft(value);
                    setFinalGradeError(null);
                }}
                onSaveFinalGradeOverride={() => void handleSaveFinalGradeOverride()}
                onClearFinalGradeOverride={() => void handleClearFinalGradeOverride()}
                onConfirmDeleteAssessment={() => {
                    if (!pendingDeleteAssessment || !courseId) return;
                    void commitGradebook(api.deleteCourseGradebookAssessment(courseId, pendingDeleteAssessment.id))
                        .then((didDelete) => {
                            if (!didDelete) return;
                            publishGradebookAssessmentCalendarRefresh(courseId, course?.semester_id);
                            setPendingDeleteAssessment(null);
                        });
                }}
            />

            <PlanModeDialogs
                introOpen={planModeIntroOpen}
                exitOpen={planModeExitOpen}
                onIntroOpenChange={setPlanModeIntroOpen}
                onExitOpenChange={setPlanModeExitOpen}
                onEnterPlanMode={enterPlanMode}
                onExitPlanMode={exitPlanMode}
                scope="course"
            />
        </div>
    );
};
