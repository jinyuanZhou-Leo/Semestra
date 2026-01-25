import React, { type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    wrapperStyle?: React.CSSProperties;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, style, wrapperStyle, ...props }, ref) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', ...wrapperStyle }}>
            {label && (
                <label style={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'var(--color-text-secondary)'
                }}>
                    {label}
                </label>
            )}
            <input
                ref={ref}
                style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg-primary)',
                    color: 'var(--color-text-primary)',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    ...style
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-accent-primary)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                {...props}
            />
        </div>
    );
});

Input.displayName = "Input";
