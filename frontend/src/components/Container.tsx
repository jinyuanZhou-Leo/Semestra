import { cn } from '@/lib/utils';
import React from 'react';

interface ContainerProps {
    children: React.ReactNode;
    maxWidth?: string; // Kept for backwards compatibility but handled via classes generally
    padding?: string; // Kept for backwards compatibility
    style?: React.CSSProperties;
    className?: string;
}

export const Container: React.FC<ContainerProps> = ({ 
    children, 
    maxWidth, 
    padding,
    style,
    className
}) => {
    return (
        <div
            className={cn('w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8', className)}
            style={{
                ...(maxWidth ? { maxWidth } : {}),
                ...(padding ? { padding } : {}),
                ...style
            }}
        >
            {children}
        </div>
    );
};
