// input:  [skeleton primitives and static layout placeholder structure]
// output: [`PageSkeleton` component]
// pos:    [Route-level loading fallback for suspense and auth bootstrap states]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { Layout } from './Layout';
import { Container, type ContainerSize } from './Container';
import { CardSkeleton } from './skeletons';

const WIDE_SKELETON_ROUTES = [
    '/programs/:id',
    '/programs/:id/settings',
    '/semesters/:id',
    '/courses/:id',
];

function getPageSkeletonContainerSize(pathname: string): ContainerSize {
    return WIDE_SKELETON_ROUTES.some((pattern) => matchPath(pattern, pathname)) ? 'wide' : 'default';
}

export const PageSkeleton: React.FC = () => {
    const location = useLocation();
    const containerSize = getPageSkeletonContainerSize(location.pathname);

    return (
        <Layout>
            <Container size={containerSize} className="py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <CardSkeleton key={i} className="h-[240px]" />
                    ))}
                </div>
            </Container>
        </Layout>
    );
};
