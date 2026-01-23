import React from 'react';

interface ContainerProps {
    children: React.ReactNode;
    maxWidth?: string;
    padding?: string;
    style?: React.CSSProperties;
}

export const Container: React.FC<ContainerProps> = ({ 
    children, 
    maxWidth = '1200px', 
    padding = '0 2rem',
    style 
}) => {
    return (
        <div style={{
            maxWidth,
            margin: '0 auto',
            padding,
            width: '100%',
            boxSizing: 'border-box',
            ...style
        }}>
            {children}
        </div>
    );
};
