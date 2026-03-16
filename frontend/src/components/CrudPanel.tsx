// input:  [CRUD section copy, row/header render callbacks, shared table primitives, and optional loading/action controls]
// output: [`CrudPanel`, `TableShell`, `PanelHeader`, and `EmptyTableRow` helpers for settings CRUD tables]
// pos:    [shared settings-table shell that keeps header actions and horizontal scrolling mobile-safe across CRUD surfaces]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

const TableShell: React.FC<{ children: React.ReactNode; minWidthClassName?: string }> = ({
    children,
    minWidthClassName = 'min-w-[720px]',
}) => (
    <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-md border border-border/70">
        <div className={cn('min-w-full', minWidthClassName)}>
            {children}
        </div>
    </div>
);

const EmptyTableRow: React.FC<{ colSpan: number; message: string }> = ({ colSpan, message }) => (
    <TableRow>
        <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-muted-foreground">
            {message}
        </TableCell>
    </TableRow>
);

const PanelHeader: React.FC<{
    title: string;
    description: string;
    right?: React.ReactNode;
}> = ({ title, description, right }) => (
    <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
            <h3 className="text-base font-semibold tracking-tight">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {right ? (
            <div className="flex w-full min-w-0 sm:w-auto sm:justify-end">
                {right}
            </div>
        ) : null}
    </div>
);

export interface CrudPanelProps<T> {
    title: string;
    description: string;
    actionButton?: React.ReactNode;
    items: T[];
    renderHeader: () => React.ReactNode;
    renderRow: (item: T, index: number) => React.ReactNode;
    emptyMessage?: string;
    minWidthClassName?: string;
    isLoading?: boolean;
}

export function CrudPanel<T>({
    title,
    description,
    actionButton,
    items,
    renderHeader,
    renderRow,
    emptyMessage = 'No items found.',
    minWidthClassName,
    isLoading,
}: CrudPanelProps<T>) {
    return (
        <div className="w-full min-w-0 space-y-4 [&_[data-slot=button][data-variant=destructive][data-size=icon]]:bg-transparent [&_[data-slot=button][data-variant=destructive][data-size=icon-sm]]:bg-transparent [&_[data-slot=button][data-variant=destructive][data-size=icon-xs]]:bg-transparent [&_[data-slot=button][data-variant=destructive][data-size=icon-lg]]:bg-transparent [&_[data-slot=button][data-variant=destructive][data-size=icon]:hover]:bg-destructive/20 [&_[data-slot=button][data-variant=destructive][data-size=icon-sm]:hover]:bg-destructive/20 [&_[data-slot=button][data-variant=destructive][data-size=icon-xs]:hover]:bg-destructive/20 [&_[data-slot=button][data-variant=destructive][data-size=icon-lg]:hover]:bg-destructive/20">
            <div className="w-full min-w-0 px-1">
                <PanelHeader
                    title={title}
                    description={description}
                    right={actionButton}
                />
            </div>
            <TableShell minWidthClassName={minWidthClassName}>
                <Table>
                    <TableHeader>{renderHeader()}</TableHeader>
                    <TableBody>
                        {isLoading && (
                            <TableRow>
                                <TableCell colSpan={100} className="py-8 text-center text-sm text-muted-foreground">
                                    <div className="flex justify-center">
                                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground/50" />
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                        {!isLoading && items.length === 0 && <EmptyTableRow colSpan={100} message={emptyMessage} />}
                        {!isLoading && items.map((item, index) => renderRow(item, index))}
                    </TableBody>
                </Table>
            </TableShell>
        </div>
    );
}

export { TableShell, EmptyTableRow, PanelHeader };
