import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface TextSkeletonProps {
    className?: string;
    variant?: 'h1' | 'h2' | 'h3' | 'body' | 'caption';
}

const variantClasses = {
    h1: 'h-9 w-64',
    h2: 'h-7 w-48',
    h3: 'h-6 w-32',
    body: 'h-4 w-full',
    caption: 'h-3 w-24'
};

export const TextSkeleton: React.FC<TextSkeletonProps> = ({
    className,
    variant = 'body'
}) => {
    return (
        <Skeleton className={cn(variantClasses[variant], className)} />
    );
};
