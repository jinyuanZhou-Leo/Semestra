// input:  [Canvas navigation tab runtime, mocked course context, mocked Canvas LMS APIs, and testing-library assertions/interactions]
// output: [regression tests for builtin-canvas-integration empty-state handling, host-aligned unavailable layouts, tab filtering, home fallback routing, external/unknown CTA rendering, native quizzes or syllabus views, and all-open collapsible module/page interactions]
// pos:    [Canvas integration tab regression suite for supported Canvas navigation flows, optimized module rendering, and unavailable-state alignment]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as courseDataContext from '@/contexts/CourseDataContext';
import api from '@/services/api';
import { createQueryClientWrapper } from '@/test/queryClientWrapper';
import { CanvasPagesTab } from './tab';

vi.mock('@/services/api', () => ({
    default: {
        getCourseLmsNavigation: vi.fn(),
        getCourseLmsAnnouncements: vi.fn(),
        getCourseLmsModules: vi.fn(),
        getCourseLmsPages: vi.fn(),
        getCourseLmsPage: vi.fn(),
        getCourseLmsQuizzes: vi.fn(),
        getCourseLmsSyllabus: vi.fn(),
    },
}));

vi.mock('@/contexts/CourseDataContext', () => ({
    useCourseData: vi.fn(),
}));

vi.mock('@/lib/html', () => ({
    sanitizeCanvasHtmlFragment: (value: string) => value,
}));

const renderCanvasTab = () => {
    const { Wrapper } = createQueryClientWrapper();
    return render(
        <CanvasPagesTab tabId="tab-1" courseId="course-1" settings={{}} updateSettings={vi.fn()} />,
        { wrapper: Wrapper },
    );
};

const mockLinkedCanvasCourse = () => {
    vi.mocked(courseDataContext.useCourseData).mockReturnValue({
        course: {
            lms_link: {
                provider: 'canvas',
                external_course_id: 'canvas-course-1',
            },
        },
        isLoading: false,
    } as never);
};

