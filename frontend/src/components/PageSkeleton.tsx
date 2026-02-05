import React from 'react';
import { Layout } from './Layout';
import { Container } from './Container';
import { DashboardSkeleton } from './Skeleton/DashboardSkeleton';

export const PageSkeleton: React.FC = () => {
    return (
        <Layout>
            <Container className="py-4">
                <DashboardSkeleton />
            </Container>
        </Layout>
    );
};
