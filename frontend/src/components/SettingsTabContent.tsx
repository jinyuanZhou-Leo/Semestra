import React from 'react';
import { SettingsForm } from './SettingsForm';
import { SettingsSection } from './SettingsSection';

interface SettingsTabContentProps {
    title?: string | null;
    initialName: string;
    initialSettings?: any;
    onSave: (data: any) => Promise<void>;
    type: 'program' | 'semester' | 'course';
    extraSections?: React.ReactNode;
}

export const SettingsTabContent: React.FC<SettingsTabContentProps> = ({
    title,
    initialName,
    initialSettings,
    onSave,
    type,
    extraSections
}) => {
    const ariaTitle = title ?? (type === 'semester'
        ? 'Semester Settings'
        : type === 'course'
            ? 'Course Settings'
            : 'Program Settings');
    const contextLabel = type === 'semester'
        ? 'Semester'
        : type === 'course'
            ? 'Course'
            : 'Program';

    return (
        <div
            role="region"
            aria-label={ariaTitle}
            style={{ padding: '0.75rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--color-text-secondary)',
                    background: 'var(--color-bg-tertiary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '999px',
                    padding: '0.1rem 0.5rem',
                    fontWeight: 600
                }}>
                    {contextLabel}
                </span>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
                    Manage core information and preferences for this {type}.
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <SettingsSection
                    title="General"
                    description={`Update the name and key settings for this ${type}.`}
                >
                    <SettingsForm
                        initialName={initialName}
                        initialSettings={initialSettings}
                        onSave={onSave}
                        type={type}
                        submitLabel="Save Settings"
                    />
                </SettingsSection>

                {extraSections && (
                    <SettingsSection
                        title="Plugins"
                        description={`Configure installed plugins and their settings for this ${type}.`}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {extraSections}
                        </div>
                    </SettingsSection>
                )}
            </div>
        </div>
    );
};
