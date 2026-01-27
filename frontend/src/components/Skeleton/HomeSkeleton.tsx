import React from 'react';
import { Skeleton } from './Skeleton';
import { Container } from '../Container';

export const HomeSkeleton: React.FC = () => {
    return (
        <>
            {/* Hero Section */}
            <div style={{
                paddingTop: '60px',
                paddingBottom: '3rem',
                background: 'linear-gradient(to bottom right, var(--color-bg-secondary), var(--color-bg-primary))'
            }}>
                <Container>
                    <div className="page-header" style={{ marginBottom: 0 }}>
                        <div style={{ flex: 1 }}>
                            <Skeleton width="150px" height="1rem" style={{ marginBottom: '0.5rem' }} />
                            <Skeleton width="300px" height="3.5rem" style={{ marginBottom: '0.5rem' }} />
                            <Skeleton width="200px" height="1rem" />
                        </div>
                         <Skeleton width="150px" height="3rem" style={{ borderRadius: '20px' }} />
                    </div>
                </Container>
            </div>

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
        </>
    );
};
