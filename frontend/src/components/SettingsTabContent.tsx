import React from 'react';
import { SettingsForm } from './SettingsForm';

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
            <div>
                {title ? <h2 style={{ marginTop: 0 }}>{title}</h2> : null}
                <div style={{ fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
                    {mainSectionTitle}
                </div>
                <SettingsForm
                    initialName={initialName}
                    initialSettings={initialSettings}
                    onSave={onSave}
                    type={type}
                    submitLabel="Save Settings"
                />
            </div>
            {extraSections}
        </div>
    );
};
