// input:  [Canvas navigation, announcement, module, and page APIs, course context state, HTML sanitizer helpers, and shadcn UI primitives]
// output: [builtin-canvas-integration course tab runtime and tab definition]
// pos:    [course-scoped Canvas navigation browser with a narrow Canvas-like left rail, landing-view-aware content rendering, inline HTML rendering, and in-app same-course page navigation]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Blocks, ExternalLink, FileText, Home, Megaphone } from 'lucide-react';

import { AppEmptyState } from '@/components/AppEmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCourseData } from '@/contexts/CourseDataContext';
import { sanitizeCanvasHtmlFragment } from '@/lib/html';
import { cn } from '@/lib/utils';
import api, {
    type LmsAnnouncementSummary,
    type LmsCourseNavigationResponse,
    type LmsCourseNavigationTab,
    type LmsCoursePageDetail,
    type LmsCoursePageSummary,
    type LmsModuleItem,
    type LmsModuleSummary,
} from '@/services/api';
import { queryKeys } from '@/services/queryKeys';
import type { TabDefinition, TabProps } from '@/services/tabRegistry';

import {
    BUILTIN_CANVAS_PAGES_TAB_TYPE,
    formatCanvasPageTimestamp,
    resolveCanvasHomeLandingTarget,
    resolveCanvasHomePageRef,
    resolveCanvasNavSectionKey,
    resolveCanvasPageReference,
    resolveCanvasPageReferenceFromAnchor,
    type CanvasNavSectionKey,
} from './shared';

type CanvasNavigationEntry = {
    id: string;
    label: string;
    htmlUrl?: string | null;
    kind: 'internal' | 'external';
    section?: CanvasNavSectionKey;
    active: boolean;
};

const EMPTY_PAGE_ITEMS: LmsCoursePageSummary[] = [];
const EMPTY_ANNOUNCEMENT_ITEMS: LmsAnnouncementSummary[] = [];
const EMPTY_MODULE_ITEMS: LmsModuleSummary[] = [];

const CANVAS_QUERY_OPTIONS = {
    retry: false,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
} as const;

const SECTION_META: Record<CanvasNavSectionKey, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
    home: { label: 'Home', icon: Home },
    announcements: { label: 'Announcements', icon: Megaphone },
    modules: { label: 'Modules', icon: Blocks },
    pages: { label: 'Pages', icon: FileText },
};

const getLmsProviderLabel = (provider: string) => {
    if (!provider) return 'LMS';
    return provider.charAt(0).toUpperCase() + provider.slice(1);
};

const getQueryErrorStatus = (error: unknown) => {
    if (!error || typeof error !== 'object' || !('response' in error)) return null;
    const response = (error as { response?: { status?: number } }).response;
    return typeof response?.status === 'number' ? response.status : null;
};

const openExternalUrl = (href: string | null | undefined) => {
    if (!href) return;
    window.open(href, '_blank', 'noopener,noreferrer');
};

const resolveInternalSectionFromTab = (tab: LmsCourseNavigationTab): CanvasNavSectionKey | null => {
    return (
        resolveCanvasNavSectionKey(tab.tab_id)
        ?? resolveCanvasNavSectionKey(tab.tab_type)
        ?? resolveCanvasNavSectionKey(tab.label)
    );
};

const buildNavigationEntries = (navigation: LmsCourseNavigationResponse | undefined): CanvasNavigationEntry[] => {
    if (!navigation) {
        return [
            {
                id: 'home',
                label: SECTION_META.home.label,
                kind: 'internal',
                section: 'home',
                active: true,
            },
        ];
    }

    const entries: CanvasNavigationEntry[] = [];
    const seenSections = new Set<CanvasNavSectionKey>();
    const visibleTabs = [...navigation.tabs]
        .filter((tab) => !tab.hidden)
        .sort((left, right) => left.position - right.position);

    for (const tab of visibleTabs) {
        const section = resolveInternalSectionFromTab(tab);
        if (section) {
            if (seenSections.has(section)) {
                continue;
            }
            seenSections.add(section);
            entries.push({
                id: tab.tab_id,
                label: tab.label || SECTION_META[section].label,
                htmlUrl: tab.html_url,
                kind: 'internal',
                section,
                active: tab.active,
            });
            continue;
        }

        entries.push({
            id: tab.tab_id,
            label: tab.label || 'Canvas',
            htmlUrl: tab.html_url,
            kind: 'external',
            active: tab.active,
        });
    }

    if (!seenSections.has('home')) {
        entries.unshift({
            id: 'home',
            label: SECTION_META.home.label,
            kind: 'internal',
            section: 'home',
            active: true,
        });
    }

    return entries;
};

