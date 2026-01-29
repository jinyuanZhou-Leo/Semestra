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
    const mainSectionTitle = type === 'semester'
        ? 'Semester Settings'
        : type === 'course'
            ? 'Course Settings'
            : 'Program Settings';

    return (
        <div style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {title && <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>{title}</h2>}

            <SettingsSection
                title={mainSectionTitle}
                description={`Manage general settings for this ${type}.`}
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
                    title="Plugin Settings"
                    description={`Configure installed plugins for this ${type}.`}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {extraSections}
                    </div>
                </SettingsSection>
            )}
        </div>
    );
};
