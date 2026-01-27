import React from 'react';
import { Skeleton } from './Skeleton';
import { Container } from '../Container';

export const ProgramSkeleton: React.FC = () => {
    return (
        <>
            {/* Hero Section */}
            <div style={{
                paddingTop: '60px',
                paddingBottom: '3rem',
                background: 'linear-gradient(to bottom right, var(--color-bg-secondary), var(--color-bg-primary))'
            }}>
                <Container>
                     <Skeleton width="100px" height="1rem" style={{ marginBottom: '1rem' }} />
                     <Skeleton width="140px" height="0.9rem" style={{ marginBottom: '0.5rem' }} />
                    <div className="page-header" style={{ marginBottom: '2.5rem' }}>
                         <Skeleton width="50%" height="3.5rem" />
                         <Skeleton variant="circle" width={40} height={40} />
                    </div>

                    <div className="program-stats-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '1.5rem'
                    }}>
                        {[1, 2, 3].map(i => (
                            <Skeleton key={i} height="100px" style={{ borderRadius: 'var(--radius-lg)' }} />
                        ))}
                    </div>
                </Container>
            </div>

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
        </>
    );
};
