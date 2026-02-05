import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ProgramCardSkeletonProps {
    className?: string;
}

export const ProgramCardSkeleton: React.FC<ProgramCardSkeletonProps> = ({ className }) => {
    return (
        <Card className={cn("h-full", className)}>
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
                <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Skeleton className="h-3 w-12 mb-1" />
                        <Skeleton className="h-6 w-16" />
                    </div>
                    <div className="text-right">
                        <Skeleton className="h-3 w-16 mb-1 ml-auto" />
                        <Skeleton className="h-5 w-20 ml-auto" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
