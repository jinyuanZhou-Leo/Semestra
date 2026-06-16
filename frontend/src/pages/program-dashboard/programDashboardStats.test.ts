// input:  [Vitest runtime and Program Dashboard stats transform exports]
// output: [Regression tests for semester ordering and chart series aggregation]
// pos:    [Program Dashboard stats data-layer test coverage]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it } from 'vitest';

import {
    buildCreditsBySemester,
    buildSemesterGpaSeries,
    sortSemestersByChronology,
    sumSemesterCredits,
    truncateSemesterLabel,
} from './programDashboardStats';
import type { StatsSemester } from './programDashboardStats';

const createSemester = (
    id: string,
    name: string,
    options: {
        startDate?: string;
        averageScaled?: number;
        courses?: StatsSemester['courses'];
    } = {},
): StatsSemester => ({
    id,
    name,
    start_date: options.startDate,
    average_scaled: options.averageScaled ?? 3.5,
    average_percentage: 85,
    courses: options.courses,
    runtime: {
        runtime_tabs: [],
        tab_catalog_items: [],
        widget_catalog_items: [],
        enabled_plugin_ids: [],
        enabled_plugins: [],
        available_widget_types: [],
    },
});

describe('programDashboardStats', () => {
    it('sorts semesters by start_date ascending with name fallback', () => {
        const semesters = [
            createSemester('b', 'Fall 2025', { startDate: '2025-09-01' }),
            createSemester('a', 'Winter 2025', { startDate: '2025-01-01' }),
            createSemester('c', 'Alpha', {}),
            createSemester('d', 'Beta', {}),
        ];

        expect(sortSemestersByChronology(semesters).map((semester) => semester.id)).toEqual([
            'a',
            'b',
            'c',
            'd',
        ]);
    });

    it('builds GPA series in chronological order and respects hide_gpa', () => {
        const semesters = [
            createSemester('b', 'Fall 2025', { startDate: '2025-09-01', averageScaled: 3.8 }),
            createSemester('a', 'Winter 2025', { startDate: '2025-01-01', averageScaled: 3.2 }),
        ];

        expect(buildSemesterGpaSeries(semesters, false)).toEqual([
            { label: 'Winter 2025', semesterKey: 'a', gpa: 3.2 },
            { label: 'Fall 2025', semesterKey: 'b', gpa: 3.8 },
        ]);
        expect(buildSemesterGpaSeries(semesters, true)).toEqual([]);
    });

    it('aggregates credits per semester and appends unassigned bucket', () => {
        const semesters = [
            createSemester('a', 'Winter 2025', {
                startDate: '2025-01-01',
                courses: [
                    { id: 'c1', name: 'CS 101', credits: 3, grade_scaled: 4, grade_percentage: 90, program_id: 'p1', runtime: { runtime_tabs: [], tab_catalog_items: [], widget_catalog_items: [], enabled_plugin_ids: [], enabled_plugins: [], available_widget_types: [] } },
                    { id: 'c2', name: 'MAT 180', credits: 1.5, grade_scaled: 3.7, grade_percentage: 87, program_id: 'p1', runtime: { runtime_tabs: [], tab_catalog_items: [], widget_catalog_items: [], enabled_plugin_ids: [], enabled_plugins: [], available_widget_types: [] } },
                ],
            }),
            createSemester('b', 'Fall 2025', {
                startDate: '2025-09-01',
                courses: [
                    { id: 'c3', name: 'PHY 201', credits: 4, grade_scaled: 3.5, grade_percentage: 82, program_id: 'p1', runtime: { runtime_tabs: [], tab_catalog_items: [], widget_catalog_items: [], enabled_plugin_ids: [], enabled_plugins: [], available_widget_types: [] } },
                ],
            }),
        ];

        expect(sumSemesterCredits(semesters[0].courses)).toBe(4.5);
        expect(buildCreditsBySemester(semesters, 2, 1)).toEqual([
            { label: 'Winter 2025', semesterKey: 'a', credits: 4.5, courses: 2 },
            { label: 'Fall 2025', semesterKey: 'b', credits: 4, courses: 1 },
            { label: 'Unassigned', semesterKey: '__unassigned__', credits: 2, courses: 1 },
        ]);
        expect(buildCreditsBySemester(semesters, 0, 0)).toHaveLength(2);
    });

    it('truncates long semester labels for chart ticks', () => {
        expect(truncateSemesterLabel('Fall 24')).toBe('Fall 24');
        expect(truncateSemesterLabel('Very Long Semester Name')).toBe('Very Lo…');
    });
});
