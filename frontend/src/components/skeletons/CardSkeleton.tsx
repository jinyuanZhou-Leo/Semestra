// input:  [optional className and skeleton UI primitive]
// output: [`CardSkeleton` component]
// pos:    [Generic card-shaped loading placeholder]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface CardSkeletonProps {
    className?: string;
    showHeader?: boolean;
    showFooter?: boolean;
    linesCount?: number;
}

function getSkeletonLineWidthClass(index: number): string {
    switch (index) {
        case 0:
            return 'w-full';
        case 1:
            return 'w-5/6';
        default:
            return 'w-4/6';
    }
}

export function CardSkeleton({
    className,
    showHeader = true,
    showFooter = false,
    linesCount = 3
}: CardSkeletonProps): React.ReactElement {
    return (
        <Card className={cn("h-full", className)}>
            {showHeader && (
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <Skeleton className="h-5 w-32" />
                </CardHeader>
            )}
            <CardContent className="space-y-3">
                {Array.from({ length: linesCount }, (_, i) => (
                    <Skeleton
                        key={i}
                        className={cn(
                            "h-4",
                            getSkeletonLineWidthClass(i)
                        )}
                    />
                ))}
            </CardContent>
            {showFooter && (
                <CardContent className="pt-0">
                    <Skeleton className="h-4 w-20" />
                </CardContent>
            )}
        </Card>
    );
}