const CanvasShellSkeleton: React.FC = () => (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[11.75rem_minmax(0,1fr)]">
        <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/15 p-3">
            <Skeleton className="h-5 w-24 rounded-md" />
            {[0, 1, 2, 3, 4].map((index) => (
                <Skeleton key={index} className="h-9 rounded-lg" />
            ))}
            <div className="space-y-2 border-t border-border/60 pt-3">
                <Skeleton className="h-4 w-14 rounded-md" />
                {[0, 1, 2].map((index) => (
                    <Skeleton key={index} className="h-8 rounded-lg" />
                ))}
            </div>
        </div>
        <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/15 p-5">
            <Skeleton className="h-7 w-44 rounded-md" />
            <Skeleton className="h-4 w-56 rounded-md" />
            <Skeleton className="h-72 rounded-2xl" />
        </div>
    </div>
);

const CanvasRailButton: React.FC<{
    entry: CanvasNavigationEntry;
    selected: boolean;
    onSelectInternal: (section: CanvasNavSectionKey) => void;
}> = ({ entry, selected, onSelectInternal }) => {
    const Icon = entry.section ? SECTION_META[entry.section].icon : FileText;

    return (
        <button
            type="button"
            aria-current={entry.kind === 'internal' && selected ? 'page' : undefined}
            className={cn(
                'flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm transition-colors',
                entry.kind === 'internal' && selected
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground/75 hover:bg-muted/70 hover:text-foreground',
            )}
            onClick={() => {
                if (entry.kind === 'internal' && entry.section) {
                    onSelectInternal(entry.section);
                    return;
                }
                openExternalUrl(entry.htmlUrl);
            }}
        >
            <span
                className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-md',
                    entry.kind === 'internal' && selected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                )}
            >
                <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 truncate font-medium">{entry.label}</span>
            {entry.kind === 'external' ? <ExternalLink className="ml-auto size-3.5 shrink-0 text-muted-foreground" /> : null}
        </button>
    );
};

const CanvasPageRow: React.FC<{
    page: LmsCoursePageSummary;
    selected: boolean;
    onSelect: (pageRef: string) => void;
}> = ({ page, selected, onSelect }) => (
    <button
        type="button"
        className={cn(
            'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
            selected ? 'bg-primary/10 text-primary' : 'text-foreground/75 hover:bg-muted/70 hover:text-foreground',
        )}
        onClick={() => onSelect(page.url)}
    >
        <span className="min-w-0 truncate font-medium">{page.title}</span>
        {page.front_page ? <Badge variant="outline" className="shrink-0 text-[10px]">Home</Badge> : null}
    </button>
);

const CanvasHtmlFragment: React.FC<{
    body: string;
    courseExternalId: string;
    onNavigateToPage: (pageRef: string) => void;
}> = ({ body, courseExternalId, onNavigateToPage }) => {
    const sanitizedBody = sanitizeCanvasHtmlFragment(body);

    const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
            return;
        }

        const target = event.target;
        if (!(target instanceof Element)) return;

        const anchor = target.closest('a');
        if (!(anchor instanceof HTMLAnchorElement)) return;

        const nextPageRef = resolveCanvasPageReferenceFromAnchor(anchor, courseExternalId);
        if (nextPageRef) {
            event.preventDefault();
            onNavigateToPage(nextPageRef);
            return;
        }

        const href = anchor.href;
        if (!href) return;

        event.preventDefault();
        openExternalUrl(href);
    };

    return (
        <div
            className="canvas-page-body space-y-4 overflow-hidden text-sm leading-6 text-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l [&_blockquote]:border-border [&_blockquote]:pl-4 [&_img]:max-w-full [&_img]:rounded-lg [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_th]:border [&_th]:border-border"
            onClick={handleClick}
            dangerouslySetInnerHTML={{ __html: sanitizedBody }}
        />
    );
};

