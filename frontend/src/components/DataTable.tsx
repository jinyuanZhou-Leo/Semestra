// input:  [data-table section copy, row/header render callbacks, shared table primitives, optional loading/action controls, embedded headerless settings usage, per-surface minimum table widths, shared dropdown row-action composition, and shared fit-content column sizing defaults]
// output: [`DataTable`, `DataTableActionMenu`, `TableShell`, `PanelHeader`, and `EmptyTableRow` helpers for settings data tables]
// pos:    [shared settings-table shell that keeps header actions and horizontal scrolling mobile-safe across settings data tables, with fit-content column sizing capped by shared single-line ellipsis defaults above each surface minimum width plus a shadcn-aligned row-actions dropdown trigger]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { MoreHorizontal, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

export interface DataTableProps<T> {
    title: string;
    description: string;
    actionButton?: React.ReactNode;
    showHeader?: boolean;
    items: T[];
    renderHeader: () => React.ReactNode;
    renderRow: (item: T, index: number) => React.ReactNode;
    emptyMessage?: string;
    minWidthClassName?: string;
    isLoading?: boolean;
}

export function DataTable<T>({
    title,
    description,
    actionButton,
    showHeader = true,
    items,
    renderHeader,
    renderRow,
    emptyMessage = 'No items found.',
    minWidthClassName,
    isLoading,
}: DataTableProps<T>) {
    return (
        <div className="w-full min-w-0 space-y-4">
            {showHeader ? (
                <div className="w-full min-w-0 px-1">
                    <PanelHeader
                        title={title}
                        description={description}
                        right={actionButton}
                    />
                </div>
            ) : actionButton ? (
                <div className="flex w-full min-w-0 justify-end px-1">
                    {actionButton}
                </div>
            ) : null}
            <TableShell minWidthClassName={minWidthClassName}>
                <Table className="min-w-full w-max table-auto [&_td]:max-w-[18rem] [&_td]:overflow-hidden [&_td]:text-ellipsis [&_td]:whitespace-nowrap [&_th]:max-w-[18rem] [&_th]:overflow-hidden [&_th]:text-ellipsis [&_th]:whitespace-nowrap">
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

export function DataTableActionMenu({
    children,
    triggerLabel = 'Open menu',
    contentClassName,
    align = 'end',
    disabled = false,
}: {
    children: React.ReactNode;
    triggerLabel?: string;
    contentClassName?: string;
    align?: React.ComponentProps<typeof DropdownMenuContent>['align'];
    disabled?: boolean;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    className="h-8 w-8 p-0 data-[state=open]:bg-muted"
                    disabled={disabled}
                    aria-label={triggerLabel}
                    title={triggerLabel}
                >
                    <span className="sr-only">{triggerLabel}</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={align} className={cn('min-w-40', contentClassName)}>
                {children}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export { TableShell, EmptyTableRow, PanelHeader };
