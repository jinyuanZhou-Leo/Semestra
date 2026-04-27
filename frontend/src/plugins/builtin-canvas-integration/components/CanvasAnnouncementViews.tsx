// input:  [Canvas announcement payloads, shared HTML fragment renderer, and shadcn UI/scroll-area primitives]
// output: [CanvasAnnouncementListView and CanvasAnnouncementDetailView presentational components with list-scroll restoration support]
// pos:    [announcement list/detail components for the Canvas integration tab, including stable list scroll restoration after returning from detail]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';

import { AppEmptyState } from '@/components/AppEmptyState';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { LmsAnnouncementSummary } from '@/services/api';

import { getScrollAreaViewport } from '../tab-helpers';
import { formatCanvasPageTimestamp } from '../shared';
import { CanvasHtmlFragment } from './CanvasHtmlFragment';

export const CanvasAnnouncementListView: React.FC<{
    heading: string;
    items: LmsAnnouncementSummary[];
    selectedAnnouncementId: string | null;
    initialScrollTop?: number;
    onSelectAnnouncement: (announcementId: string, scrollTop: number) => void;
}> = ({ heading, items, selectedAnnouncementId, initialScrollTop = 0, onSelectAnnouncement }) => {
    const scrollAreaRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        const viewport = getScrollAreaViewport(scrollAreaRef.current);
        if (!viewport) {
            return;
        }
        viewport.scrollTop = initialScrollTop;
    }, [initialScrollTop]);

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
        <ScrollArea ref={scrollAreaRef} className="min-h-0">
            <div className="border-b border-border/60 px-5 py-4">
                <h2 className="text-xl font-semibold text-foreground">{heading}</h2>
            </div>
            <div className="divide-y divide-border/60">
                {items.map((announcement) => (
                    <button
                        key={announcement.announcement_id}
                        type="button"
                        className={cn(
                            'flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40',
                            selectedAnnouncementId === announcement.announcement_id ? 'bg-primary/5' : '',
                        )}
                        onClick={() => onSelectAnnouncement(
                            announcement.announcement_id,
                            getScrollAreaViewport(scrollAreaRef.current)?.scrollTop ?? 0,
                        )}
                    >
                        <div className="min-w-0 space-y-1">
                            <h3 className="truncate text-base font-semibold text-foreground">{announcement.title}</h3>
                            <p className="text-sm text-muted-foreground">
                                Posted {formatCanvasPageTimestamp(announcement.posted_at ?? announcement.updated_at)}
                            </p>
                        </div>
                    </button>
                ))}
            </div>
        </ScrollArea>
    );
};

export const CanvasAnnouncementDetailView: React.FC<{
    announcement: LmsAnnouncementSummary;
    courseExternalId: string;
    canvasOrigin?: string | null;
    onBack: () => void;
    backLabel: string;
    onNavigateToPage: (pageRef: string) => void;
}> = ({ announcement, courseExternalId, canvasOrigin, onBack, backLabel, onNavigateToPage }) => (
    <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-border/60 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                    <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit" onClick={onBack}>
                        <ArrowLeft className="size-3.5" />
                        Back to {backLabel}
                    </Button>
                    <h2 className="text-xl font-semibold text-foreground">{announcement.title}</h2>
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
        </div>
        <ScrollArea className="min-h-0 flex-1">
            <div className="px-5 py-5">
            {announcement.body ? (
                <CanvasHtmlFragment
                    body={announcement.body}
                    courseExternalId={courseExternalId}
                    canvasOrigin={canvasOrigin}
                    onNavigateToPage={onNavigateToPage}
                />
            ) : (
                <p className="text-sm text-muted-foreground">This announcement does not include a message body.</p>
            )}
            </div>
        </ScrollArea>
    </div>
);
