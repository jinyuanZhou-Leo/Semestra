import React from 'react';
import { Card } from './Card';

interface SettingsSectionProps {
    title?: string;
    description?: string;
    children: React.ReactNode;
    headerAction?: React.ReactNode;
    center?: boolean;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
    title,
    description,
    children,
    headerAction,
    center = false
}) => {
    return (
        <Card
            as="section"
            style={{
                display: 'flex',
                gap: '1.25rem',
                flexWrap: 'wrap',
                alignItems: center ? 'center' : 'flex-start'
            }}
        >
            {(title || description || headerAction) && (
                <div style={{ minWidth: '220px', flex: '0 0 220px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {title && (
                            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}>
                                {title}
                            </div>
                        )}
                        {description && (
                            <p style={{
                                margin: 0,
                                fontSize: '0.95rem',
                                color: 'var(--color-text-primary)',
                                lineHeight: 1.5
                            }}>
                                {description}
                            </p>
                        )}
                        {headerAction && (
                            <div style={{ marginTop: '0.5rem' }}>
                                {headerAction}
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div style={{ flex: '1 1 320px', minWidth: '240px' }}>
                {children}
            </div>
        </Card>
    );
};
