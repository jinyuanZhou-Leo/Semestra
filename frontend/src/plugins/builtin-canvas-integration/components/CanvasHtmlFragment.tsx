// input:  [sanitized Canvas HTML, Canvas link helpers, and browser navigation helpers]
// output: [CanvasHtmlFragment presentational component for inline Canvas HTML rendering with tuned reading typography]
// pos:    [shared HTML body renderer used by Canvas page, syllabus, and announcement detail views]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';

import { sanitizeCanvasHtmlFragment } from '@/lib/html';

import { openExternalUrl } from '../tab-helpers';
import { resolveCanvasHref, resolveCanvasPageReferenceFromAnchor } from '../shared';

export const CanvasHtmlFragment: React.FC<{
    body: string;
    courseExternalId: string;
    canvasOrigin?: string | null;
    onNavigateToPage: (pageRef: string) => void;
}> = ({ body, courseExternalId, canvasOrigin, onNavigateToPage }) => {
    const sanitizedBody = sanitizeCanvasHtmlFragment(body);

    const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
            return;
        }

        const target = event.target;
        if (!(target instanceof Element)) return;

        const anchor = target.closest('a');
        if (!(anchor instanceof HTMLAnchorElement)) return;

        const nextPageRef = resolveCanvasPageReferenceFromAnchor(anchor, courseExternalId, canvasOrigin);
        if (nextPageRef) {
            event.preventDefault();
            onNavigateToPage(nextPageRef);
            return;
        }

        const rawHref = anchor.getAttribute('href');
        const href = rawHref ? resolveCanvasHref(rawHref, canvasOrigin) : null;
        if (!href) return;

        event.preventDefault();
        openExternalUrl(href);
    };

    return (
        <div
            className="canvas-page-body overflow-hidden text-[15px] leading-7 text-foreground sm:text-base [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:decoration-primary/40 [&_a]:underline-offset-4 hover:[&_a]:decoration-primary [&_blockquote]:my-6 [&_blockquote]:border-l-2 [&_blockquote]:border-border/80 [&_blockquote]:bg-muted/20 [&_blockquote]:px-5 [&_blockquote]:py-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_code]:rounded-md [&_code]:bg-muted/70 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.95em] [&_h1]:mb-4 [&_h1]:mt-8 [&_h1]:text-3xl [&_h1]:font-medium [&_h1]:leading-tight [&_h1:first-child]:mt-0 [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-medium [&_h2]:leading-tight [&_h3]:mb-3 [&_h3]:mt-7 [&_h3]:text-xl [&_h3]:font-medium [&_h3]:leading-snug [&_h4]:mb-2 [&_h4]:mt-6 [&_h4]:text-lg [&_h4]:font-medium [&_hr]:my-8 [&_hr]:border-border/60 [&_img]:my-6 [&_img]:max-w-full [&_img]:rounded-2xl [&_img]:border [&_img]:border-border/50 [&_img]:shadow-sm [&_li]:max-w-[72ch] [&_li]:leading-7 [&_ol]:my-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_p]:my-4 [&_p]:max-w-[72ch] [&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border/60 [&_pre]:bg-muted/35 [&_pre]:px-4 [&_pre]:py-3 [&_pre]:text-sm [&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-xl [&_table]:border [&_table]:border-border/70 [&_table]:bg-background [&_tbody_tr:nth-child(even)]:bg-muted/20 [&_td]:border [&_td]:border-border/60 [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_th]:border [&_th]:border-border/60 [&_th]:bg-muted/45 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold [&_ul]:my-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6"
            onClick={handleClick}
            dangerouslySetInnerHTML={{ __html: sanitizedBody }}
        />
    );
};
