import React from 'react';
import { Skeleton } from './Skeleton';
import { Container } from '../Container';

export const ProgramSkeleton: React.FC = () => {
    return (
        <Container padding="3rem 2rem">
            <Skeleton width="100%" height="3rem" style={{ marginBottom: '2rem', borderRadius: 'var(--radius-md)' }} />

            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <Skeleton width="150px" height="2rem" />
                <Skeleton width="140px" height="2.5rem" style={{ borderRadius: '20px' }} />
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '2rem',
                marginBottom: '4rem'
            }}>
                {[1, 2, 3].map(i => (
                    <div key={i} style={{ height: '200px', display: 'flex', flexDirection: 'column' }}>
                        <Skeleton height="100%" style={{ borderRadius: 'var(--radius-lg)' }} />
                    </div>
                ))}
            </div>
        </Container>
    );
};
