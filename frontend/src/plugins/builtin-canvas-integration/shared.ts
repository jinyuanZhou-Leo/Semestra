// input:  [Canvas navigation/page API payloads, Canvas anchor metadata, and expanded plugin tab section-key contracts]
// output: [builtin-canvas-integration plugin constants plus Canvas section key types, LMS URL resolution, page-link parsing, and timestamp formatting helpers]
// pos:    [Shared helper layer for the Canvas navigation tab runtime]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export const BUILTIN_CANVAS_INTEGRATION_PLUGIN_ID = 'builtin-canvas-integration';
export const BUILTIN_CANVAS_PAGES_TAB_TYPE = 'builtin-canvas-integration';

export type CanvasNavSectionKey = 'home' | 'announcements' | 'assignments' | 'grades' | 'modules' | 'pages' | 'quizzes' | 'syllabus';
export type CanvasHomeLandingTarget = Exclude<CanvasNavSectionKey, 'home'> | null;

export interface CanvasPageSummaryLike {
    url: string;
    front_page: boolean;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractPageRefFromPath = (path: string, courseExternalId: string) => {
    const escapedCourseId = escapeRegExp(courseExternalId);
    const match = path.match(new RegExp(`^/(?:api/v1/)?courses/${escapedCourseId}/pages/(.+)$`));
    if (!match) return null;
    return decodeURIComponent(match[1].replace(/[?#].*$/, ''));
};

export const resolveCanvasHref = (href: string, canvasOrigin?: string | null) => {
    const normalizedHref = href.trim();
    if (!normalizedHref) {
        return null;
    }
    if (/^(https?:|mailto:|tel:)/i.test(normalizedHref)) {
        return normalizedHref;
    }
    if (!canvasOrigin) {
        return null;
    }
    try {
        return new URL(normalizedHref, canvasOrigin).toString();
    } catch {
        return null;
    }
};

export const resolveCanvasPageReference = (href: string, courseExternalId: string, canvasOrigin?: string | null) => {
    const resolvedHref = resolveCanvasHref(href, canvasOrigin);
    if (!resolvedHref) {
        return extractPageRefFromPath(href, courseExternalId);
    }
    try {
        const parsed = new URL(resolvedHref);
        return extractPageRefFromPath(parsed.pathname, courseExternalId);
    } catch {
        return extractPageRefFromPath(href, courseExternalId);
    }
};

export const resolveCanvasPageReferenceFromAnchor = (
    anchor: HTMLAnchorElement,
    courseExternalId: string,
    canvasOrigin?: string | null,
) => {
    const endpoint = anchor.dataset.apiEndpoint;
    if (endpoint) {
        const endpointPageRef = resolveCanvasPageReference(endpoint, courseExternalId, canvasOrigin);
        if (endpointPageRef) {
            return endpointPageRef;
        }
    }

    const href = anchor.getAttribute('href');
    if (!href) return null;
    return resolveCanvasPageReference(href, courseExternalId, canvasOrigin);
};

export const resolveCanvasHomePageRef = (pages: CanvasPageSummaryLike[]) => {
    const frontPage = pages.find((page) => page.front_page);
    return frontPage?.url ?? null;
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
