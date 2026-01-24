import React, { type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'glass';
    size?: 'sm' | 'md' | 'lg';
    shape?: 'default' | 'rounded' | 'circle';
    fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    shape = 'default',
    fullWidth = false,
    style,
    onMouseEnter,
    onMouseLeave,
    onMouseDown,
    onMouseUp,
    ...props
}) => {
    const sizeStyles = {
        sm: {
            padding: shape === 'circle' ? '0' : '0 1rem',
            fontSize: '0.875rem',
            height: '32px',
            width: shape === 'circle' ? '32px' : 'auto',
        },
        md: {
            padding: shape === 'circle' ? '0' : '0 1.5rem',
            fontSize: '1rem',
            height: '40px',
            width: shape === 'circle' ? '40px' : 'auto',
        },
        lg: {
            padding: shape === 'circle' ? '0' : '0 2rem',
            fontSize: '1.125rem',
            height: '56px',
            width: shape === 'circle' ? '56px' : 'auto',
        }
    };

    const baseStyle: React.CSSProperties = {
        borderRadius: shape === 'rounded' ? '9999px' : shape === 'circle' ? '50%' : 'var(--radius-md)',
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        userSelect: 'none',
        ...sizeStyles[size],
        width: fullWidth ? '100%' : (shape === 'circle' ? sizeStyles[size].width : 'auto'),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        whiteSpace: 'nowrap',
    };

    const variantStyles = {
        primary: {
            backgroundColor: 'var(--color-accent-primary)',
            color: 'var(--color-accent-text)',
        },
        secondary: {
            backgroundColor: 'var(--color-bg-tertiary)',
            color: 'var(--color-text-primary)',
        },
        glass: {
            backdropFilter: 'blur(12px)',
            background: 'var(--color-bg-glass)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            boxShadow: 'var(--shadow-sm)',
        }
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.transform = 'scale(1.05)';
        onMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.transform = 'scale(1)';
        onMouseLeave?.(e);
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.transform = 'scale(0.95)';
        onMouseDown?.(e);
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.transform = 'scale(1)';
        onMouseUp?.(e);
    };

    return (
        <button
            style={{ ...baseStyle, ...variantStyles[variant], ...style }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            {...props}
        >
            {children}
        </button>
    );
};
