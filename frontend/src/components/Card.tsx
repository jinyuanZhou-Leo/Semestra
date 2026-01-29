import React from 'react';

interface CardProps {
    as?: React.ElementType;
    children: React.ReactNode;
    padding?: string;
    style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({ as, children, padding = '1.25rem', style }) => {
    const Component: React.ElementType = as ?? 'div';
    return (
        <Component
            style={{
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-sm)',
                padding,
                ...style
            }}
        >
            {children}
        </Component>
    );
};
