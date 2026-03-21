// input:  [Canvas navigation/page API payloads, Canvas anchor metadata, and plugin tab runtime settings]
// output: [builtin-canvas-integration plugin constants plus Canvas navigation, page-link parsing, and timestamp formatting helpers]
// pos:    [Shared helper layer for the Canvas navigation tab runtime]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export const BUILTIN_CANVAS_INTEGRATION_PLUGIN_ID = 'builtin-canvas-integration';
export const BUILTIN_CANVAS_PAGES_TAB_TYPE = 'builtin-canvas-integration:pages';

export type CanvasNavSectionKey = 'home' | 'announcements' | 'modules' | 'pages';
export type CanvasHomeLandingTarget = 'page' | 'announcements' | 'modules' | 'external';

export interface CanvasPageSummaryLike {
    url: string;
    front_page: boolean;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const resolveCanvasNavSectionKey = (value: string | null | undefined): CanvasNavSectionKey | null => {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (normalized.includes('announ') || normalized.includes('feed') || normalized.includes('activity')) return 'announcements';
    if (normalized.includes('module')) return 'modules';
    if (normalized.includes('page') || normalized.includes('wiki')) return 'pages';
    if (normalized.includes('home') || normalized.includes('front') || normalized === 'default') return 'home';
    return null;
};

const extractPageRefFromPath = (path: string, courseExternalId: string) => {
    const escapedCourseId = escapeRegExp(courseExternalId);
    const match = path.match(new RegExp(`^/(?:api/v1/)?courses/${escapedCourseId}/pages/(.+)$`));
    if (!match) return null;
    return decodeURIComponent(match[1].replace(/[?#].*$/, ''));
};

export const resolveCanvasPageReference = (href: string, courseExternalId: string) => {
    try {
        const parsed = new URL(href, globalThis.location?.origin ?? 'https://semestra.local');
        return extractPageRefFromPath(parsed.pathname, courseExternalId);
    } catch {
        return extractPageRefFromPath(href, courseExternalId);
    }
};

export const resolveCanvasPageReferenceFromAnchor = (anchor: HTMLAnchorElement, courseExternalId: string) => {
    const endpoint = anchor.dataset.apiEndpoint;
    if (endpoint) {
        const endpointPageRef = resolveCanvasPageReference(endpoint, courseExternalId);
        if (endpointPageRef) {
            return endpointPageRef;
        }
    }

    const href = anchor.getAttribute('href');
    if (!href) return null;
    return resolveCanvasPageReference(href, courseExternalId);
};

export const resolveCanvasHomeLandingTarget = (defaultView?: string | null): CanvasHomeLandingTarget => {
    const sectionKey = resolveCanvasNavSectionKey(defaultView);
    if (sectionKey === 'announcements' || sectionKey === 'modules') {
        return sectionKey;
    }
    if (sectionKey === 'pages' || sectionKey === 'home' || !defaultView?.trim()) {
        return 'page';
    }
    return 'external';
};

export const resolveCanvasHomePageRef = (pages: CanvasPageSummaryLike[]) => {
    const frontPage = pages.find((page) => page.front_page);
    return frontPage?.url ?? pages[0]?.url ?? null;
};

export const formatCanvasPageTimestamp = (value: string | null | undefined) => {
    if (!value) return 'Unknown time';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Unknown time';
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(parsed);
};
