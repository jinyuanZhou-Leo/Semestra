// input:  [Canvas page payloads, shared HTML fragment renderer, shadcn alert or badge or button primitives, and iconography]
// output: [CanvasPageDetailView and CanvasPageListView presentational components]
// pos:    [page list/detail components for the Canvas integration tab, including Home/front-page detail rendering and locked-page alert callouts]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { AlertCircle, ArrowLeft, ExternalLink } from 'lucide-react';

import { AppEmptyState } from '@/components/AppEmptyState';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LmsCoursePageDetail, LmsCoursePageSummary } from '@/services/api';

import { formatCanvasPageTimestamp } from '../shared';
import { CanvasHtmlFragment } from './CanvasHtmlFragment';

export const CanvasPageDetailView: React.FC<{
    heading: string;
    page: LmsCoursePageDetail;
    courseExternalId: string;
    canvasOrigin?: string | null;
    onBack?: () => void;
    onNavigateToPage: (pageRef: string) => void;
}> = ({ heading, page, courseExternalId, canvasOrigin, onBack, onNavigateToPage }) => (
    <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-border/60 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                    {onBack ? (
                        <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit" onClick={onBack}>
                            <ArrowLeft className="size-3.5" />
                            Back to {heading}
                        </Button>
                    ) : null}
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
                <Alert className="mb-4">
                    <AlertCircle className="size-4" />
                    <AlertTitle>Locked in Canvas</AlertTitle>
                    <AlertDescription>{page.lock_explanation}</AlertDescription>
                </Alert>
            ) : null}

            {page.body ? (
                <CanvasHtmlFragment
                    body={page.body}
                    courseExternalId={courseExternalId}
                    canvasOrigin={canvasOrigin}
                    onNavigateToPage={onNavigateToPage}
                />
            ) : (
                <p className="text-sm text-muted-foreground">This page does not have any visible content.</p>
            )}
        </div>
    </div>
);

export const CanvasPageListView: React.FC<{
    heading: string;
    pages: LmsCoursePageSummary[];
    selectedPageRef: string | null;
    onSelectPage: (pageRef: string) => void;
}> = ({ heading, pages, selectedPageRef, onSelectPage }) => {
    if (pages.length === 0) {
        return (
            <AppEmptyState
                scenario="no-results"
                size="section"
                surface="inherit"
                title="No Canvas pages"
                description="This Canvas course does not have any pages yet."
                className="h-full"
            />
        );
    }

    return (
        <div className="min-h-0 overflow-y-auto">
            <div className="border-b border-border/60 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-foreground">{heading}</h2>
                    <Badge variant="outline">{pages.length}</Badge>
                </div>
            </div>
            <div className="divide-y divide-border/60">
                {pages.map((page) => (
                    <button
                        key={String(page.page_id)}
                        type="button"
                        className={cn(
                            'flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40',
                            selectedPageRef === page.url ? 'bg-primary/5' : '',
                        )}
                        onClick={() => onSelectPage(page.url)}
                    >
                        <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-base font-semibold text-foreground">{page.title}</h3>
                                {page.front_page ? <Badge variant="outline">Home</Badge> : null}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Updated {formatCanvasPageTimestamp(page.updated_at)}
                            </p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};
