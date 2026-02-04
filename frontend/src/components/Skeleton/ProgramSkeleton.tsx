import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Container } from '../Container';

export const ProgramSkeleton: React.FC = () => {
    return (
        <Container padding="3rem 2rem">
            <Skeleton className="mb-8 h-12 w-full rounded-md" />

            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <Skeleton className="h-8 w-[150px]" />
                <Skeleton className="h-10 w-[140px] rounded-[20px]" />
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '2rem',
                marginBottom: '4rem'
            }}>
                {[1, 2, 3].map(i => (
                    <div key={i} style={{ height: '200px', display: 'flex', flexDirection: 'column' }}>
                        <Skeleton className="h-full w-full rounded-lg" />
                    </div>
                ))}
            </div>
        </Container>
    );
};
