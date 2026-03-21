// input:  [Canvas navigation tab runtime, mocked course context, mocked Canvas LMS APIs, and testing-library assertions/interactions]
// output: [regression tests for builtin-canvas-integration empty-state handling, Home landing behavior, announcements, and in-tab Canvas page navigation]
// pos:    [Canvas integration tab regression suite]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
    },
}));

vi.mock('@/contexts/CourseDataContext', () => ({
    useCourseData: vi.fn(),
}));

vi.mock('@/lib/html', () => ({
    sanitizeCanvasHtmlFragment: (value: string) => value,
}));

describe('CanvasPagesTab', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('shows a Canvas connection prompt when the course is not linked', () => {
        vi.mocked(courseDataContext.useCourseData).mockReturnValue({
            course: { lms_link: null },
            isLoading: false,
        } as never);

        const { Wrapper } = createQueryClientWrapper();
        render(
            <CanvasPagesTab tabId="tab-1" courseId="course-1" settings={{}} updateSettings={vi.fn()} />,
            { wrapper: Wrapper },
        );

        expect(screen.getByText('Link this course to Canvas in course settings to browse its course navigation here.')).toBeInTheDocument();
    });

    it('renders Canvas navigation and uses the Canvas home landing view for modules', async () => {
        vi.mocked(courseDataContext.useCourseData).mockReturnValue({
            course: {
                lms_link: {
                    provider: 'canvas',
                    external_course_id: 'canvas-course-1',
                },
            },
            isLoading: false,
        } as never);

        vi.mocked(api.getCourseLmsNavigation).mockResolvedValue({
            default_view: 'modules',
            front_page_url: null,
            tabs: [
                { tab_id: 'home', label: 'Home', html_url: 'https://canvas.example.edu/courses/1', hidden: false, position: 1, tab_type: 'internal', active: true },
                { tab_id: 'announcements', label: 'Announcements', html_url: 'https://canvas.example.edu/courses/1/announcements', hidden: false, position: 2, tab_type: 'internal', active: false },
                { tab_id: 'modules', label: 'Modules', html_url: 'https://canvas.example.edu/courses/1/modules', hidden: false, position: 3, tab_type: 'internal', active: false },
                { tab_id: 'pages', label: 'Pages', html_url: 'https://canvas.example.edu/courses/1/pages', hidden: false, position: 4, tab_type: 'internal', active: false },
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
            ],
        });

        const { Wrapper } = createQueryClientWrapper();
        render(
            <CanvasPagesTab tabId="tab-1" courseId="course-1" settings={{}} updateSettings={vi.fn()} />,
            { wrapper: Wrapper },
        );

        expect(await screen.findByRole('button', { name: 'Home' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Announcements' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Modules' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Pages' })).toBeInTheDocument();
        expect(await screen.findByText('Week 1')).toBeInTheDocument();
        expect(screen.getByText('Course Overview')).toBeInTheDocument();
    });

    it('loads announcements when the navigation section changes', async () => {
        vi.mocked(courseDataContext.useCourseData).mockReturnValue({
            course: {
                lms_link: {
                    provider: 'canvas',
                    external_course_id: 'canvas-course-1',
                },
            },
            isLoading: false,
        } as never);

        vi.mocked(api.getCourseLmsNavigation).mockResolvedValue({
            default_view: 'wiki',
            front_page_url: 'https://canvas.example.edu/courses/1/pages/front-page',
            tabs: [
                { tab_id: 'home', label: 'Home', html_url: 'https://canvas.example.edu/courses/1', hidden: false, position: 1, tab_type: 'internal', active: true },
                { tab_id: 'announcements', label: 'Announcements', html_url: 'https://canvas.example.edu/courses/1/announcements', hidden: false, position: 2, tab_type: 'internal', active: false },
                { tab_id: 'modules', label: 'Modules', html_url: 'https://canvas.example.edu/courses/1/modules', hidden: false, position: 3, tab_type: 'internal', active: false },
                { tab_id: 'pages', label: 'Pages', html_url: 'https://canvas.example.edu/courses/1/pages', hidden: false, position: 4, tab_type: 'internal', active: false },
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
        vi.mocked(api.getCourseLmsAnnouncements).mockResolvedValue({
            items: [
                {
                    announcement_id: 'announcement-1',
                    title: 'Welcome',
                    body: '<p>Announcement body</p>',
                    posted_at: '2026-03-21T11:00:00Z',
                    updated_at: '2026-03-21T11:05:00Z',
                    html_url: 'https://canvas.example.edu/courses/1/announcements/1',
                },
            ],
        });

        const { Wrapper } = createQueryClientWrapper();
        render(
            <CanvasPagesTab tabId="tab-1" courseId="course-1" settings={{}} updateSettings={vi.fn()} />,
            { wrapper: Wrapper },
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Announcements' }));

        expect(await screen.findByText('Welcome')).toBeInTheDocument();
        expect(screen.getByText('Announcement body')).toBeInTheDocument();
    });

    it('defaults to the front page and navigates within the tab for same-course Canvas links', async () => {
        vi.mocked(courseDataContext.useCourseData).mockReturnValue({
            course: {
                lms_link: {
                    provider: 'canvas',
                    external_course_id: 'canvas-course-1',
                },
            },
            isLoading: false,
        } as never);

        vi.mocked(api.getCourseLmsNavigation).mockResolvedValue({
            default_view: 'wiki',
            front_page_url: 'https://canvas.example.edu/courses/1/pages/front-page',
            tabs: [
                { tab_id: 'home', label: 'Home', html_url: 'https://canvas.example.edu/courses/1', hidden: false, position: 1, tab_type: 'internal', active: true },
                { tab_id: 'announcements', label: 'Announcements', html_url: 'https://canvas.example.edu/courses/1/announcements', hidden: false, position: 2, tab_type: 'internal', active: false },
                { tab_id: 'modules', label: 'Modules', html_url: 'https://canvas.example.edu/courses/1/modules', hidden: false, position: 3, tab_type: 'internal', active: false },
                { tab_id: 'pages', label: 'Pages', html_url: 'https://canvas.example.edu/courses/1/pages', hidden: false, position: 4, tab_type: 'internal', active: false },
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
                {
                    page_id: 2,
                    url: 'second-page',
                    title: 'Second Page',
                    updated_at: '2026-03-20T10:00:00Z',
                    published: true,
                    front_page: false,
                    html_url: 'https://canvas.example.edu/courses/canvas-course-1/pages/second-page',
                },
            ],
        });
        vi.mocked(api.getCourseLmsPage).mockImplementation(async (_courseId, pageRef) => {
            if (pageRef === 'front-page') {
                return {
                    page_id: 1,
                    url: 'front-page',
                    title: 'Front Page',
                    updated_at: '2026-03-21T10:00:00Z',
                    published: true,
                    front_page: true,
                    html_url: 'https://canvas.example.edu/courses/canvas-course-1/pages/front-page',
                    body: '<p>Front body <a href="/courses/canvas-course-1/pages/second-page" data-api-endpoint="/api/v1/courses/canvas-course-1/pages/second-page" data-api-returntype="Page">Go second</a></p>',
                    locked_for_user: false,
                    lock_explanation: null,
                    editing_roles: null,
                };
            }

            return {
                page_id: 2,
                url: 'second-page',
                title: 'Second Page',
                updated_at: '2026-03-20T10:00:00Z',
                published: true,
                front_page: false,
                html_url: 'https://canvas.example.edu/courses/canvas-course-1/pages/second-page',
                body: '<p>Second body</p>',
                locked_for_user: false,
                lock_explanation: null,
                editing_roles: null,
            };
        });

        const { Wrapper } = createQueryClientWrapper();
        render(
            <CanvasPagesTab tabId="tab-1" courseId="course-1" settings={{}} updateSettings={vi.fn()} />,
            { wrapper: Wrapper },
        );

        const sameCourseLink = await screen.findByRole('link', { name: 'Go second' });
        fireEvent.click(sameCourseLink);

        await waitFor(() => {
            expect(screen.getByText('Second body')).toBeInTheDocument();
        });

        expect(api.getCourseLmsPage).toHaveBeenCalledWith('course-1', 'second-page');
    });
});
