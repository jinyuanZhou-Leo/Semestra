import React from 'react';
import { Layout } from './Layout';
import { Container } from './Container';
import { CardSkeleton } from './skeletons';

export const PageSkeleton: React.FC = () => {
    return (
        <Layout>
            <Container className="py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <CardSkeleton key={i} className="h-[240px]" />
                    ))}
                </div>
            </Container>
        </Layout>
    );
};
