import type { Course, CourseGradebook, GradebookAssessment, GradebookScalingTable } from '@/services/api';
import { DEFAULT_GPA_SCALING_TABLE_JSON } from '@/utils/gpaUtils';
import { publishTimetableScheduleChange } from '../../builtin-event-core/shared/publishTimetableScheduleChange';
import {
    calculateGradebookGpa,
    resolveTargetPercentageForGpa,
} from '../shared';

export type TargetInputMode = 'gpa' | 'percentage';

export interface ParsedTargetDraftValue {
    targetGpa: number;
    targetPercentage: number | null;
}

export interface GradebookPlanModeUiState {
    planMode: boolean;
    whatIfDrafts: Record<string, string>;
    targetInputMode: TargetInputMode;
}

export interface SemesterGradebookPlanModeUiState {
    planMode: boolean;
    whatIfDrafts: Record<string, string>;
    targetInputMode: TargetInputMode;
    targetDraft: string;
}

export const publishGradebookAssessmentCalendarRefresh = async (courseId: string, semesterId?: string) => {
    await publishTimetableScheduleChange({
        source: 'course',
        reason: 'gradebook-assessments-updated',
        courseId,
        semesterId,
    });
};

export const parseOptionalNumber = (value: string): number | null => {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

export const isBoundedPercentageInput = (value: string) => {
    if (!value.trim()) return true;
    if (!/^\d*\.?\d*$/.test(value)) return false;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
};

export const getGradebookAssessmentFingerprint = (assessment: Pick<GradebookAssessment, 'title' | 'due_date'>) => {
    return `${assessment.title.trim().toLowerCase()}::${assessment.due_date ?? ''}`;
};

export const formatTargetDraftValue = (
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

export const parseTargetDraftValue = (
    gradebook: CourseGradebook,
    draftValue: string,
    inputMode: TargetInputMode,
): ParsedTargetDraftValue | null => {
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

export const parseScalingTableJson = (value: string | undefined | null): GradebookScalingTable => {
    const rawValue = value?.trim() || DEFAULT_GPA_SCALING_TABLE_JSON;
    try {
        const parsed = JSON.parse(rawValue) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return JSON.parse(DEFAULT_GPA_SCALING_TABLE_JSON) as GradebookScalingTable;
        }
        return Object.fromEntries(
            Object.entries(parsed)
                .map(([key, rawGpa]) => [key, Number(rawGpa)] as const)
                .filter(([, gpa]) => Number.isFinite(gpa)),
        );
    } catch {
        return JSON.parse(DEFAULT_GPA_SCALING_TABLE_JSON) as GradebookScalingTable;
    }
};

export const getSemesterCourseDisplayName = (course: Course) => course.alias?.trim() || course.name;
