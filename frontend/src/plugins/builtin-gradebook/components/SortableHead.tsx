// input:  [active gradebook sort key/direction, request-sort callback, and shadcn table head primitive]
// output: [`SortableHead` clickable table header cell for gradebook assessment sorting]
// pos:    [builtin-gradebook presentational subcomponent that renders consistent sortable table headings]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

import type { GradebookSortDirection, GradebookSortKey } from '../shared';

type SortableHeadProps = {
    label: string;
    sortKey: GradebookSortKey;
    currentSortKey: GradebookSortKey;
    currentDirection: GradebookSortDirection;
    onRequestSort: (sortKey: GradebookSortKey) => void;
    align?: 'left' | 'right';
};

export const SortableHead: React.FC<SortableHeadProps> = ({
    label,
    sortKey,
    currentSortKey,
    currentDirection,
    onRequestSort,
    align = 'left',
}) => {
    const isActive = currentSortKey === sortKey;
    const icon = isActive
        ? currentDirection === 'asc'
            ? <ArrowUp className="ml-2 h-4 w-4 text-foreground" />
            : currentDirection === 'desc'
                ? <ArrowDown className="ml-2 h-4 w-4 text-foreground" />
                : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />
        : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;

    return (
        <TableHead
            className={cn(
                'cursor-pointer select-none transition-colors hover:bg-muted/50',
                align === 'right' ? 'text-right' : '',
            )}
            onClick={() => onRequestSort(sortKey)}
        >
            <div className={cn('flex items-center', align === 'right' ? 'justify-end' : '')}>
                <span>{label}</span>
                {icon}
            </div>
        </TableHead>
    );
};
