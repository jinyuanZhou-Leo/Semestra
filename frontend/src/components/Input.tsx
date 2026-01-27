import React, { type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    wrapperStyle?: React.CSSProperties;
    rightElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, style, wrapperStyle, rightElement, onFocus, onBlur, ...props }, ref) => {
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
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                    ref={ref}
                    style={{
                        padding: '0.75rem',
                        paddingRight: rightElement ? '2.5rem' : '0.75rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-bg-primary)',
                        color: 'var(--color-text-primary)',
                        fontSize: '1rem',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                        width: '100%',
                        ...style
                    }}
                    onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
                        onFocus?.(e);
                    }}
                    onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-border)';
                        onBlur?.(e);
                    }}
                    {...props}
                />
                {rightElement && (
                    <div style={{
                        position: 'absolute',
                        right: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-text-tertiary)'
                    }}>
                        {rightElement}
                    </div>
                )}
            </div>
        </div>
    );
});

Input.displayName = "Input";

