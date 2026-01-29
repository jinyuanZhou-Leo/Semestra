import React from 'react';

interface SettingsSectionProps {
    title?: string;
    description?: string;
    children: React.ReactNode;
    headerAction?: React.ReactNode;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
    title,
    description,
    children,
    headerAction
}) => {
    return (
        <section style={{ marginBottom: '3rem' }}>
            {(title || description || headerAction) && (
                <div style={{
                    marginBottom: '1rem',
                    borderBottom: '1px solid var(--color-border)',
                    paddingBottom: '0.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '1rem'
                }}>
                    <div>
                        {title && (
                            <h2 style={{
                                margin: 0,
                                fontSize: '1.5rem',
                                fontWeight: 'normal',
                                color: 'var(--color-text-primary)',
                                userSelect: 'none'
                            }}>
                                {title}
                            </h2>
                        )}
                        {description && (
                            <p style={{
                                marginTop: '0.5rem',
                                marginBottom: 0,
                                fontSize: '0.9rem',
                                color: 'var(--color-text-secondary)',
                                lineHeight: 1.5,
                                userSelect: 'none'
                            }}>
                                {description}
                            </p>
                        )}
                    </div>
                    {headerAction && (
                        <div>
                            {headerAction}
                        </div>
                    )}
                </div>
            )}
            <div style={{ padding: '0.5rem 0' }}>
                {children}
            </div>
        </section>
    );
};
