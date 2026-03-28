// input:  [`CourseManagerModal`, mocked API/auth/dialog hooks, and testing-library form interactions]
// output: [regression tests covering close-after-create/add/import behavior when post-submit refresh work fails]
// pos:    [Component regression suite that ensures successful Program or wizard course mutations close the modal when configured even if parent refresh work rejects afterward]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { CourseManagerModal } from '@/components/CourseManagerModal';

const { apiMock, alertMock, confirmMock } = vi.hoisted(() => ({
  apiMock: {
    createCourse: vi.fn(),
    createCourseForProgram: vi.fn(),
    getCoursesForProgram: vi.fn(),
    getProgram: vi.fn(),
    importProgramLmsCourses: vi.fn(),
    listProgramLmsCourses: vi.fn(),
    updateCourse: vi.fn(),
    uploadProgramCourseICS: vi.fn(),
  },
  alertMock: vi.fn(),
  confirmMock: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  default: apiMock,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      default_course_credit: 0.5,
    },
  }),
}));

vi.mock('@/contexts/DialogContext', () => ({
  useDialog: () => ({
    alert: alertMock,
    confirm: confirmMock,
  }),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

describe('CourseManagerModal', () => {
  beforeEach(() => {
    apiMock.createCourse.mockReset();
    apiMock.createCourseForProgram.mockReset();
    apiMock.getCoursesForProgram.mockReset();
    apiMock.getProgram.mockReset();
    apiMock.importProgramLmsCourses.mockReset();
    apiMock.listProgramLmsCourses.mockReset();
    apiMock.updateCourse.mockReset();
    apiMock.uploadProgramCourseICS.mockReset();
    alertMock.mockReset();
    confirmMock.mockReset();

    apiMock.getCoursesForProgram.mockResolvedValue([]);
    apiMock.getProgram.mockResolvedValue({ lms_integration_id: null });
    apiMock.updateCourse.mockResolvedValue({});
    apiMock.createCourseForProgram.mockResolvedValue({});
    apiMock.createCourse.mockResolvedValue({});
    apiMock.uploadProgramCourseICS.mockResolvedValue({});
  });

  it('closes after creating a Program course even when post-create refresh fails', async () => {
    const onClose = vi.fn();
    const onCourseAdded = vi.fn().mockRejectedValue(new Error('refresh failed'));

    render(
      <CourseManagerModal
        isOpen
        onClose={onClose}
        programId="program-1"
        onCourseAdded={onCourseAdded}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Course Name/i), {
      target: { value: 'Intro to Systems' },
    });

    fireEvent.submit(screen.getByRole('button', { name: 'Create Course' }).closest('form')!);

    await waitFor(() => {
      expect(apiMock.createCourseForProgram).toHaveBeenCalledWith('program-1', expect.objectContaining({
        name: 'Intro to Systems',
      }));
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    expect(onCourseAdded).toHaveBeenCalledTimes(1);
    expect(alertMock).not.toHaveBeenCalled();
  });

  it('closes after adding an existing Semester course when closeOnSuccess is enabled', async () => {
    const onClose = vi.fn();
    const onCourseAdded = vi.fn().mockRejectedValue(new Error('refresh failed'));

    apiMock.getCoursesForProgram.mockImplementation((_programId: string, options?: { unassigned?: boolean }) => {
      if (options?.unassigned) {
        return Promise.resolve([
          {
            id: 'course-1',
            name: 'Discrete Mathematics',
            alias: null,
            category: 'MATH',
            credits: 0.5,
            grade_percentage: 92,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    render(
      <CourseManagerModal
        isOpen
        onClose={onClose}
        programId="program-1"
        semesterId="semester-1"
        closeOnSuccess
        onCourseAdded={onCourseAdded}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(apiMock.updateCourse).toHaveBeenCalledWith('course-1', { semester_id: 'semester-1' });
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    expect(onCourseAdded).toHaveBeenCalledTimes(1);
    expect(alertMock).not.toHaveBeenCalled();
  });
});
