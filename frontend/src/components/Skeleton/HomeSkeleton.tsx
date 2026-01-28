import React from 'react';
import { Skeleton } from './Skeleton';
import { Container } from '../Container';

export const HomeSkeleton: React.FC = () => {
    return (
        <Container padding="3rem 2rem">
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '1.5rem'
            }}>
                {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} height="150px" style={{ borderRadius: 'var(--radius-lg)' }} />
                ))}
            </div>
        </Container>
    );
};
