// input:  [Canvas navigation, announcement, module, page, quiz, and syllabus APIs, course context state, extracted tab helpers, and extracted tab UI components]
// output: [builtin-canvas-integration course tab runtime and tab definition with framework-aligned unavailable states and host-aware sticky navigation offset]
// pos:    [course-scoped Canvas navigation controller that filters unsupported tabs, resolves Home fallback targets, owns selected-tab state, orchestrates queries, and renders extracted Canvas views inside the host tab shell]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { AppEmptyState } from '@/components/AppEmptyState';
import { Button } from '@/components/ui/button';
import { useCourseData } from '@/contexts/CourseDataContext';
import api from '@/services/api';
import { queryKeys } from '@/services/queryKeys';
import type { TabDefinition, TabProps } from '@/services/tabRegistry';

import {
    buildNavigationEntries,
    CANVAS_QUERY_OPTIONS,
    EMPTY_ANNOUNCEMENT_ITEMS,
    EMPTY_MODULE_ITEMS,
    EMPTY_PAGE_ITEMS,
    EMPTY_QUIZ_ITEMS,
    getLmsProviderLabel,
    getQueryErrorStatus,
    resolveCanvasHomeLandingTarget,
    resolveCanvasOrigin,
    resolveNavigationExternalUrl,
} from './tab-helpers';
import {
    CanvasAnnouncementDetailView,
    CanvasAnnouncementListView,
    CanvasLinkPromptView,
    CanvasModulesView,
    CanvasPageDetailView,
    CanvasPageListView,
    CanvasQuizzesView,
    CanvasRailButton,
    CanvasSectionLoading,
    CanvasShellSkeleton,
    CanvasSyllabusView,
} from './components';
import {
    BUILTIN_CANVAS_PAGES_TAB_TYPE,
    resolveCanvasHomePageRef,
    type CanvasHomeLandingTarget,
    type CanvasNavSectionKey,
} from './shared';

const GLOBAL_HEADER_HEIGHT = 60;
const CANVAS_RAIL_STICKY_GAP = 16;
const FALLBACK_WORKSPACE_NAV_HEIGHT = 104;