const CanvasPageDetailView: React.FC<{
    heading: string;
    page: LmsCoursePageDetail;
    courseExternalId: string;
    onNavigateToPage: (pageRef: string) => void;
}> = ({ heading, page, courseExternalId, onNavigateToPage }) => (
    <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-border/60 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{heading}</p>
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-foreground">{page.title}</h2>
                        {page.front_page ? <Badge variant="secondary">Front page</Badge> : null}
                        {page.published ? <Badge variant="outline">Published</Badge> : <Badge variant="outline">Draft</Badge>}
                        {page.locked_for_user ? <Badge variant="destructive">Locked</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">Updated {formatCanvasPageTimestamp(page.updated_at)}</p>
                </div>
                {page.html_url ? (
                    <Button asChild variant="outline" size="sm" className="shrink-0">
                        <a href={page.html_url} target="_blank" rel="noreferrer">
                            <ExternalLink className="size-3.5" />
                            Open in Canvas
                        </a>
                    </Button>
                ) : null}
            </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {page.locked_for_user && page.lock_explanation ? (
                <div className="mb-4 rounded-xl border border-border/60 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
                    {page.lock_explanation}
                </div>
            ) : null}

            {page.body ? (
                <CanvasHtmlFragment
                    body={page.body}
                    courseExternalId={courseExternalId}
                    onNavigateToPage={onNavigateToPage}
                />
            ) : (
                <p className="text-sm text-muted-foreground">This page does not have any visible content.</p>
            )}
        </div>
    </div>
);

const CanvasAnnouncementsView: React.FC<{
    heading: string;
    items: LmsAnnouncementSummary[];
    courseExternalId: string;
    onNavigateToPage: (pageRef: string) => void;
}> = ({ heading, items, courseExternalId, onNavigateToPage }) => {
    if (items.length === 0) {
        return (
            <AppEmptyState
                scenario="no-results"
                size="section"
                surface="inherit"
                title="No announcements"
                description="Canvas does not currently expose any announcements for this course."
                className="h-full"
            />
        );
    }

    return (
        <div className="min-h-0 overflow-y-auto">
            <div className="border-b border-border/60 px-5 py-4">
                <h2 className="text-xl font-semibold text-foreground">{heading}</h2>
            </div>
            <div className="divide-y divide-border/60">
                {items.map((announcement) => (
                    <article key={announcement.announcement_id} className="space-y-4 px-5 py-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                                <h3 className="text-lg font-semibold text-foreground">{announcement.title}</h3>
                                <p className="text-sm text-muted-foreground">
                                    Posted {formatCanvasPageTimestamp(announcement.posted_at ?? announcement.updated_at)}
                                </p>
                            </div>
                            {announcement.html_url ? (
                                <Button asChild variant="outline" size="sm" className="shrink-0">
                                    <a href={announcement.html_url} target="_blank" rel="noreferrer">
                                        <ExternalLink className="size-3.5" />
                                        Open in Canvas
                                    </a>
                                </Button>
                            ) : null}
                        </div>
                        {announcement.body ? (
                            <CanvasHtmlFragment
                                body={announcement.body}
                                courseExternalId={courseExternalId}
                                onNavigateToPage={onNavigateToPage}
                            />
                        ) : (
                            <p className="text-sm text-muted-foreground">This announcement does not include a message body.</p>
                        )}
                    </article>
                ))}
            </div>
        </div>
    );
};

const CanvasModuleItemRow: React.FC<{
    item: LmsModuleItem;
    onOpenPage: (pageRef: string) => void;
    courseExternalId: string;
}> = ({ item, onOpenPage, courseExternalId }) => {
    const pageRef = resolveCanvasPageReference(item.html_url ?? item.url ?? '', courseExternalId);

    return (
        <button
            type="button"
            className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/60"
            onClick={() => {
                if (pageRef) {
                    onOpenPage(pageRef);
                    return;
                }
                openExternalUrl(item.html_url);
            }}
        >
            <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                    {item.item_type ? <Badge variant="outline">{item.item_type}</Badge> : null}
                    {!item.published ? <Badge variant="outline">Hidden</Badge> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {typeof item.position === 'number' ? <span>Item {item.position}</span> : null}
                    {item.completion_requirement_type ? <span>{item.completion_requirement_type.replaceAll('_', ' ')}</span> : null}
                </div>
            </div>
            {(pageRef || item.html_url) ? <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> : null}
        </button>
    );
};

const CanvasModulesView: React.FC<{
    heading: string;
    items: LmsModuleSummary[];
    onOpenPage: (pageRef: string) => void;
    courseExternalId: string;
}> = ({ heading, items, onOpenPage, courseExternalId }) => {
    if (items.length === 0) {
        return (
            <AppEmptyState
                scenario="no-results"
                size="section"
                surface="inherit"
                title="No modules"
                description="Canvas does not currently expose any modules for this course."
                className="h-full"
            />
        );
    }

    return (
        <div className="min-h-0 overflow-y-auto">
            <div className="border-b border-border/60 px-5 py-4">
                <h2 className="text-xl font-semibold text-foreground">{heading}</h2>
            </div>
            <div className="space-y-4 px-5 py-5">
                {items.map((moduleItem) => (
                    <section key={moduleItem.module_id} className="overflow-hidden rounded-2xl border border-border/60">
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-3">
                            <div className="space-y-1">
                                <h3 className="text-base font-semibold text-foreground">{moduleItem.name}</h3>
                                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                    {typeof moduleItem.position === 'number' ? <span>Module {moduleItem.position}</span> : null}
                                    {moduleItem.state ? <span>{moduleItem.state}</span> : null}
                                    {moduleItem.unlock_at ? <span>Unlocks {formatCanvasPageTimestamp(moduleItem.unlock_at)}</span> : null}
                                </div>
                            </div>
                            {moduleItem.published ? <Badge variant="outline">Published</Badge> : <Badge variant="outline">Hidden</Badge>}
                        </div>
                        <div className="divide-y divide-border/60">
                            {moduleItem.items.length > 0 ? (
                                moduleItem.items.map((item) => (
                                    <CanvasModuleItemRow
                                        key={item.module_item_id}
                                        item={item}
                                        onOpenPage={onOpenPage}
                                        courseExternalId={courseExternalId}
                                    />
                                ))
                            ) : (
                                <p className="px-4 py-4 text-sm text-muted-foreground">This module does not contain any published items.</p>
                            )}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
};

const CanvasSectionLoading: React.FC = () => (
    <div className="space-y-4 p-5">
        <Skeleton className="h-7 w-44 rounded-md" />
        <Skeleton className="h-4 w-56 rounded-md" />
        <Skeleton className="h-72 rounded-2xl" />
    </div>
);

export const CanvasPagesTab: React.FC<TabProps> = ({ courseId }) => {
    const { course, isLoading: isCourseLoading } = useCourseData();
    const [activeSection, setActiveSection] = React.useState<CanvasNavSectionKey>('home');
    const [homePageRef, setHomePageRef] = React.useState<string | null>(null);
    const [pagesSelectedPageRef, setPagesSelectedPageRef] = React.useState<string | null>(null);

    const lmsLink = course?.lms_link ?? null;
    const isCanvasLinked = lmsLink?.provider === 'canvas';
    const courseExternalId = lmsLink?.external_course_id ?? '';

    React.useEffect(() => {
        setActiveSection('home');
        setHomePageRef(null);
        setPagesSelectedPageRef(null);
    }, [courseId]);

    const navigationQuery = useQuery({
        queryKey: courseId ? queryKeys.courses.lmsNavigation(courseId) : ['courses', 'lms-navigation', 'disabled'],
        queryFn: () => api.getCourseLmsNavigation(courseId!),
        enabled: Boolean(courseId && isCanvasLinked),
        ...CANVAS_QUERY_OPTIONS,
    });

    const navigation = navigationQuery.data;
    const navigationEntries = React.useMemo(() => buildNavigationEntries(navigation), [navigation]);
    const internalEntries = navigationEntries.filter((entry) => entry.kind === 'internal' && entry.section) as Array<CanvasNavigationEntry & { section: CanvasNavSectionKey }>;
    const homeLandingTarget = resolveCanvasHomeLandingTarget(navigation?.default_view ?? null);

    React.useEffect(() => {
        if (internalEntries.length === 0) {
            return;
        }
        if (!internalEntries.some((entry) => entry.section === activeSection)) {
            setActiveSection(internalEntries[0].section);
        }
    }, [activeSection, internalEntries]);

    const shouldLoadPages = activeSection === 'pages' || (activeSection === 'home' && homeLandingTarget === 'page');
    const shouldLoadAnnouncements = activeSection === 'announcements' || (activeSection === 'home' && homeLandingTarget === 'announcements');
    const shouldLoadModules = activeSection === 'modules' || (activeSection === 'home' && homeLandingTarget === 'modules');

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
        setPagesSelectedPageRef((current) => (current && pages.some((page) => page.url === current) ? current : preferredPageRef));
    }, [pages]);

    const activePageRef = activeSection === 'pages' ? pagesSelectedPageRef : homeLandingTarget === 'page' ? homePageRef : null;
    const activePageQuery = useQuery({
        queryKey: courseId && activePageRef
            ? queryKeys.courses.lmsPage(courseId, activePageRef)
            : ['courses', 'lms-page', 'disabled', courseId ?? 'no-course', activeSection],
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

    const modulesQuery = useQuery({
        queryKey: courseId ? queryKeys.courses.lmsModules(courseId) : ['courses', 'lms-modules', 'disabled'],
        queryFn: () => api.getCourseLmsModules(courseId!),
        enabled: Boolean(courseId && isCanvasLinked && shouldLoadModules),
        ...CANVAS_QUERY_OPTIONS,
    });

    const handleOpenPage = React.useCallback((pageRef: string) => {
        setPagesSelectedPageRef(pageRef);
        setActiveSection('pages');
    }, []);

    if (!courseId) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="page"
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
                size="page"
                title="Canvas unavailable"
                description="Link this course to Canvas in course settings to browse its course navigation here."
            />
        );
    }

    if (!isCanvasLinked) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="page"
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
                size="page"
                title="Canvas navigation unavailable"
                description="Failed to load the Canvas course navigation."
            />
        );
    }

    const activeEntry = internalEntries.find((entry) => entry.section === activeSection);
    const homeExternalUrl = navigation.tabs.find((tab) => resolveInternalSectionFromTab(tab) === 'home')?.html_url
        ?? navigation.front_page_url
        ?? activePageQuery.data?.html_url
        ?? null;
    const activePageErrorStatus = getQueryErrorStatus(activePageQuery.error);

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
    } else if (activeSection === 'home' && homeLandingTarget === 'external') {
        content = (
            <AppEmptyState
                scenario="unavailable"
                size="section"
                surface="inherit"
                title="Home is only available in Canvas"
                description="This course uses a Canvas home view that is not rendered inside Semestra yet."
                primaryAction={homeExternalUrl ? (
                    <Button asChild variant="outline" size="sm">
                        <a href={homeExternalUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="size-3.5" />
                            Open in Canvas
                        </a>
                    </Button>
                ) : undefined}
                className="h-full"
            />
        );
    } else if ((activeSection === 'home' || activeSection === 'pages') && (homeLandingTarget === 'page' || activeSection === 'pages')) {
        if (activePageRef && activePageQuery.isLoading && !activePageQuery.data) {
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
                    title="No Canvas pages"
                    description="This Canvas course does not have any pages yet."
                    className="h-full"
                />
            );
        } else {
            content = (
                <CanvasPageDetailView
                    heading={activeSection === 'pages' ? 'Pages' : 'Home'}
                    page={activePageQuery.data}
                    courseExternalId={courseExternalId}
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
            content = (
                <CanvasAnnouncementsView
                    heading={activeSection === 'home' ? 'Home' : 'Announcements'}
                    items={announcementsQuery.data?.items ?? EMPTY_ANNOUNCEMENT_ITEMS}
                    courseExternalId={courseExternalId}
                    onNavigateToPage={handleOpenPage}
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
                    heading={activeSection === 'home' ? 'Home' : 'Modules'}
                    items={modulesQuery.data?.items ?? EMPTY_MODULE_ITEMS}
                    onOpenPage={handleOpenPage}
                    courseExternalId={courseExternalId}
                />
            );
        }
    } else {
        content = (
            <AppEmptyState
                scenario="unavailable"
                size="section"
                surface="inherit"
                title={activeEntry?.label ?? 'Canvas'}
                description="This Canvas section opens on the Canvas website."
                className="h-full"
            />
        );
    }

    return (
        <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[11.75rem_minmax(0,1fr)]">
            <aside className="min-h-0 rounded-2xl border border-border/60 bg-background p-3">
                <div className="mb-3 px-1">
                    <p className="text-sm font-semibold text-foreground">Navigation</p>
                    <p className="text-xs text-muted-foreground">Canvas course menu</p>
                </div>

                <div className="space-y-1">
                    {navigationEntries.map((entry) => (
                        <CanvasRailButton
                            key={entry.id}
                            entry={entry}
                            selected={entry.kind === 'internal' && entry.section === activeSection}
                            onSelectInternal={setActiveSection}
                        />
                    ))}
                </div>

                {activeSection === 'pages' ? (
                    <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                        <div className="flex items-center justify-between gap-2 px-1">
                            <p className="text-sm font-medium text-muted-foreground">Pages</p>
                            <Badge variant="outline" className="text-[10px]">
                                {pages.length}
                            </Badge>
                        </div>
                        <div className="max-h-[28rem] space-y-1 overflow-y-auto pr-1">
                            {pages.map((page) => (
                                <CanvasPageRow
                                    key={String(page.page_id)}
                                    page={page}
                                    selected={page.url === pagesSelectedPageRef}
                                    onSelect={handleOpenPage}
                                />
                            ))}
                        </div>
                    </div>
                ) : null}
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
