import React from 'react';
import { Skeleton } from './Skeleton';
import { Container } from '../Container';

export const DashboardSkeleton: React.FC = () => {
    return (
        <>
            {/* Hero Section Skeleton */}
            <div style={{
                paddingTop: '60px', // Match heroTop
                minHeight: '140px',
                background: 'var(--gradient-hero)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                marginBottom: 'var(--spacing-lg)'
            }}>
                <Container>
                    <div style={{ marginBottom: '0.5rem' }}>
                         <Skeleton width="120px" height="1.5rem" style={{ marginBottom: '0.5rem' }} />
                        <Skeleton width="80px" height="1rem" />
                    </div>
                    
                    <div className="page-header" style={{ marginBottom: 0 }}>
                        <div style={{ flex: 1 }}>
                            <Skeleton width="60%" height="2.5rem" style={{ marginBottom: '1rem' }} />
                            <div className="stats-row" style={{ display: 'flex', gap: '2rem' }}>
                                <div>
                                    <Skeleton width="60px" height="0.8rem" style={{ marginBottom: '0.25rem' }} />
                                    <Skeleton width="40px" height="1.5rem" />
                                </div>
                                <div>
                                    <Skeleton width="60px" height="0.8rem" style={{ marginBottom: '0.25rem' }} />
                                    <Skeleton width="40px" height="1.5rem" />
                                </div>
                                <div>
                                    <Skeleton width="60px" height="0.8rem" style={{ marginBottom: '0.25rem' }} />
                                    <Skeleton width="40px" height="1.5rem" />
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Skeleton variant="circle" width={40} height={40} />
                            <Skeleton width={120} height={40} style={{ borderRadius: '20px' }} />
                        </div>
                    </div>
                </Container>
            </div>

            <Container style={{ padding: '1rem 1rem' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '1rem',
                    gridAutoRows: 'minmax(200px, auto)'
                }}>
                    {[1, 2, 3, 4].map(i => (
                        <Skeleton key={i} height="200px" style={{ borderRadius: 'var(--radius-lg)' }} />
                    ))}
                </div>
            </Container>
        </>
    );
};
