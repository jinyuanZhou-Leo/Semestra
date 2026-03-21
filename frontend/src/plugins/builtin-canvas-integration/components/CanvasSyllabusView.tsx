// input:  [Canvas syllabus payload, shared HTML fragment renderer, and shadcn UI primitives]
// output: [CanvasSyllabusView presentational component for Canvas syllabus rendering]
// pos:    [syllabus renderer for the Canvas integration tab]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { ExternalLink } from 'lucide-react';

import { AppEmptyState } from '@/components/AppEmptyState';
import { Button } from '@/components/ui/button';
import type { LmsCourseSyllabusResponse } from '@/services/api';

import { CanvasHtmlFragment } from './CanvasHtmlFragment';

export const CanvasSyllabusView: React.FC<{
    heading: string;
    syllabus: LmsCourseSyllabusResponse;
    courseExternalId: string;
    canvasOrigin?: string | null;
    onNavigateToPage: (pageRef: string) => void;
}> = ({ heading, syllabus, courseExternalId, canvasOrigin, onNavigateToPage }) => (
    <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-border/60 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="truncate text-xl font-semibold text-foreground">{heading}</h2>
                    <p className="text-sm text-muted-foreground">Rendered from the live Canvas syllabus page.</p>
                </div>
                {syllabus.html_url ? (
                    <Button asChild variant="outline" size="sm" className="shrink-0">
                        <a href={syllabus.html_url} target="_blank" rel="noreferrer">
                            <ExternalLink className="size-3.5" />
                            Open in Canvas
                        </a>
                    </Button>
                ) : null}
            </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {syllabus.body ? (
                <CanvasHtmlFragment
                    body={syllabus.body}
                    courseExternalId={courseExternalId}
                    canvasOrigin={canvasOrigin}
                    onNavigateToPage={onNavigateToPage}
                />
            ) : (
                <AppEmptyState
                    scenario="no-results"
                    size="section"
                    surface="inherit"
                    title="No syllabus content"
                    description="Canvas does not currently expose any syllabus content for this course."
                    className="h-full"
                />
            )}
        </div>
    </div>
);
