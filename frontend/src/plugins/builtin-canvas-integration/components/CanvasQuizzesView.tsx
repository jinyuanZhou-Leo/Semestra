// input:  [Canvas quiz payloads, timestamp helpers, shadcn UI primitives, and shared class merging]
// output: [CanvasQuizzesView presentational component for Canvas quiz list rendering]
// pos:    [quiz list renderer for the Canvas integration tab with external-link emphasis and reduced badge chrome]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { ExternalLink } from 'lucide-react';

import { AppEmptyState } from '@/components/AppEmptyState';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { LmsQuizSummary } from '@/services/api';

import { openExternalUrl } from '../tab-helpers';
import { formatCanvasPageTimestamp } from '../shared';

export const CanvasQuizzesView: React.FC<{
    heading: string;
    items: LmsQuizSummary[];
}> = ({ heading, items }) => {
    if (items.length === 0) {
        return (
            <AppEmptyState
                scenario="no-results"
                size="section"
                surface="inherit"
                title="No quizzes"
                description="Canvas does not currently expose any quizzes for this course."
                className="h-full"
            />
        );
    }

    return (
        <div className="min-h-0 overflow-y-auto">
            <div className="border-b border-border/60 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-foreground">{heading}</h2>
                    <Badge variant="outline">{items.length}</Badge>
                </div>
            </div>
            <div className="divide-y divide-border/60">
                {items.map((quiz) => (
                    <button
                        key={quiz.quiz_id}
                        type="button"
                        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40"
                        onClick={() => openExternalUrl(quiz.html_url)}
                    >
                        <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3
                                    className={cn(
                                        'truncate text-base font-semibold text-foreground decoration-current underline-offset-4',
                                        quiz.html_url ? 'hover:underline' : '',
                                    )}
                                >
                                    {quiz.title}
                                </h3>
                                {!quiz.published ? <Badge variant="outline">Hidden</Badge> : null}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                <span>Due {formatCanvasPageTimestamp(quiz.due_at)}</span>
                                {quiz.unlock_at ? <span>Unlocks {formatCanvasPageTimestamp(quiz.unlock_at)}</span> : null}
                                {quiz.lock_at ? <span>Closes {formatCanvasPageTimestamp(quiz.lock_at)}</span> : null}
                            </div>
                            {quiz.description ? (
                                <p className="line-clamp-2 text-sm text-muted-foreground">
                                    {quiz.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}
                                </p>
                            ) : null}
                        </div>
                        {quiz.html_url ? <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> : null}
                    </button>
                ))}
            </div>
        </div>
    );
};
