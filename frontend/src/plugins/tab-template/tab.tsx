import React, { useCallback, useMemo } from 'react';
import { Input } from '../../components/Input';
import { Checkbox } from '../../components/Checkbox';
import type { TabDefinition, TabProps, TabSettingsProps } from '../../services/tabRegistry';

type TemplateSettings = {
    title?: string;
    note?: string;
    showChecklist?: boolean;
};

const getSettings = (settings: TemplateSettings | undefined): Required<TemplateSettings> => ({
    title: settings?.title ?? 'Tab Template',
    note: settings?.note ?? '',
    showChecklist: settings?.showChecklist ?? true
});

const TemplateTabComponent: React.FC<TabProps> = ({ settings, updateSettings }) => {
    const resolved = useMemo(() => getSettings(settings), [settings]);

    const handleNoteChange = useCallback((value: string) => {
        updateSettings({ ...resolved, note: value });
    }, [resolved, updateSettings]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
                padding: '1rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-primary)'
            }}>
                <div style={{ fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                    Template Overview
                </div>
                <div style={{ marginTop: '0.5rem', color: 'var(--color-text-primary)', fontSize: '1.1rem', fontWeight: 600 }}>
                    {resolved.title}
                </div>
                <div style={{ marginTop: '0.35rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    Use this tab as a starting point for new plugins. Swap out the blocks below with real data, and wire up
                    any settings through the settings panel.
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1rem'
            }}>
                <div style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-primary)'
                }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                        Layout Scaffold
                    </div>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                        Keep tab content focused on the main area. Avoid duplicating the tab title, and use CSS variables for
                        theme-aware colors.
                    </div>
                    {resolved.showChecklist && (
                        <ul style={{ marginTop: '0.75rem', paddingLeft: '1rem', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                            <li>Use <code style={{ color: 'var(--color-text-primary)' }}>updateSettings</code> for persistence.</li>
                            <li>Prefer <code style={{ color: 'var(--color-text-primary)' }}>useCallback</code> for handlers.</li>
                            <li>Keep layout responsive with auto-fit grids.</li>
                        </ul>
                    )}
                </div>

                <div style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-primary)'
                }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                        Persistent Notes
                    </div>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                        This textarea writes directly to tab settings. Use it as a placeholder for any editable content.
                    </div>
                    <textarea
                        value={resolved.note}
                        onChange={(event) => handleNoteChange(event.target.value)}
                        placeholder="Type notes that persist with the tab..."
                        style={{
                            width: '100%',
                            minHeight: '160px',
                            padding: '0.75rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-secondary)',
                            color: 'var(--color-text-primary)',
                            resize: 'vertical',
                            fontSize: '0.95rem',
                            lineHeight: 1.5
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

const TemplateTabSettingsComponent: React.FC<TabSettingsProps> = ({ settings, updateSettings }) => {
    const resolved = useMemo(() => getSettings(settings), [settings]);

    const handleTitleChange = useCallback((value: string) => {
        updateSettings({ ...resolved, title: value });
    }, [resolved, updateSettings]);

    const handleChecklistToggle = useCallback((checked: boolean) => {
        updateSettings({ ...resolved, showChecklist: checked });
    }, [resolved, updateSettings]);

    return (
        <div>
            <Input
                label="Template Title"
                value={resolved.title}
                onChange={(event) => handleTitleChange(event.target.value)}
            />
            <Checkbox
                checked={resolved.showChecklist}
                onChange={handleChecklistToggle}
                label="Show quick-start checklist"
            />
        </div>
    );
};

export const TemplateTab = TemplateTabComponent;
export const TemplateTabSettings = TemplateTabSettingsComponent;

export const TemplateTabDefinition: TabDefinition = {
    type: 'tab-template',
    name: 'Tab Template',
    description: 'Starter tab with editable settings and layout scaffolding.',
    icon: '',
    component: TemplateTab,
    settingsComponent: TemplateTabSettings,
    defaultSettings: {
        title: 'Tab Template',
        note: '',
        showChecklist: true
    },
    maxInstances: 'unlimited',
    allowedContexts: ['semester', 'course']
};
