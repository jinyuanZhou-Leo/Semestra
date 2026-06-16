// input:  [visible semester records with courses, unassigned course aggregates, hide_gpa flag]
// output: [sorted semester lists and chart-ready GPA/credits series for Program overview charts]
// pos:    [Pure data transforms for Program Dashboard stats charts]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { ChartConfig } from '@/components/ui/chart';
import type { Course, Semester } from '@/services/api';

export type StatsSemester = Semester & { courses?: Course[] };

export type SemesterGpaPoint = {
    label: string;
    semesterKey: string;
    gpa: number;
};

export type SemesterCreditsPoint = {
    label: string;
    semesterKey: string;
    credits: number;
    courses: number;
};

export const GPA_CHART_CONFIG = {
    gpa: {
        label: 'GPA',
        color: 'var(--chart-1)',
    },
} satisfies ChartConfig;

export const CREDITS_CHART_CONFIG = {
    credits: {
        label: 'Credits',
        color: 'var(--chart-2)',
    },
} satisfies ChartConfig;

const UNASSIGNED_LABEL = 'Unassigned';
const UNASSIGNED_KEY = '__unassigned__';

export function truncateSemesterLabel(label: string, maxLength = 8): string {
    if (label.length <= maxLength) {
        return label;
    }
    return `${label.slice(0, maxLength - 1)}…`;
}

export function sortSemestersByChronology(semesters: StatsSemester[]): StatsSemester[] {
    return [...semesters].sort((left, right) => {
        const leftDate = left.start_date ?? '';
        const rightDate = right.start_date ?? '';

        if (leftDate && rightDate && leftDate !== rightDate) {
            return leftDate.localeCompare(rightDate);
        }

        if (leftDate && !rightDate) {
            return -1;
        }

        if (!leftDate && rightDate) {
            return 1;
        }

        return left.name.localeCompare(right.name);
    });
}

export function sumSemesterCredits(courses: Course[] | undefined): number {
    return (courses ?? []).reduce((sum, course) => sum + (course.credits ?? 0), 0);
}

export function buildSemesterGpaSeries(
    semesters: StatsSemester[],
    hideGpa: boolean,
): SemesterGpaPoint[] {
    if (hideGpa) {
        return [];
    }

    return sortSemestersByChronology(semesters).map((semester) => ({
        label: semester.name,
        semesterKey: semester.id,
        gpa: semester.average_scaled,
    }));
}

export function buildCreditsBySemester(
    semesters: StatsSemester[],
    unassignedCredits: number,
    unassignedCourseCount: number,
): SemesterCreditsPoint[] {
    const points = sortSemestersByChronology(semesters).map((semester) => ({
        label: semester.name,
        semesterKey: semester.id,
        credits: sumSemesterCredits(semester.courses),
        courses: semester.courses?.length ?? 0,
    }));

    if (unassignedCourseCount > 0) {
        points.push({
            label: UNASSIGNED_LABEL,
            semesterKey: UNASSIGNED_KEY,
            credits: unassignedCredits,
            courses: unassignedCourseCount,
        });
    }

    return points;
}
