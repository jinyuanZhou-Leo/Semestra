import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SemesterCardSkeletonProps {
    className?: string;
}

export const SemesterCardSkeleton: React.FC<SemesterCardSkeletonProps> = ({ className }) => {
    return (
        <Card className={cn("h-full", className)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                        <Skeleton className="h-3 w-12 mb-1" />
                        <Skeleton className="h-6 w-16" />
                    </div>
                    <div className="text-right">
                        <Skeleton className="h-3 w-16 mb-1 ml-auto" />
                        <Skeleton className="h-6 w-16 ml-auto" />
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-2 w-2 rounded-full" />
                </div>
            </CardContent>
        </Card>
    );
};
