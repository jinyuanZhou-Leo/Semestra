// input:  [children node, semantic width variant, optional inline style overrides, and class merge helper]
// output: [`Container` component plus shared container-size definitions]
// pos:    [Common page wrapper that normalizes horizontal spacing while allowing distinct reading, settings, and workspace widths]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { cn } from '@/lib/utils';
import React from 'react';

const CONTAINER_SIZE_CLASSNAMES = {
    narrow: 'max-w-3xl',
    default: 'max-w-6xl',
    wide: 'max-w-[96rem]',
    full: 'max-w-none',
} as const;

export type ContainerSize = keyof typeof CONTAINER_SIZE_CLASSNAMES;

interface ContainerProps {
    children: React.ReactNode;
    size?: ContainerSize;
    style?: React.CSSProperties;
    className?: string;
}

export const Container: React.FC<ContainerProps> = ({ 
    children, 
    size = 'default',
    style,
    className
}) => {
    return (
        <div
            className={cn(
                'mx-auto w-full px-4 sm:px-6 lg:px-8',
                CONTAINER_SIZE_CLASSNAMES[size],
                className,
            )}
            style={style}
        >
            {children}
        </div>
    );
};
