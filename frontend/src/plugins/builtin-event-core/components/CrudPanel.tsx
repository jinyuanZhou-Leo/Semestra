import React from 'react';
import { RefreshCw } from 'lucide-react';
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
    <div className="overflow-x-auto rounded-md border border-border/70">
        <div className={minWidthClassName}>
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
    <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
            <h3 className="text-base font-semibold tracking-tight">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {right}
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
        <div className="space-y-4">
            <div className="px-1">
                <PanelHeader
                    title={title}
                    description={description}
                    right={actionButton}
                />
            </div>
            <div className="rounded-md border border-border/70 p-0">
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
        </div>
    );
}

export { TableShell, EmptyTableRow, PanelHeader };
