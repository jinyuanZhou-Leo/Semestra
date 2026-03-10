// input:  [course-list global settings runtime, mocked semester API responses, and testing-library helpers]
// output: [test suite validating stale-response protection and guarded course-manager entry states]
// pos:    [Plugin-level regression tests for the course-list global settings surface]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import api from '../../services/api';
import { CourseListGlobalSettings } from './globalSettings';

const { toastError } = vi.hoisted(() => ({
    toastError: vi.fn(),
}));

vi.mock('sonner', () => ({
    toast: {
        error: toastError,
    },
}));

vi.mock('@/components/CourseManagerModal', () => ({
    CourseManagerModal: ({
        isOpen,
        programId,
    }: {
        isOpen: boolean;
        programId: string;
    }) => (isOpen ? <div data-testid="course-manager-modal">{programId}</div> : null),
}));

const buildSemesterResponse = (semesterId: string, courseName: string, programId = 'program-1') => ({
    id: semesterId,
    name: `Semester ${semesterId}`,
    average_scaled: 0,
    average_percentage: 0,
    program_id: programId,
    widgets: [],
    tabs: [],
    courses: [
        {
            id: `${semesterId}-course`,
            name: courseName,
            alias: `${semesterId.toUpperCase()}101`,
            category: 'Core',
            credits: 3,
            grade_scaled: 3.9,
            grade_percentage: 95,
            program_id: programId,
        },
    ],
});

const createDeferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((innerResolve, innerReject) => {
        resolve = innerResolve;
        reject = innerReject;
    });
    return { promise, resolve, reject };
};

const buildPluginSettingsProps = (semesterId: string) => ({
    semesterId,
    settings: {},
    updateSettings: vi.fn(),
    saveState: 'idle' as const,
    hasPendingChanges: false,
    isLoading: false,
    onRefresh: vi.fn(),
});

describe('CourseListGlobalSettings', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        toastError.mockReset();
    });

    it('ignores stale semester responses after the context changes', async () => {
        const firstSemester = createDeferred<ReturnType<typeof buildSemesterResponse>>();
        const secondSemester = createDeferred<ReturnType<typeof buildSemesterResponse>>();

        vi.spyOn(api, 'getSemester').mockImplementation((semesterId: string) => {
            if (semesterId === 'semester-1') return firstSemester.promise;
            if (semesterId === 'semester-2') return secondSemester.promise;
            throw new Error(`Unexpected semester ${semesterId}`);
        });

        const { rerender } = render(
            <CourseListGlobalSettings {...buildPluginSettingsProps('semester-1')} />
        );

        rerender(<CourseListGlobalSettings {...buildPluginSettingsProps('semester-2')} />);

        secondSemester.resolve(buildSemesterResponse('semester-2', 'Physics'));
        expect(await screen.findByText('Physics')).toBeInTheDocument();

        firstSemester.resolve(buildSemesterResponse('semester-1', 'Algebra'));
        await waitFor(() => {
            expect(screen.queryByText('Algebra')).not.toBeInTheDocument();
        });
        expect(screen.getByText('Physics')).toBeInTheDocument();
    });

    it('keeps the course manager entry disabled when semester details fail to load', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(api, 'getSemester').mockRejectedValueOnce(new Error('Semester unavailable'));

        render(<CourseListGlobalSettings {...buildPluginSettingsProps('semester-1')} />);

        expect(await screen.findByText('Could not refresh semester courses')).toBeInTheDocument();

        const manageButton = screen.getByRole('button', { name: '+ Add / Manage Courses' });
        expect(manageButton).toBeDisabled();

        fireEvent.click(manageButton);
        expect(screen.queryByTestId('course-manager-modal')).not.toBeInTheDocument();
        expect(toastError).not.toHaveBeenCalled();
    });
});
