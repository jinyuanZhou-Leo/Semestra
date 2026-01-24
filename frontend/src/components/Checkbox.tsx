import React from 'react';
import { motion } from 'framer-motion';

interface CheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
    id?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onChange, label, disabled, id }) => {
    // Generate a random ID if none provided
    const inputId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

    return (
        <div style={{ display: 'flex', alignItems: 'center', cursor: disabled ? 'not-allowed' : 'pointer' }}>
            <div 
                style={{ position: 'relative', width: '20px', height: '20px' }}
                onClick={() => !disabled && onChange(!checked)}
            >
                {/* Background Box */}
                <motion.div
                    initial={false}
                    animate={{
                        backgroundColor: checked ? 'var(--color-accent-primary)' : 'transparent',
                        borderColor: checked ? 'var(--color-accent-primary)' : 'var(--color-border)',
                        scale: checked ? 1 : 1
                    }}
                    transition={{ duration: 0.2 }}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        border: '2px solid',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                     {/* Checkmark */}
                    <motion.svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--color-accent-text)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={false}
                        animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        style={{ width: '14px', height: '14px' }}
                    >
                        <motion.path d="M20 6L9 17l-5-5" />
                    </motion.svg>
                </motion.div>
                
                {/* Hidden Input for generic accessible behavior if needed, 
                    though custom click handler handles main interaction.
                    We can keep it for form submission if used in a traditional form way, 
                    but React state is usually the source of truth.
                 */}
                 <input 
                    type="checkbox"
                    id={inputId}
                    checked={checked}
                    onChange={(e) => !disabled && onChange(e.target.checked)}
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
            
            {label && (
                <label 
                    htmlFor={inputId} 
                    style={{ 
                        marginLeft: '0.75rem', 
                        fontSize: '0.875rem', 
                        color: 'var(--color-text-secondary)',
                        userSelect: 'none',
                        cursor: disabled ? 'not-allowed' : 'pointer'
                    }}
                >
                    {label}
                </label>
            )}
        </div>
    );
};
