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

export const CardSkeleton: React.FC<CardSkeletonProps> = ({
    className,
    showHeader = true,
    showFooter = false,
    linesCount = 3
}) => {
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
                            i === 0 ? "w-full" : i === 1 ? "w-5/6" : "w-4/6"
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
};
