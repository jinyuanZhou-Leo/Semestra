import React from 'react';
import { toast } from 'sonner';

import { AppEmptyState } from '@/components/AppEmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import type { TabProps } from '@/plugin-system';
import { useSemesterData } from '@/contexts/SemesterDataContext';
import { usePluginUiState } from '@/plugin-system';
import { parseSubjectColorMap } from '@/utils/courseCategoryBadge';

import { PlanModeDialogs } from './components/PlanModeDialogs';
import {
    SemesterCoursesTable,
    SemesterGradebookActionBar,
    SemesterGradebookHeaderStats,
    useSemesterCourseColumns,
} from './components/SemesterGradebookSections';
import {
    buildSemesterGradebookPlanResult,
    buildSemesterGradebookSummary,
    calculateGradebookGpa,
    resolveTargetPercentageForGpa,
} from './shared';
import {
    isBoundedPercentageInput,
    parseOptionalNumber,
    parseScalingTableJson,
    type SemesterGradebookPlanModeUiState,
    type TargetInputMode,
} from './utils/gradebookTabUtils';

export const SemesterGradebookTab: React.FC<TabProps> = ({ semesterId }) => {
    const { semester, isLoading } = useSemesterData();
    const {
        state: planModeState,
        setState: setPlanModeState,
    } = usePluginUiState<SemesterGradebookPlanModeUiState>('semester-gradebook-plan-mode', () => ({
        planMode: false,
        whatIfDrafts: {},
        targetInputMode: 'gpa',
        targetDraft: '3.7',
    }));
    const [planModeIntroOpen, setPlanModeIntroOpen] = React.useState(false);
    const [planModeExitOpen, setPlanModeExitOpen] = React.useState(false);

    const courses = React.useMemo(() => semester?.courses ?? [], [semester?.courses]);
    const scalingTable = parseScalingTableJson(semester?.program?.gpa_scaling_table);
    const resolvedSubjectColorMap = parseSubjectColorMap(semester?.program?.subject_color_map);
    const summary = buildSemesterGradebookSummary(courses);
    const whatIfScores = Object.fromEntries(
        Object.entries(planModeState.whatIfDrafts)
            .map(([courseId, value]) => [courseId, parseOptionalNumber(value)] as const)
            .filter((entry): entry is readonly [string, number] => entry[1] !== null),
    );
    const parsedTarget = parseOptionalNumber(planModeState.targetDraft);
    const targetPercentage = parsedTarget === null
        ? null
        : planModeState.targetInputMode === 'gpa'
            ? resolveTargetPercentageForGpa(parsedTarget, scalingTable)
            : parsedTarget;
    const planResult = buildSemesterGradebookPlanResult(courses, whatIfScores, scalingTable, targetPercentage);
    const displayedPercentage = planModeState.planMode ? planResult.projected_percentage : summary.current_percentage;
    const displayedGpa = planModeState.planMode ? planResult.projected_gpa : summary.current_gpa;

    const updatePlanModeState = React.useCallback((patch: Partial<SemesterGradebookPlanModeUiState>) => {
        setPlanModeState((currentState) => ({
            ...currentState,
            ...patch,
        }));
    }, [setPlanModeState]);

    const handleWhatIfChange = React.useCallback((courseId: string, value: string) => {
        if (!isBoundedPercentageInput(value)) return;
        setPlanModeState((currentState) => ({
            ...currentState,
            whatIfDrafts: {
                ...currentState.whatIfDrafts,
                [courseId]: value,
            },
        }));
    }, [setPlanModeState]);

    const handleToggleTargetInputMode = React.useCallback(() => {
        const nextInputMode: TargetInputMode = planModeState.targetInputMode === 'gpa' ? 'percentage' : 'gpa';
        const parsed = parseOptionalNumber(planModeState.targetDraft);
        const nextDraft = parsed === null
            ? ''
            : nextInputMode === 'percentage'
                ? String(resolveTargetPercentageForGpa(parsed, scalingTable) ?? '')
                : String(calculateGradebookGpa(parsed, scalingTable) ?? '');
        updatePlanModeState({
            targetInputMode: nextInputMode,
            targetDraft: nextDraft,
        });
    }, [planModeState.targetDraft, planModeState.targetInputMode, scalingTable, updatePlanModeState]);

    const enterPlanMode = React.useCallback(() => {
        updatePlanModeState({ planMode: true });
        setPlanModeIntroOpen(false);
    }, [updatePlanModeState]);

    const exitPlanMode = React.useCallback(() => {
        updatePlanModeState({ planMode: false, whatIfDrafts: {} });
        setPlanModeExitOpen(false);
    }, [updatePlanModeState]);

    const handlePlanModeCheckedChange = React.useCallback((checked: boolean) => {
        if (checked) {
            setPlanModeIntroOpen(true);
            return;
        }
        setPlanModeExitOpen(true);
    }, []);

    const handleAutoFill = React.useCallback(() => {
        if (targetPercentage === null) {
            toast.error(`Enter a ${planModeState.targetInputMode === 'gpa' ? 'GPA' : 'percentage'} target before running Auto-fill.`);
            return;
        }
        const includedCourses = courses.filter(
            (course) => course.include_in_gpa !== false && Number(course.credits) > 0,
        );
        const gradedCourses = includedCourses.filter((course) => Number(course.grade_percentage || 0) > 0);
        const ungradedCourses = includedCourses.filter((course) => Number(course.grade_percentage || 0) <= 0);
        const totalCredits = includedCourses.reduce((sum, c) => sum + Number(c.credits), 0);
        const ungradedCredits = ungradedCourses.reduce((sum, c) => sum + Number(c.credits), 0);
        if (ungradedCredits <= 0) return;
        const gradedContribution = gradedCourses.reduce(
            (sum, c) => sum + Number(c.grade_percentage) * Number(c.credits),
            0,
        );
        const requiredPercentage = Math.max(
            0,
            Math.min(100, (targetPercentage * totalCredits - gradedContribution) / ungradedCredits),
        );
        const nextDrafts = { ...planModeState.whatIfDrafts };
        ungradedCourses.forEach((course) => {
            nextDrafts[course.id] = String(requiredPercentage);
        });
        updatePlanModeState({ whatIfDrafts: nextDrafts });
    }, [courses, planModeState.targetInputMode, planModeState.whatIfDrafts, targetPercentage, updatePlanModeState]);

    const courseColumns = useSemesterCourseColumns({
        planMode: planModeState.planMode,
        whatIfDrafts: planModeState.whatIfDrafts,
        subjectColorMap: resolvedSubjectColorMap,
        onWhatIfChange: handleWhatIfChange,
    });

    if (!semesterId) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="section"
                title="Gradebook unavailable"
                description="This tab requires a semester context."
            />
        );
    }

    if (isLoading && !semester) {
        return (
            <div className="flex flex-col gap-4">
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-[420px] w-full rounded-lg" />
            </div>
        );
    }

    if (!semester) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="section"
                title="Gradebook failed to load"
                description="Semester data is unavailable."
            />
        );
    }

    return (
        <div className="space-y-4">
            <SemesterGradebookHeaderStats
                planMode={planModeState.planMode}
                displayedPercentage={displayedPercentage}
                displayedGpa={displayedGpa}
            />

            <section className="space-y-3">
                <h2 className="text-lg font-semibold tracking-tight">Semester Gradebook</h2>

                <SemesterGradebookActionBar
                    planModeState={planModeState}
                    onPlanModeCheckedChange={handlePlanModeCheckedChange}
                    onTargetDraftChange={(value) => updatePlanModeState({ targetDraft: value })}
                    onToggleTargetInputMode={handleToggleTargetInputMode}
                    onAutoFill={handleAutoFill}
                />

                <SemesterCoursesTable
                    semesterId={semesterId}
                    courses={courses}
                    summary={summary}
                    columns={courseColumns}
                />
            </section>

            <PlanModeDialogs
                introOpen={planModeIntroOpen}
                exitOpen={planModeExitOpen}
                onIntroOpenChange={setPlanModeIntroOpen}
                onExitOpenChange={setPlanModeExitOpen}
                onEnterPlanMode={enterPlanMode}
                onExitPlanMode={exitPlanMode}
                scope="semester"
            />
        </div>
    );
};
