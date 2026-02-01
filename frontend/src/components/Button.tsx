import React, { type ButtonHTMLAttributes } from 'react';
import './Button.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'glass';
    size?: 'sm' | 'md' | 'lg';
    shape?: 'default' | 'rounded' | 'circle';
    fullWidth?: boolean;
    disableScale?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    shape = 'default',
    fullWidth = false,
    disableScale = false,
    className = '',
    style,
    ...props
}) => {
    const classes = [
        'btn',
        `btn-${variant}`,
        `btn-${size}`,
        shape !== 'default' ? `btn-${shape}` : '',
        fullWidth ? 'btn-full' : '',
        disableScale ? 'btn-no-scale' : '',
        className
    ].filter(Boolean).join(' ');

    return (
        <button
            className={classes}
            style={style}
            {...props}
        >
            {children}
        </button>
    );
};