describe('CanvasPagesTab', () => {
    beforeEach(() => {
        mockLinkedCanvasCourse();
        vi.mocked(api.getCourseLmsAnnouncements).mockResolvedValue({ items: [] });
        vi.mocked(api.getCourseLmsModules).mockResolvedValue({ items: [] });
        vi.mocked(api.getCourseLmsPages).mockResolvedValue({ items: [] });
        vi.mocked(api.getCourseLmsPage).mockResolvedValue({
            page_id: 1,
            url: 'front-page',
            title: 'Front Page',
            updated_at: '2026-03-21T10:00:00Z',
            published: true,
            front_page: true,
            html_url: 'https://canvas.example.edu/courses/canvas-course-1/pages/front-page',
            body: '<p>Front body</p>',
            locked_for_user: false,
            lock_explanation: null,
            editing_roles: null,
        });
        vi.mocked(api.getCourseLmsQuizzes).mockResolvedValue({ items: [] });
        vi.mocked(api.getCourseLmsSyllabus).mockResolvedValue({
            body: '<p>Syllabus body</p>',
            html_url: 'https://canvas.example.edu/courses/1/assignments/syllabus',
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('shows a Canvas connection prompt when the course is not linked', () => {
        vi.mocked(courseDataContext.useCourseData).mockReturnValue({
            course: { lms_link: null },
            isLoading: false,
        } as never);

        renderCanvasTab();

        expect(screen.getByText('Link this course to Canvas in course settings to browse its course navigation here.')).toBeInTheDocument();
        expect(screen.getByText('Canvas unavailable').closest('[data-slot="empty"]')?.className).not.toContain('my-16');
    });

    it('filters assignments grades files and discussion tabs from the rail', async () => {
        vi.mocked(api.getCourseLmsNavigation).mockResolvedValue({
            default_view: 'modules',
            front_page_url: 'https://canvas.example.edu/courses/1/pages/front-page',
            tabs: [
                { tab_id: 'home', label: 'Home', html_url: 'https://canvas.example.edu/courses/1', hidden: false, position: 1, tab_type: 'internal', active: true },
                { tab_id: 'assignments', label: 'Assignments', html_url: 'https://canvas.example.edu/courses/1/assignments', hidden: false, position: 2, tab_type: 'internal', active: false },
                { tab_id: 'grades', label: 'Grades', html_url: 'https://canvas.example.edu/courses/1/grades', hidden: false, position: 3, tab_type: 'internal', active: false },
                { tab_id: 'files', label: 'Files', html_url: 'https://canvas.example.edu/courses/1/files', hidden: false, position: 4, tab_type: 'internal', active: false },
                { tab_id: 'discussion_topics', label: 'Discussions', html_url: 'https://canvas.example.edu/courses/1/discussion_topics', hidden: false, position: 5, tab_type: 'internal', active: false },
                { tab_id: 'modules', label: 'Modules', html_url: 'https://canvas.example.edu/courses/1/modules', hidden: false, position: 6, tab_type: 'internal', active: false },
                { tab_id: 'pages', label: 'Pages', html_url: 'https://canvas.example.edu/courses/1/pages', hidden: false, position: 7, tab_type: 'internal', active: false },
                { tab_id: 'quizzes', label: 'Quizzes', html_url: 'https://canvas.example.edu/courses/1/quizzes', hidden: false, position: 8, tab_type: 'internal', active: false },
                { tab_id: 'syllabus', label: 'Syllabus', html_url: 'https://canvas.example.edu/courses/1/assignments/syllabus', hidden: false, position: 9, tab_type: 'internal', active: false },
            ],
        });
        vi.mocked(api.getCourseLmsModules).mockResolvedValue({
            items: [
                {
                    module_id: 'module-1',
                    name: 'Week 1',
                    position: 1,
                    published: true,
                    state: 'active',
                    unlock_at: null,
                    items: [],
                },
            ],
        });

        renderCanvasTab();

        expect(await screen.findByText('Week 1')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Modules' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Pages' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Quizzes' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Syllabus' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Assignments' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Grades' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Files' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Discussions' })).not.toBeInTheDocument();
        expect(screen.getByText('Canvas course menu').closest('aside')).toHaveStyle({ top: '180px' });
    });

    it('falls back home from a hidden default_view to the first supported visible section', async () => {
        vi.mocked(api.getCourseLmsNavigation).mockResolvedValue({
            default_view: 'assignments',
            front_page_url: 'https://canvas.example.edu/courses/1/pages/front-page',
            tabs: [
                { tab_id: 'home', label: 'Home', html_url: 'https://canvas.example.edu/courses/1', hidden: false, position: 1, tab_type: 'internal', active: true },
                { tab_id: 'pages', label: 'Pages', html_url: 'https://canvas.example.edu/courses/1/pages', hidden: false, position: 2, tab_type: 'internal', active: false },
                { tab_id: 'modules', label: 'Modules', html_url: 'https://canvas.example.edu/courses/1/modules', hidden: false, position: 3, tab_type: 'internal', active: false },
            ],
        });
        vi.mocked(api.getCourseLmsPages).mockResolvedValue({
            items: [
                {
                    page_id: 1,
                    url: 'front-page',
                    title: 'Front Page',
                    updated_at: '2026-03-21T10:00:00Z',
                    published: true,
                    front_page: true,
                    html_url: 'https://canvas.example.edu/courses/canvas-course-1/pages/front-page',
                },
            ],
        });

        renderCanvasTab();

        expect(await screen.findByText('Front body')).toBeInTheDocument();
        expect(api.getCourseLmsPage).toHaveBeenCalledWith('course-1', 'front-page');
    });

    it('keeps modules collapsible while preserving page navigation and external-link emphasis', async () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

        vi.mocked(api.getCourseLmsNavigation).mockResolvedValue({
            default_view: 'modules',
            front_page_url: null,
            tabs: [
                { tab_id: 'home', label: 'Home', html_url: 'https://canvas.example.edu/courses/1', hidden: false, position: 1, tab_type: 'internal', active: true },
                { tab_id: 'modules', label: 'Modules', html_url: 'https://canvas.example.edu/courses/1/modules', hidden: false, position: 2, tab_type: 'internal', active: false },
                { tab_id: 'pages', label: 'Pages', html_url: 'https://canvas.example.edu/courses/1/pages', hidden: false, position: 3, tab_type: 'internal', active: false },
            ],
        });
        vi.mocked(api.getCourseLmsModules).mockResolvedValue({
            items: [
                {
                    module_id: 'module-1',
                    name: 'Week 1',
                    position: 1,
                    published: true,
                    state: 'active',
                    unlock_at: null,
                    items: [
                        {
                            module_item_id: 'item-1',
                            title: 'Course Overview',
                            item_type: 'Page',
                            content_id: 'page-1',
                            html_url: 'https://canvas.example.edu/courses/canvas-course-1/pages/course-overview',
                            url: '/courses/canvas-course-1/pages/course-overview',
                            position: 1,
                            indent: 0,
                            published: true,
                            completion_requirement_type: 'must_view',
                            new_tab: false,
                        },
                        {
                            module_item_id: 'item-2',
                            title: 'Reference PDF',
                            item_type: 'File',
                            content_id: 'file-1',
                            html_url: 'https://canvas.example.edu/courses/canvas-course-1/files/1',
                            url: '/courses/canvas-course-1/files/1',
                            position: 2,
                            indent: 0,
                            published: false,
                            completion_requirement_type: null,
                            new_tab: true,
                        },
                    ],
                },
            ],
        });
        vi.mocked(api.getCourseLmsPages).mockResolvedValue({
            items: [
                {
                    page_id: 2,
                    url: 'course-overview',
                    title: 'Course Overview',
                    updated_at: '2026-03-20T10:00:00Z',
                    published: true,
                    front_page: false,
                    html_url: 'https://canvas.example.edu/courses/canvas-course-1/pages/course-overview',
                },
            ],
        });
        vi.mocked(api.getCourseLmsPage).mockResolvedValue({
            page_id: 2,
            url: 'course-overview',
            title: 'Course Overview',
            updated_at: '2026-03-20T10:00:00Z',
            published: true,
            front_page: false,
            html_url: 'https://canvas.example.edu/courses/canvas-course-1/pages/course-overview',
            body: '<p>Overview body</p>',
            locked_for_user: false,
            lock_explanation: null,
            editing_roles: null,
        });

        renderCanvasTab();

        expect(await screen.findByText('Week 1')).toBeInTheDocument();
        expect(screen.getByText('Course Overview')).toBeInTheDocument();
        expect(screen.queryByText('Page')).not.toBeInTheDocument();
        expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
        expect(screen.queryByText('must view')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Week 1' }));

        await waitFor(() => {
            expect(screen.queryByText('Course Overview')).not.toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Week 1' }));

        expect(await screen.findByText('Course Overview')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Course Overview'));

        expect(await screen.findByText('Overview body')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Modules' }));

        const externalLinkTitle = await screen.findByText('Reference PDF');
        expect(externalLinkTitle.className).toContain('hover:underline');

        fireEvent.click(externalLinkTitle);

        expect(openSpy).toHaveBeenCalledWith('https://canvas.example.edu/courses/canvas-course-1/files/1', '_blank', 'noopener,noreferrer');
        openSpy.mockRestore();
    });

    it('renders all modules expanded by default while preserving manual collapse', async () => {
        vi.mocked(api.getCourseLmsNavigation).mockResolvedValue({
            default_view: 'modules',
            front_page_url: null,
            tabs: [
                { tab_id: 'home', label: 'Home', html_url: 'https://canvas.example.edu/courses/1', hidden: false, position: 1, tab_type: 'internal', active: true },
                { tab_id: 'modules', label: 'Modules', html_url: 'https://canvas.example.edu/courses/1/modules', hidden: false, position: 2, tab_type: 'internal', active: false },
            ],
        });
        vi.mocked(api.getCourseLmsModules).mockResolvedValue({
            items: [
                {
                    module_id: 'module-1',
                    name: 'Week 1',
                    position: 1,
                    published: true,
                    state: 'active',
                    unlock_at: null,
                    items: [
                        {
                            module_item_id: 'item-1',
                            title: 'Course Overview',
                            item_type: 'Page',
                            content_id: 'page-1',
                            html_url: 'https://canvas.example.edu/courses/canvas-course-1/pages/course-overview',
                            url: '/courses/canvas-course-1/pages/course-overview',
                            position: 1,
                            indent: 0,
                            published: true,
                            completion_requirement_type: 'must_view',
                            new_tab: false,
                        },
                    ],
                },
                {
                    module_id: 'module-2',
                    name: 'Week 2',
                    position: 2,
                    published: true,
                    state: 'active',
                    unlock_at: null,
                    items: [
                        {
                            module_item_id: 'item-2',
                            title: 'Lecture Slides',
                            item_type: 'File',
                            content_id: 'file-2',
                            html_url: 'https://canvas.example.edu/courses/canvas-course-1/files/2',
                            url: '/courses/canvas-course-1/files/2',
                            position: 1,
                            indent: 0,
                            published: true,
                            completion_requirement_type: null,
                            new_tab: true,
                        },
                    ],
                },
            ],
        });

        renderCanvasTab();

        expect(await screen.findByText('Course Overview')).toBeInTheDocument();
        expect(screen.getByText('Week 2')).toBeInTheDocument();
        expect(screen.getByText('Lecture Slides')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Week 2' }));

        await waitFor(() => {
            expect(screen.queryByText('Lecture Slides')).not.toBeInTheDocument();
        });
    });

    it('renders locked Canvas pages with an alert callout', async () => {
        vi.mocked(api.getCourseLmsNavigation).mockResolvedValue({
            default_view: 'pages',
            front_page_url: null,
            tabs: [
                { tab_id: 'home', label: 'Home', html_url: 'https://canvas.example.edu/courses/1', hidden: false, position: 1, tab_type: 'internal', active: true },
                { tab_id: 'pages', label: 'Pages', html_url: 'https://canvas.example.edu/courses/1/pages', hidden: false, position: 2, tab_type: 'internal', active: false },
            ],
        });
        vi.mocked(api.getCourseLmsPages).mockResolvedValue({
            items: [
                {
                    page_id: 9,
                    url: 'locked-page',
                    title: 'Locked Page',
                    updated_at: '2026-03-20T10:00:00Z',
                    published: true,
                    front_page: false,
                    html_url: 'https://canvas.example.edu/courses/canvas-course-1/pages/locked-page',
                },
            ],
        });
        vi.mocked(api.getCourseLmsPage).mockResolvedValue({
            page_id: 9,
            url: 'locked-page',
            title: 'Locked Page',
            updated_at: '2026-03-20T10:00:00Z',
            published: true,
            front_page: false,
            html_url: 'https://canvas.example.edu/courses/canvas-course-1/pages/locked-page',
            body: '<p>Locked page body</p>',
            locked_for_user: true,
            lock_explanation: 'This page unlocks next week.',
            editing_roles: null,
        });

        renderCanvasTab();

        fireEvent.click(await screen.findByRole('button', { name: 'Pages' }));
        fireEvent.click(await screen.findByText('Locked Page'));

        expect(await screen.findByText('Locked in Canvas')).toBeInTheDocument();
        expect(screen.getByText('This page unlocks next week.')).toBeInTheDocument();
    });

    it('shows a fallback empty state when home only points to hidden tabs', async () => {
        vi.mocked(api.getCourseLmsNavigation).mockResolvedValue({
            default_view: 'grades',
            front_page_url: null,
            tabs: [
                { tab_id: 'home', label: 'Home', html_url: 'https://canvas.example.edu/courses/1', hidden: false, position: 1, tab_type: 'internal', active: true },
                { tab_id: 'grades', label: 'Grades', html_url: 'https://canvas.example.edu/courses/1/grades', hidden: false, position: 2, tab_type: 'internal', active: false },
            ],
        });

        renderCanvasTab();

        expect(await screen.findByText('Canvas home unavailable')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Open in Canvas' })).toHaveAttribute('href', 'https://canvas.example.edu/courses/1');
    });

    it('renders external tabs as a launch prompt instead of a confirmation dialog', async () => {
        vi.mocked(api.getCourseLmsNavigation).mockResolvedValue({
            default_view: 'modules',
            front_page_url: null,
            tabs: [
                { tab_id: 'home', label: 'Home', html_url: 'https://canvas.example.edu/courses/1', hidden: false, position: 1, tab_type: 'internal', active: true },
                { tab_id: 'modules', label: 'Modules', html_url: 'https://canvas.example.edu/courses/1/modules', hidden: false, position: 2, tab_type: 'internal', active: false },
                { tab_id: 'publisher', label: 'Publisher', html_url: 'https://publisher.example.edu/tool', hidden: false, position: 3, tab_type: 'external', active: false },
            ],
        });
        vi.mocked(api.getCourseLmsModules).mockResolvedValue({
            items: [
                {
                    module_id: 'module-1',
                    name: 'Week 1',
                    position: 1,
                    published: true,
                    state: 'active',
                    unlock_at: null,
                    items: [],
                },
            ],
        });

        renderCanvasTab();

        expect(await screen.findByText('Week 1')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Publisher' }));

        expect(await screen.findByText('Publisher opens on an external website')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Open external website' })).toHaveAttribute('href', 'https://publisher.example.edu/tool');
        expect(screen.queryByText('Open Publisher in Canvas?')).not.toBeInTheDocument();
    });

    it('renders unknown internal tabs with a fallback open-in-canvas prompt', async () => {
        vi.mocked(api.getCourseLmsNavigation).mockResolvedValue({
            default_view: 'modules',
            front_page_url: null,
            tabs: [
                { tab_id: 'home', label: 'Home', html_url: 'https://canvas.example.edu/courses/1', hidden: false, position: 1, tab_type: 'internal', active: true },
                { tab_id: 'modules', label: 'Modules', html_url: 'https://canvas.example.edu/courses/1/modules', hidden: false, position: 2, tab_type: 'internal', active: false },
                { tab_id: 'attendance', label: 'Attendance', html_url: 'https://canvas.example.edu/courses/1/attendance', hidden: false, position: 3, tab_type: 'internal', active: false },
            ],
        });
        vi.mocked(api.getCourseLmsModules).mockResolvedValue({
            items: [
                {
                    module_id: 'module-1',
                    name: 'Week 1',
                    position: 1,
                    published: true,
                    state: 'active',
                    unlock_at: null,
                    items: [],
                },
            ],
        });

        renderCanvasTab();

        expect(await screen.findByText('Week 1')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Attendance' }));

        expect(await screen.findByText('Attendance is not available in Semestra')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Open in Canvas' })).toHaveAttribute('href', 'https://canvas.example.edu/courses/1/attendance');
    });

    it('renders quizzes in a native list view', async () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

        vi.mocked(api.getCourseLmsNavigation).mockResolvedValue({
            default_view: 'modules',
            front_page_url: null,
            tabs: [
                { tab_id: 'home', label: 'Home', html_url: 'https://canvas.example.edu/courses/1', hidden: false, position: 1, tab_type: 'internal', active: true },
                { tab_id: 'modules', label: 'Modules', html_url: 'https://canvas.example.edu/courses/1/modules', hidden: false, position: 2, tab_type: 'internal', active: false },
                { tab_id: 'quizzes', label: 'Quizzes', html_url: 'https://canvas.example.edu/courses/1/quizzes', hidden: false, position: 3, tab_type: 'internal', active: false },
            ],
        });
        vi.mocked(api.getCourseLmsModules).mockResolvedValue({
            items: [
                {
                    module_id: 'module-1',
                    name: 'Week 1',
                    position: 1,
                    published: true,
                    state: 'active',
                    unlock_at: null,
                    items: [],
                },
            ],
        });
        vi.mocked(api.getCourseLmsQuizzes).mockResolvedValue({
            items: [
                {
                    quiz_id: 'quiz-1',
                    title: 'Week 1 Quiz',
                    description: '<p>Quiz description.</p>',
                    due_at: '2026-03-25T12:00:00Z',
                    unlock_at: null,
                    lock_at: null,
                    html_url: 'https://canvas.example.edu/courses/1/quizzes/1',
                    published: true,
                },
            ],
        });

        renderCanvasTab();

        expect(await screen.findByText('Week 1')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Quizzes' }));

        expect(await screen.findByText('Week 1 Quiz')).toBeInTheDocument();
        expect(screen.queryByText('Published')).not.toBeInTheDocument();
        expect(screen.getByText('Week 1 Quiz').className).toContain('hover:underline');
        expect(screen.queryByTitle('Quizzes Canvas content')).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('Week 1 Quiz'));

        expect(openSpy).toHaveBeenCalledWith('https://canvas.example.edu/courses/1/quizzes/1', '_blank', 'noopener,noreferrer');
        openSpy.mockRestore();
    });

    it('renders syllabus in a native view', async () => {
        vi.mocked(api.getCourseLmsNavigation).mockResolvedValue({
            default_view: 'modules',
            front_page_url: null,
            tabs: [
                { tab_id: 'home', label: 'Home', html_url: 'https://canvas.example.edu/courses/1', hidden: false, position: 1, tab_type: 'internal', active: true },
                { tab_id: 'modules', label: 'Modules', html_url: 'https://canvas.example.edu/courses/1/modules', hidden: false, position: 2, tab_type: 'internal', active: false },
                { tab_id: 'syllabus', label: 'Syllabus', html_url: 'https://canvas.example.edu/courses/1/assignments/syllabus', hidden: false, position: 3, tab_type: 'internal', active: false },
            ],
        });
        vi.mocked(api.getCourseLmsModules).mockResolvedValue({
            items: [
                {
                    module_id: 'module-1',
                    name: 'Week 1',
                    position: 1,
                    published: true,
                    state: 'active',
                    unlock_at: null,
                    items: [],
                },
            ],
        });
        vi.mocked(api.getCourseLmsSyllabus).mockResolvedValue({
            body: '<p>Syllabus overview</p>',
            html_url: 'https://canvas.example.edu/courses/1/assignments/syllabus',
        });

        renderCanvasTab();

        expect(await screen.findByText('Week 1')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Syllabus' }));

        await waitFor(() => {
            expect(screen.getByText('Syllabus overview')).toBeInTheDocument();
        });
        expect(screen.queryByTitle('Syllabus Canvas content')).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Open in Canvas' })).toHaveAttribute('href', 'https://canvas.example.edu/courses/1/assignments/syllabus');
    });
});
