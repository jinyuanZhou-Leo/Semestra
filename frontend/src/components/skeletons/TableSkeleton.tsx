import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface TableSkeletonProps {
    className?: string;
    rows?: number;
    columns?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
    className,
    rows = 5,
    columns = 4
}) => {
    return (
        <div className={cn("rounded-md border", className)}>
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        {Array.from({ length: columns }, (_, i) => (
                            <TableHead key={i}>
                                <Skeleton className="h-4 w-24" />
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Array.from({ length: rows }, (_, rowIndex) => (
                        <TableRow key={rowIndex} className="hover:bg-transparent">
                            {Array.from({ length: columns }, (_, colIndex) => (
                                <TableCell key={colIndex}>
                                    <Skeleton className="h-4 w-full" />
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};
