import React, { type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary';
    fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    fullWidth = false,
    style,
    ...props
}) => {
    const baseStyle: React.CSSProperties = {
        padding: '0.75rem 1.5rem',
        borderRadius: 'var(--radius-md)',
        fontSize: '1rem',
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 0.2s, transform 0.1s',
        width: fullWidth ? '100%' : 'auto',
        ...style
    };

    const variantStyles = {
        primary: {
            backgroundColor: 'var(--color-accent-primary)',
            color: 'var(--color-accent-text)',
        },
        secondary: {
            backgroundColor: 'var(--color-bg-tertiary)',
            color: 'var(--color-text-primary)',
        }
    };

    return (
        <button
            style={{ ...baseStyle, ...variantStyles[variant] }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            {...props}
        >
            {children}
        </button>
    );
};