export const CanvasPagesTab: React.FC<TabProps> = ({ courseId }) => {
    const { course, isLoading: isCourseLoading } = useCourseData();
    const [activeEntryId, setActiveEntryId] = React.useState('home');
    const [homePageRef, setHomePageRef] = React.useState<string | null>(null);
    const [pagesSelectedPageRef, setPagesSelectedPageRef] = React.useState<string | null>(null);
    const [selectedAnnouncementId, setSelectedAnnouncementId] = React.useState<string | null>(null);
    const [railStickyTop, setRailStickyTop] = React.useState(
        GLOBAL_HEADER_HEIGHT + FALLBACK_WORKSPACE_NAV_HEIGHT + CANVAS_RAIL_STICKY_GAP,
    );

    const lmsLink = course?.lms_link ?? null;
    const isCanvasLinked = lmsLink?.provider === 'canvas';
    const courseExternalId = lmsLink?.external_course_id ?? '';

    React.useEffect(() => {
        setActiveEntryId('home');
        setHomePageRef(null);
        setPagesSelectedPageRef(null);
        setSelectedAnnouncementId(null);
    }, [courseId]);

    React.useEffect(() => {
        if (typeof window === 'undefined') return;

        let frameId: number | null = null;
        let resizeObserver: ResizeObserver | null = null;

        const updateRailStickyTop = () => {
            const workspaceHeader = document.querySelector<HTMLElement>('.sticky-page-header');
            const workspaceHeaderHeight = workspaceHeader
                ? Math.ceil(workspaceHeader.getBoundingClientRect().height)
                : FALLBACK_WORKSPACE_NAV_HEIGHT;
            setRailStickyTop(GLOBAL_HEADER_HEIGHT + workspaceHeaderHeight + CANVAS_RAIL_STICKY_GAP);
        };

        const scheduleUpdate = () => {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }
            frameId = window.requestAnimationFrame(() => {
                frameId = null;
                updateRailStickyTop();
            });
        };

        const workspaceHeader = document.querySelector<HTMLElement>('.sticky-page-header');
        if (workspaceHeader && typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(scheduleUpdate);
            resizeObserver.observe(workspaceHeader);
        }

        window.addEventListener('resize', scheduleUpdate);
        scheduleUpdate();

        return () => {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }
            resizeObserver?.disconnect();
            window.removeEventListener('resize', scheduleUpdate);
        };
    }, []);

    const navigationQuery = useQuery({
        queryKey: courseId ? queryKeys.courses.lmsNavigation(courseId) : ['courses', 'lms-navigation', 'disabled'],
        queryFn: () => api.getCourseLmsNavigation(courseId!),
        enabled: Boolean(courseId && isCanvasLinked),
        ...CANVAS_QUERY_OPTIONS,
    });

    const navigation = navigationQuery.data;
    const navigationEntries = React.useMemo(() => buildNavigationEntries(navigation), [navigation]);
    const sectionEntries = navigationEntries.filter((entry) => entry.kind === 'section' && entry.section) as Array<
        (typeof navigationEntries)[number] & { section: CanvasNavSectionKey }
    >;
    const activeEntry = navigationEntries.find((entry) => entry.id === activeEntryId) ?? navigationEntries[0] ?? null;
    const activeSection = activeEntry?.kind === 'section' ? activeEntry.section ?? null : null;
    const homeLandingTarget = React.useMemo<CanvasHomeLandingTarget>(
        () => resolveCanvasHomeLandingTarget(navigation?.default_view ?? null, navigationEntries),
        [navigation?.default_view, navigationEntries],
    );

    React.useEffect(() => {
        if (navigationEntries.length === 0) {
            return;
        }
        if (!navigationEntries.some((entry) => entry.id === activeEntryId)) {
            setActiveEntryId(navigationEntries[0].id);
        }
    }, [activeEntryId, navigationEntries]);

    const shouldLoadPages = activeSection === 'pages' || (activeSection === 'home' && homeLandingTarget === 'pages');
    const shouldLoadAnnouncements = activeSection === 'announcements' || (activeSection === 'home' && homeLandingTarget === 'announcements');
    const shouldLoadModules = activeSection === 'modules' || (activeSection === 'home' && homeLandingTarget === 'modules');
    const shouldLoadQuizzes = activeSection === 'quizzes' || (activeSection === 'home' && homeLandingTarget === 'quizzes');
    const shouldLoadSyllabus = activeSection === 'syllabus' || (activeSection === 'home' && homeLandingTarget === 'syllabus');

    const pagesQuery = useQuery({
        queryKey: courseId ? queryKeys.courses.lmsPages(courseId) : ['courses', 'lms-pages', 'disabled'],
        queryFn: () => api.getCourseLmsPages(courseId!),
        enabled: Boolean(courseId && isCanvasLinked && shouldLoadPages),
        ...CANVAS_QUERY_OPTIONS,
    });
    const pages = pagesQuery.data?.items ?? EMPTY_PAGE_ITEMS;

    React.useEffect(() => {
        if (pages.length === 0) {
            setHomePageRef(null);
            setPagesSelectedPageRef(null);
            return;
        }
        const preferredPageRef = resolveCanvasHomePageRef(pages);
        setHomePageRef((current) => (current && pages.some((page) => page.url === current) ? current : preferredPageRef));
        setPagesSelectedPageRef((current) => (current && pages.some((page) => page.url === current) ? current : null));
    }, [pages]);

    const activePageRef = activeSection === 'pages'
        ? pagesSelectedPageRef
        : activeSection === 'home' && homeLandingTarget === 'pages'
            ? homePageRef
            : null;

    const activePageQuery = useQuery({
        queryKey: courseId && activePageRef
            ? queryKeys.courses.lmsPage(courseId, activePageRef)
            : ['courses', 'lms-page', 'disabled', courseId ?? 'no-course', activeEntryId],
        queryFn: () => api.getCourseLmsPage(courseId!, activePageRef!),
        enabled: Boolean(courseId && isCanvasLinked && activePageRef),
        ...CANVAS_QUERY_OPTIONS,
    });

    const announcementsQuery = useQuery({
        queryKey: courseId ? queryKeys.courses.lmsAnnouncements(courseId) : ['courses', 'lms-announcements', 'disabled'],
        queryFn: () => api.getCourseLmsAnnouncements(courseId!),
        enabled: Boolean(courseId && isCanvasLinked && shouldLoadAnnouncements),
        ...CANVAS_QUERY_OPTIONS,
    });
    const announcements = announcementsQuery.data?.items ?? EMPTY_ANNOUNCEMENT_ITEMS;
    const selectedAnnouncement = announcements.find((item) => item.announcement_id === selectedAnnouncementId) ?? null;

    React.useEffect(() => {
        if (selectedAnnouncementId && !announcements.some((item) => item.announcement_id === selectedAnnouncementId)) {
            setSelectedAnnouncementId(null);
        }
    }, [announcements, selectedAnnouncementId]);

    const modulesQuery = useQuery({
        queryKey: courseId ? queryKeys.courses.lmsModules(courseId) : ['courses', 'lms-modules', 'disabled'],
        queryFn: () => api.getCourseLmsModules(courseId!),
        enabled: Boolean(courseId && isCanvasLinked && shouldLoadModules),
        ...CANVAS_QUERY_OPTIONS,
    });

    const quizzesQuery = useQuery({
        queryKey: courseId ? queryKeys.courses.lmsQuizzes(courseId) : ['courses', 'lms-quizzes', 'disabled'],
        queryFn: () => api.getCourseLmsQuizzes(courseId!),
        enabled: Boolean(courseId && isCanvasLinked && shouldLoadQuizzes),
        ...CANVAS_QUERY_OPTIONS,
    });
    const quizzes = quizzesQuery.data?.items ?? EMPTY_QUIZ_ITEMS;

    const syllabusQuery = useQuery({
        queryKey: courseId ? queryKeys.courses.lmsSyllabus(courseId) : ['courses', 'lms-syllabus', 'disabled'],
        queryFn: () => api.getCourseLmsSyllabus(courseId!),
        enabled: Boolean(courseId && isCanvasLinked && shouldLoadSyllabus),
        ...CANVAS_QUERY_OPTIONS,
    });

    const canvasOrigin = resolveCanvasOrigin(
        navigation?.front_page_url,
        ...(navigation?.tabs.map((tab) => tab.html_url) ?? []),
        activePageQuery.data?.html_url,
        selectedAnnouncement?.html_url,
        syllabusQuery.data?.html_url,
        ...pages.map((page) => page.html_url),
        ...announcements.map((announcement) => announcement.html_url),
        ...quizzes.map((quiz) => quiz.html_url),
    );

    const pagesEntryId = sectionEntries.find((entry) => entry.section === 'pages')?.id ?? 'pages';
    const hasPagesEntry = sectionEntries.some((entry) => entry.section === 'pages');
    const homeEntryLabel = sectionEntries.find((entry) => entry.section === 'home')?.label ?? 'Home';
    const homeEntryUrl = sectionEntries.find((entry) => entry.section === 'home')?.htmlUrl ?? null;

    const handleSelectEntry = React.useCallback((entryId: string) => {
        const nextEntry = navigationEntries.find((entry) => entry.id === entryId);
        if (!nextEntry) {
            return;
        }

        setActiveEntryId(entryId);
        const nextSection = nextEntry.kind === 'section' ? nextEntry.section ?? null : null;
        if (nextSection === 'pages') {
            setPagesSelectedPageRef(null);
        }
        if (nextSection === 'announcements' || (nextSection === 'home' && homeLandingTarget === 'announcements')) {
            setSelectedAnnouncementId(null);
        }
    }, [homeLandingTarget, navigationEntries]);

    const handleOpenPage = React.useCallback((pageRef: string) => {
        if (hasPagesEntry) {
            setPagesSelectedPageRef(pageRef);
            setActiveEntryId(pagesEntryId);
            return;
        }
        setHomePageRef(pageRef);
        setActiveEntryId('home');
    }, [hasPagesEntry, pagesEntryId]);

    if (!courseId) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="section"
                title="Canvas unavailable"
                description="This tab requires a course context."
            />
        );
    }

    if (isCourseLoading && !course) {
        return <CanvasShellSkeleton />;
    }

    if (!lmsLink) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="section"
                title="Canvas unavailable"
                description="Link this course to Canvas in course settings to browse its course navigation here."
            />
        );
    }

    if (!isCanvasLinked) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="section"
                title="Canvas unavailable"
                description={`This course is linked to ${getLmsProviderLabel(lmsLink.provider)}. This tab only supports Canvas courses.`}
            />
        );
    }

    if (navigationQuery.isLoading && !navigation) {
        return <CanvasShellSkeleton />;
    }

    if (navigationQuery.error || !navigation) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="section"
                title="Canvas navigation unavailable"
                description="Failed to load the Canvas course navigation."
            />
        );
    }

    const homeLaunchUrl = homeEntryUrl
        ?? navigation.front_page_url
        ?? activePageQuery.data?.html_url
        ?? syllabusQuery.data?.html_url
        ?? null;
    const activePageErrorStatus = getQueryErrorStatus(activePageQuery.error);
    const activeEntryUrl = resolveNavigationExternalUrl(activeEntry?.htmlUrl ?? null, canvasOrigin);

    let content: React.ReactNode;
    if (shouldLoadPages && pagesQuery.isLoading && pages.length === 0) {
        content = <CanvasSectionLoading />;
    } else if (shouldLoadPages && (pagesQuery.error || (activeSection === 'pages' && !pagesQuery.data))) {
        content = (
            <AppEmptyState
                scenario="unavailable"
                size="section"
                surface="inherit"
                title="Canvas pages unavailable"
                description="Failed to load the Canvas page list."
                className="h-full"
            />
        );
    } else if (activeSection === 'home' && homeLandingTarget === null) {
        content = (
            <AppEmptyState
                scenario="unavailable"
                size="section"
                surface="inherit"
                title="Canvas home unavailable"
                description="This Canvas course home points to a hidden or unsupported section, and Semestra could not find a supported fallback tab."
                primaryAction={homeLaunchUrl ? (
                    <Button asChild variant="outline" size="sm">
                        <a href={homeLaunchUrl} target="_blank" rel="noreferrer">
                            Open in Canvas
                        </a>
                    </Button>
                ) : undefined}
                className="h-full"
            />
        );
    } else if (activeSection === 'pages' || (activeSection === 'home' && homeLandingTarget === 'pages')) {
        if (activeSection === 'pages' && !pagesSelectedPageRef) {
            content = (
                <CanvasPageListView
                    heading="Pages"
                    pages={pages}
                    selectedPageRef={pagesSelectedPageRef}
                    onSelectPage={setPagesSelectedPageRef}
                />
            );
        } else if (activePageRef && activePageQuery.isLoading && !activePageQuery.data) {
            content = <CanvasSectionLoading />;
        } else if (activePageErrorStatus === 404) {
            content = (
                <AppEmptyState
                    scenario="not-found"
                    size="section"
                    surface="inherit"
                    title="Canvas page not found"
                    description="The selected page could not be loaded from Canvas."
                    className="h-full"
                />
            );
        } else if (activePageQuery.error) {
            content = (
                <AppEmptyState
                    scenario="unavailable"
                    size="section"
                    surface="inherit"
                    title="Canvas page unavailable"
                    description="Failed to load the selected Canvas page."
                    className="h-full"
                />
            );
        } else if (!activePageRef || !activePageQuery.data) {
            content = (
                <AppEmptyState
                    scenario="no-results"
                    size="section"
                    surface="inherit"
                    title={activeSection === 'home' ? 'No Canvas home page' : 'No Canvas pages'}
                    description={activeSection === 'home'
                        ? 'This Canvas course does not have a front page yet.'
                        : 'This Canvas course does not have any pages yet.'}
                    className="h-full"
                />
            );
        } else {
            content = (
                <CanvasPageDetailView
                    heading={activeSection === 'pages' ? 'Pages' : homeEntryLabel}
                    page={activePageQuery.data}
                    courseExternalId={courseExternalId}
                    canvasOrigin={canvasOrigin}
                    onBack={activeSection === 'pages' ? () => setPagesSelectedPageRef(null) : undefined}
                    onNavigateToPage={handleOpenPage}
                />
            );
        }
    } else if (shouldLoadAnnouncements) {
        if (announcementsQuery.isLoading && !announcementsQuery.data) {
            content = <CanvasSectionLoading />;
        } else if (announcementsQuery.error) {
            content = (
                <AppEmptyState
                    scenario="unavailable"
                    size="section"
                    surface="inherit"
                    title="Announcements unavailable"
                    description="Failed to load the Canvas announcements feed."
                    className="h-full"
                />
            );
        } else {
            content = selectedAnnouncement ? (
                <CanvasAnnouncementDetailView
                    announcement={selectedAnnouncement}
                    courseExternalId={courseExternalId}
                    canvasOrigin={canvasOrigin}
                    backLabel={activeSection === 'home' ? homeEntryLabel : 'Announcements'}
                    onBack={() => setSelectedAnnouncementId(null)}
                    onNavigateToPage={handleOpenPage}
                />
            ) : (
                <CanvasAnnouncementListView
                    heading={activeSection === 'home' ? homeEntryLabel : 'Announcements'}
                    items={announcements}
                    selectedAnnouncementId={selectedAnnouncementId}
                    onSelectAnnouncement={setSelectedAnnouncementId}
                />
            );
        }
    } else if (shouldLoadModules) {
        if (modulesQuery.isLoading && !modulesQuery.data) {
            content = <CanvasSectionLoading />;
        } else if (modulesQuery.error) {
            content = (
                <AppEmptyState
                    scenario="unavailable"
                    size="section"
                    surface="inherit"
                    title="Modules unavailable"
                    description="Failed to load the Canvas modules list."
                    className="h-full"
                />
            );
        } else {
            content = (
                <CanvasModulesView
                    heading={activeSection === 'home' ? homeEntryLabel : 'Modules'}
                    items={modulesQuery.data?.items ?? EMPTY_MODULE_ITEMS}
                    onOpenPage={handleOpenPage}
                    courseExternalId={courseExternalId}
                    canvasOrigin={canvasOrigin}
                />
            );
        }
    } else if (shouldLoadQuizzes) {
        if (quizzesQuery.isLoading && !quizzesQuery.data) {
            content = <CanvasSectionLoading />;
        } else if (quizzesQuery.error) {
            content = (
                <AppEmptyState
                    scenario="unavailable"
                    size="section"
                    surface="inherit"
                    title="Quizzes unavailable"
                    description="Failed to load the Canvas quiz list."
                    className="h-full"
                />
            );
        } else {
            content = (
                <CanvasQuizzesView
                    heading={activeSection === 'home' ? homeEntryLabel : 'Quizzes'}
                    items={quizzes}
                />
            );
        }
    } else if (shouldLoadSyllabus) {
        if (syllabusQuery.isLoading && !syllabusQuery.data) {
            content = <CanvasSectionLoading />;
        } else if (syllabusQuery.error || !syllabusQuery.data) {
            content = (
                <AppEmptyState
                    scenario="unavailable"
                    size="section"
                    surface="inherit"
                    title="Syllabus unavailable"
                    description="Failed to load the Canvas syllabus."
                    className="h-full"
                />
            );
        } else {
            content = (
                <CanvasSyllabusView
                    heading={activeSection === 'home' ? homeEntryLabel : 'Syllabus'}
                    syllabus={syllabusQuery.data}
                    courseExternalId={courseExternalId}
                    canvasOrigin={canvasOrigin}
                    onNavigateToPage={handleOpenPage}
                />
            );
        }
    } else if (activeEntry?.kind === 'external') {
        content = (
            <CanvasLinkPromptView
                title={`${activeEntry.label} opens on an external website`}
                description="Canvas marked this tab as an external tool. Open it in a new browser tab to continue."
                href={activeEntryUrl}
                buttonLabel="Open external website"
            />
        );
    } else if (activeEntry?.kind === 'internal_generic') {
        content = (
            <CanvasLinkPromptView
                title={`${activeEntry.label} is not available in Semestra`}
                description="This Canvas section is not yet supported in Semestra. Open it in Canvas to continue."
                href={activeEntryUrl}
                buttonLabel="Open in Canvas"
            />
        );
    } else {
        content = (
            <AppEmptyState
                scenario="unavailable"
                size="section"
                surface="inherit"
                title={activeEntry?.label ?? 'Canvas'}
                description="This Canvas section is unavailable."
                className="h-full"
            />
        );
    }

    return (
        <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[11.75rem_minmax(0,1fr)]">
            <aside
                className="min-h-0 rounded-2xl border border-border/60 bg-background p-3 lg:sticky lg:self-start"
                style={{ top: `${railStickyTop}px` }}
            >
                <div className="mb-3 px-1">
                    <p className="text-sm font-semibold text-foreground">Course menu</p>
                    <p className="text-xs text-muted-foreground">Canvas course menu</p>
                </div>

                <div className="space-y-1">
                    {navigationEntries.map((entry) => (
                        <CanvasRailButton
                            key={entry.id}
                            entry={entry}
                            selected={entry.id === activeEntryId}
                            onSelectEntry={handleSelectEntry}
                        />
                    ))}
                </div>
            </aside>

            <section className="min-h-0 overflow-hidden rounded-2xl border border-border/60 bg-background">
                {content}
            </section>
        </div>
    );
};

export const BuiltinCanvasIntegrationTabDefinition: TabDefinition = {
    type: BUILTIN_CANVAS_PAGES_TAB_TYPE,
    component: CanvasPagesTab,
};
