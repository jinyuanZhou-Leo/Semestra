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
        ? 'Semester Setting'
        : type === 'course'
            ? 'Course Setting'
            : 'Program Setting';

    return (
        <div style={{ padding: '0.75rem 0', display: 'flex', flexDirection: 'column', gap: '2.5rem', userSelect: 'none' }}>
            <div
                role="region"
                aria-label={ariaTitle}
                style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
                <h3 style={{
                    margin: 0,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    paddingLeft: '0.25rem'
                }}>
                    {contextLabel}
                </h3>

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
            </div>

            {extraSections && (
                <div
                    role="region"
                    aria-label="Plugin Settings"
                    style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}
                >
                    {extraSections}
                </div>
            )}
        </div>
    );
};
