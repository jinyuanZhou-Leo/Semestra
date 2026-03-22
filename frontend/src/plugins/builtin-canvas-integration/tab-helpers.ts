// input:  [Canvas navigation API payloads, plugin section keys, assignment/page/module/quiz summary types, and browser URL parsing helpers]
// output: [builtin-canvas-integration query defaults, Canvas-type-aware navigation-entry mapping, home fallback helpers, LMS URL helpers, and small runtime utilities]
// pos:    [logic helper layer shared by the Canvas tab runtime and its extracted UI components]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { ComponentType } from 'react';
import { Blocks, ChartColumnIncreasing, FileQuestion, FileSpreadsheet, FileText, Home, Megaphone, ScrollText } from 'lucide-react';

import type {
    LmsAnnouncementSummary,
    LmsAssignmentSummary,
    LmsCourseNavigationResponse,
    LmsCourseNavigationTab,
    LmsCoursePageSummary,
    LmsModuleSummary,
    LmsQuizSummary,
} from '@/services/api';

import type { CanvasHomeLandingTarget, CanvasNavSectionKey } from './shared';
import { resolveCanvasHref } from './shared';

export type CanvasNavigationEntry = {
    id: string;
    label: string;
    htmlUrl?: string | null;
    kind: 'section' | 'internal_generic' | 'external';
    section?: CanvasNavSectionKey;
    active: boolean;
};

export const EMPTY_PAGE_ITEMS: LmsCoursePageSummary[] = [];
export const EMPTY_ANNOUNCEMENT_ITEMS: LmsAnnouncementSummary[] = [];
export const EMPTY_ASSIGNMENT_ITEMS: LmsAssignmentSummary[] = [];
export const EMPTY_MODULE_ITEMS: LmsModuleSummary[] = [];
export const EMPTY_QUIZ_ITEMS: LmsQuizSummary[] = [];

export const CANVAS_QUERY_OPTIONS = {
    retry: false,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
} as const;

export const SECTION_META: Record<CanvasNavSectionKey, { label: string; icon: ComponentType<{ className?: string }> }> = {
    home: { label: 'Home', icon: Home },
    announcements: { label: 'Announcements', icon: Megaphone },
    assignments: { label: 'Assignments', icon: FileSpreadsheet },
    grades: { label: 'Grades', icon: ChartColumnIncreasing },
    modules: { label: 'Modules', icon: Blocks },
    pages: { label: 'Pages', icon: FileText },
    quizzes: { label: 'Quizzes', icon: FileQuestion },
    syllabus: { label: 'Syllabus', icon: ScrollText },
};

const HIDDEN_CANVAS_TAB_IDS = new Set([
    'files',
    'discussion',
    'discussions',
    'discussion_topics',
]);

const CANVAS_TAB_SECTION_MAP: Record<string, CanvasNavSectionKey> = {
    home: 'home',
    announcements: 'announcements',
    feed: 'announcements',
    assignments: 'assignments',
    grades: 'grades',
    modules: 'modules',
    pages: 'pages',
    wiki: 'pages',
    quizzes: 'quizzes',
    syllabus: 'syllabus',
};

const HOME_FALLBACK_ORDER: CanvasHomeLandingTarget[] = ['pages', 'assignments', 'modules', 'grades', 'announcements', 'quizzes', 'syllabus'];

const toDisplayTitle = (value: string | null | undefined, fallback: string) => {
    const source = value?.trim() || fallback;
    return source
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(' ');
};

const normalizeCanvasTabValue = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';

const hasSectionEntry = (entries: CanvasNavigationEntry[], section: CanvasHomeLandingTarget) => (
    section !== null && entries.some((entry) => entry.kind === 'section' && entry.section === section)
);

export const getLmsProviderLabel = (provider: string) => {
    if (!provider) return 'LMS';
    return provider.charAt(0).toUpperCase() + provider.slice(1);
};

export const getQueryErrorStatus = (error: unknown) => {
    if (!error || typeof error !== 'object' || !('response' in error)) return null;
    const response = (error as { response?: { status?: number } }).response;
    return typeof response?.status === 'number' ? response.status : null;
};

export const resolveCanvasOrigin = (...candidates: Array<string | null | undefined>) => {
    for (const candidate of candidates) {
        if (!candidate) continue;
        try {
            return new URL(candidate).origin;
        } catch {
            continue;
        }
    }
    return null;
};

export const openExternalUrl = (href: string | null | undefined) => {
    if (!href) return;
    window.open(href, '_blank', 'noopener,noreferrer');
};

export const isHiddenCanvasTab = (tabId: string | null | undefined) => HIDDEN_CANVAS_TAB_IDS.has(normalizeCanvasTabValue(tabId));

export const resolveInternalSectionFromTab = (tab: LmsCourseNavigationTab): CanvasNavSectionKey | null => {
    const tabId = normalizeCanvasTabValue(tab.tab_id);
    const tabType = normalizeCanvasTabValue(tab.tab_type);
    return CANVAS_TAB_SECTION_MAP[tabId] ?? CANVAS_TAB_SECTION_MAP[tabType] ?? null;
};

export const buildNavigationEntries = (navigation: LmsCourseNavigationResponse | undefined): CanvasNavigationEntry[] => {
    if (!navigation) {
        return [
            {
                id: 'home',
                label: SECTION_META.home.label,
                kind: 'section',
                section: 'home',
                active: true,
            },
        ];
    }

    const entries: CanvasNavigationEntry[] = [];
    const seenSections = new Set<CanvasNavSectionKey>();
    const visibleTabs = [...navigation.tabs]
        .filter((tab) => !tab.hidden && !isHiddenCanvasTab(tab.tab_id))
        .sort((left, right) => left.position - right.position);

    for (const tab of visibleTabs) {
        const normalizedTabType = normalizeCanvasTabValue(tab.tab_type);
        const section = resolveInternalSectionFromTab(tab);
        if (normalizedTabType !== 'external' && section) {
            if (seenSections.has(section)) {
                continue;
            }
            seenSections.add(section);
            entries.push({
                id: tab.tab_id,
                label: toDisplayTitle(tab.label, SECTION_META[section].label),
                htmlUrl: tab.html_url,
                kind: 'section',
                section,
                active: tab.active,
            });
            continue;
        }

        entries.push({
            id: tab.tab_id,
            label: toDisplayTitle(tab.label, 'Canvas'),
            htmlUrl: tab.html_url,
            kind: normalizedTabType === 'external' ? 'external' : 'internal_generic',
            active: tab.active,
        });
    }

    if (!seenSections.has('home')) {
        entries.unshift({
            id: 'home',
            label: SECTION_META.home.label,
            kind: 'section',
            section: 'home',
            active: true,
        });
    }

    return entries;
};

export const resolveCanvasHomeLandingTarget = (
    defaultView: string | null | undefined,
    navigationEntries: CanvasNavigationEntry[],
): CanvasHomeLandingTarget => {
    const normalizedDefaultView = normalizeCanvasTabValue(defaultView);
    const mappedSection = CANVAS_TAB_SECTION_MAP[normalizedDefaultView] ?? null;

    if (mappedSection && mappedSection !== 'home' && hasSectionEntry(navigationEntries, mappedSection)) {
        return mappedSection;
    }

    return HOME_FALLBACK_ORDER.find((section) => hasSectionEntry(navigationEntries, section)) ?? null;
};

export const resolveNavigationExternalUrl = (href: string | null | undefined, canvasOrigin?: string | null) => {
    return resolveCanvasHref(href ?? '', canvasOrigin) ?? href ?? null;
};
