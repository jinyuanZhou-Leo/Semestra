import React, { type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    style,
    ...props
}) => {
    const sizeStyles = {
        sm: {
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
        },
        md: {
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
        },
        lg: {
            padding: '1rem 2rem',
            fontSize: '1.125rem',
        }
    };

    const baseStyle: React.CSSProperties = {
        borderRadius: 'var(--radius-md)',
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 0.2s, transform 0.1s',
        width: fullWidth ? '100%' : 'auto',
        ...sizeStyles[size],
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
