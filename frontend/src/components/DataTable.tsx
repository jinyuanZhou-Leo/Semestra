// input:  [data-table section copy, row/header render callbacks, shared table primitives, optional loading/action controls, embedded headerless settings usage, optional per-surface minimum table widths, optional root/shell/table/empty-row class overrides, shared dropdown row-action composition, shared business empty-state styling, and shared table-fill plus per-column minimum-width defaults]
// output: [`DataTable`, `DataTableActionMenu`, `TableShell`, `PanelHeader`, and `EmptyTableRow` helpers for settings data tables]
// pos:    [shared settings-table shell that keeps header actions and horizontal scrolling mobile-safe across settings data tables, keeps the title/description block and action area in a consistent left-right header layout, leaves table-level minimum-width decisions to each concrete table instead of forcing a shared default, applies small per-column minimum-width defaults while letting the table fill available width, exposes configurable root/shell/table/empty-row sizing, provides a shadcn-aligned row-actions dropdown trigger, and renders centered full-surface empty states]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { MoreHorizontal, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AppEmptyState } from '@/components/AppEmptyState';
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

const TableShell: React.FC<{
    children: React.ReactNode;
    minWidthClassName?: string;
    className?: string;
}> = ({
    children,
    minWidthClassName,
    className,
}) => (
    <div className={cn("w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-md border border-border/70", className)}>
        <div className={cn('min-w-full', minWidthClassName)}>
            {children}
        </div>
    </div>
);

const EmptyTableRow: React.FC<{ colSpan: number; message: string; className?: string }> = ({ colSpan, message, className }) => (
    <TableRow className="h-full hover:bg-transparent">
        <TableCell colSpan={colSpan} className={cn("h-full p-0 align-middle", className)}>
            <AppEmptyState
                scenario="create"
                size="section"
                surface="inherit"
                className="h-full min-h-[15rem] rounded-none border-0 px-6 py-10"
                title={message}
                description="This table is empty right now."
            />
        </TableCell>
    </TableRow>
);

const PanelHeader: React.FC<{
    title: string;
    description: string;
    right?: React.ReactNode;
}> = ({ title, description, right }) => (
    <div className="flex w-full min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-base font-semibold tracking-tight">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {right ? (
            <div className="flex shrink-0 justify-end pl-3">
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
    rootClassName?: string;
    shellClassName?: string;
    tableClassName?: string;
    emptyRowClassName?: string;
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
    rootClassName,
    shellClassName,
    tableClassName,
    emptyRowClassName,
}: DataTableProps<T>) {
    return (
        <div className={cn("w-full min-w-0 space-y-4", rootClassName)}>
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
            <TableShell minWidthClassName={minWidthClassName} className={shellClassName}>
                <Table className={cn(
                    "min-w-full w-full table-auto [&_td]:min-w-[6rem] [&_td]:max-w-[18rem] [&_td]:overflow-hidden [&_td]:text-ellipsis [&_td]:whitespace-nowrap [&_th]:min-w-[6rem] [&_th]:max-w-[18rem] [&_th]:overflow-hidden [&_th]:text-ellipsis [&_th]:whitespace-nowrap",
                    !isLoading && items.length === 0 ? 'h-full' : null,
                    tableClassName,
                )}>
                    <TableHeader>{renderHeader()}</TableHeader>
                    <TableBody className={!isLoading && items.length === 0 ? 'h-full' : undefined}>
                        {isLoading && (
                            <TableRow>
                                <TableCell colSpan={100} className="py-8 text-center text-sm text-muted-foreground">
                                    <div className="flex justify-center">
                                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground/50" />
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                        {!isLoading && items.length === 0 && <EmptyTableRow colSpan={100} message={emptyMessage} className={emptyRowClassName} />}
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
