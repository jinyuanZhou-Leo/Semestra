// input:  [CourseList widget runtime, MemoryRouter, mocked semester API responses, and testing-library helpers]
// output: [test suite validating course-list loading, Program color fetch coordination, and retry/error states]
// pos:    [Plugin-level regression tests for explicit course-list UX feedback behavior and subject-color fetches]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import api from '../../services/api';
import { CourseList } from './widget';

const semesterResponse = {
    id: 'semester-1',
    name: 'Fall 2026',
    average_scaled: 0,
    average_percentage: 0,
    program_id: 'program-1',
    widgets: [],
    tabs: [],
    courses: [
        {
            id: 'course-1',
            name: 'Algorithms',
            alias: 'CS301',
            category: 'Core',
            credits: 3,
            grade_scaled: 3.9,
            grade_percentage: 95,
            program_id: 'program-1',
        },
    ],
};

const renderCourseList = () => {
    return render(
        <MemoryRouter>
            <CourseList
                widgetId="course-list-1"
                settings={{}}
                semesterId="semester-1"
                updateSettings={vi.fn()}
            />
        </MemoryRouter>
    );
};

describe('CourseList widget', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows a loading state before semester courses resolve', async () => {
        let resolveSemester: ((value: typeof semesterResponse) => void) | undefined;
        const pendingSemester = new Promise<typeof semesterResponse>((resolve) => {
            resolveSemester = resolve;
        });

        vi.spyOn(api, 'getSemester').mockReturnValue(pendingSemester);
        vi.spyOn(api, 'getProgram').mockResolvedValue({
            id: 'program-1',
            name: 'Engineering',
            cgpa_scaled: 0,
            cgpa_percentage: 0,
            grad_requirement_credits: 20,
            subject_color_map: '{"CORE":"#2563eb"}',
            semesters: [],
        });

        renderCourseList();

        expect(screen.getByText('Loading courses...')).toBeInTheDocument();

        resolveSemester?.(semesterResponse);

        expect(await screen.findByText('Algorithms')).toBeInTheDocument();
        expect(screen.queryByText('Loading courses...')).not.toBeInTheDocument();
    });

    it('shows an error alert and retries successfully', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const getSemester = vi.spyOn(api, 'getSemester')
            .mockRejectedValueOnce(new Error('Backend unavailable'))
            .mockResolvedValueOnce(semesterResponse);
        vi.spyOn(api, 'getProgram').mockResolvedValue({
            id: 'program-1',
            name: 'Engineering',
            cgpa_scaled: 0,
            cgpa_percentage: 0,
            grad_requirement_credits: 20,
            subject_color_map: '{}',
            semesters: [],
        });

        renderCourseList();

        expect(await screen.findByText('Could not load courses')).toBeInTheDocument();
        expect(screen.getByText('Backend unavailable')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

        expect(await screen.findByText('Algorithms')).toBeInTheDocument();
        expect(getSemester).toHaveBeenCalledTimes(2);
    });
});
