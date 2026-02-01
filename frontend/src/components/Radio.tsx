import React, { useId } from 'react';
import { motion } from 'framer-motion';

interface RadioOption<T extends string> {
    value: T;
    label: string;
    description?: string;
}

interface RadioGroupProps<T extends string> {
    value: T;
    onChange: (value: T) => void;
    options: RadioOption<T>[];
    name?: string;
    disabled?: boolean;
}

export function RadioGroup<T extends string>({ value, onChange, options, name, disabled }: RadioGroupProps<T>) {
    const generatedName = useId();
    const groupName = name ?? `radio-group-${generatedName}`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {options.map((option) => (
                <Radio
                    key={option.value}
                    name={groupName}
                    value={option.value}
                    label={option.label}
                    description={option.description}
                    checked={value === option.value}
                    onChange={() => onChange(option.value)}
                    disabled={disabled}
                />
            ))}
        </div>
    );
}

interface RadioProps {
    name: string;
    value: string;
    label: string;
    description?: string;
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
}

export const Radio: React.FC<RadioProps> = ({ name, value, label, description, checked, onChange, disabled }) => {
    const generatedId = useId();
    const inputId = `radio-${generatedId}`;

    return (
        <label 
            htmlFor={inputId}
            style={{ 
                display: 'flex', 
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.75rem',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                background: checked ? 'var(--color-bg-secondary)' : 'transparent',
                transition: 'all 0.2s',
                opacity: disabled ? 0.6 : 1
            }}
        >
            <div 
                style={{ 
                    position: 'relative', 
                    width: '20px', 
                    height: '20px',
                    flexShrink: 0,
                    marginTop: '1px'
                }}
                onClick={(e) => {
                    e.preventDefault();
                    !disabled && onChange();
                }}
            >
                {/* Outer Circle */}
                <motion.div
                    initial={false}
                    animate={{
                        borderColor: checked ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                    }}
                    transition={{ duration: 0.2 }}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        border: '2px solid',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'transparent'
                    }}
                >
                    {/* Inner Circle */}
                    <motion.div
                        initial={false}
                        animate={{
                            scale: checked ? 1 : 0,
                            opacity: checked ? 1 : 0
                        }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-accent-primary)'
                        }}
                    />
                </motion.div>
                
                <input 
                    type="radio"
                    id={inputId}
                    name={name}
                    value={value}
                    checked={checked}
                    onChange={() => !disabled && onChange()}
                    disabled={disabled}
                    style={{
                        position: 'absolute',
                        opacity: 0,
                        cursor: 'inherit',
                        width: '100%',
                        height: '100%',
                        margin: 0
                    }}
                />
            </div>
            
            <div style={{ flex: 1 }}>
                <div style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: 500,
                    color: 'var(--color-text-primary)',
                    userSelect: 'none'
                }}>
                    {label}
                </div>
                {description && (
                    <div style={{ 
                        fontSize: '0.8rem', 
                        color: 'var(--color-text-secondary)',
                        marginTop: '0.15rem',
                        userSelect: 'none'
                    }}>
                        {description}
                    </div>
                )}
            </div>
        </label>
    );
};
