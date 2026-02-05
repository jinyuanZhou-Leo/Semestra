import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Container } from '../Container';

export const ProgramSkeleton: React.FC = () => {
    return (
        <Container className="py-10 md:py-12">
            <Skeleton className="mb-8 h-12 w-full rounded-md" />

            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <Skeleton className="h-8 w-[150px]" />
                <Skeleton className="h-10 w-[140px] rounded-[20px]" />
            </div>

            <div className="mb-16 grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex h-[200px] flex-col">
                        <Skeleton className="h-full w-full rounded-lg" />
                    </div>
                ))}
            </div>
        </Container>
    );
};
