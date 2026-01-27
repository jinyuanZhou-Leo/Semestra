import React from 'react';

interface SkeletonProps {
    className?: string;
    style?: React.CSSProperties;
    width?: string | number;
    height?: string | number;
    variant?: 'rect' | 'circle' | 'text';
}

export const Skeleton: React.FC<SkeletonProps> = ({
    className = '',
    style,
    width,
    height,
    variant = 'rect',
}) => {
    const borderRadius = variant === 'circle' ? '50%' : variant === 'text' ? '4px' : 'var(--radius-md)';
    const computedHeight = height || (variant === 'text' ? '1em' : undefined);

    return (
        <>
            <style>{`
                @keyframes skeleton-shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .skeleton-base {
                    background-color: var(--color-bg-secondary);
                    overflow: hidden;
                    position: relative;
                }
                .skeleton-base::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 100%;
                    width: 100%;
                    background: linear-gradient(90deg, transparent 0%, var(--color-bg-tertiary) 50%, transparent 100%);
                    opacity: 0.5;
                    animation: skeleton-shimmer 1.5s infinite linear;
                }
            `}</style>
            <div
                className={`skeleton-base ${className}`}
                style={{
                    width,
                    height: computedHeight,
                    borderRadius,
                    ...style,
                }}
            />
        </>
    );
};
