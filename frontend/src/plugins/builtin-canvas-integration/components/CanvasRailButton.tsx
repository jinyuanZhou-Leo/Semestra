// input:  [Canvas navigation entries and helper metadata]
// output: [CanvasRailButton presentational component for the left course menu]
// pos:    [left-rail menu item component for the Canvas integration tab]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { ExternalLink, FileText } from 'lucide-react';

import { cn } from '@/lib/utils';

import {
    SECTION_META,
    type CanvasNavigationEntry,
} from '../tab-helpers';

export const CanvasRailButton: React.FC<{
    entry: CanvasNavigationEntry;
    selected: boolean;
    onSelectEntry: (entryId: string) => void;
}> = ({ entry, selected, onSelectEntry }) => {
    const Icon = entry.section ? SECTION_META[entry.section].icon : FileText;

    return (
        <button
            type="button"
            aria-current={selected ? 'page' : undefined}
            className={cn(
                'flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm transition-colors',
                selected
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground/75 hover:bg-muted/70 hover:text-foreground',
            )}
            onClick={() => onSelectEntry(entry.id)}
        >
            <span
                className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-md',
                    selected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                )}
            >
                <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 truncate font-medium">{entry.label}</span>
            {entry.kind === 'external' ? <ExternalLink className="ml-auto size-3.5 shrink-0 text-muted-foreground" /> : null}
        </button>
    );
};
