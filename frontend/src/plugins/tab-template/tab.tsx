import React, { useCallback, useId, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsSection } from '../../components/SettingsSection';
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
        <div className="flex flex-col gap-4">
            <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Template Overview
                </div>
                <div className="mt-2 text-lg font-semibold text-foreground">
                    {resolved.title}
                </div>
                <div className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                    Use this tab as a starting point for new plugins. Swap out the blocks below with real data, and wire up
                    any settings through the settings panel.
                </div>
            </div>

            <div className="grid gap-4 min-[500px]:grid-cols-2 lg:grid-cols-3">
                <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                    <div className="font-semibold mb-2">
                        Layout Scaffold
                    </div>
                    <div className="text-sm text-muted-foreground leading-relaxed">
                        Keep tab content focused on the main area. Avoid duplicating the tab title, and use CSS variables for
                        theme-aware colors.
                    </div>
                    {resolved.showChecklist && (
                        <ul className="mt-3 list-disc pl-4 text-sm text-muted-foreground space-y-1">
                            <li>Use <code className="bg-muted px-1 py-0.5 rounded text-foreground font-mono text-xs">updateSettings</code> for persistence.</li>
                            <li>Prefer <code className="bg-muted px-1 py-0.5 rounded text-foreground font-mono text-xs">useCallback</code> for handlers.</li>
                            <li>Keep layout responsive with auto-fit grids.</li>
                        </ul>
                    )}
                </div>

                <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                    <div className="font-semibold mb-2">
                        Persistent Notes
                    </div>
                    <div className="text-sm text-muted-foreground mb-3">
                        This textarea writes directly to tab settings. Use it as a placeholder for any editable content.
                    </div>
                    <textarea
                        value={resolved.note}
                        onChange={(event) => handleNoteChange(event.target.value)}
                        placeholder="Type notes that persist with the tab..."
                        className="w-full min-h-[160px] p-3 rounded-md border bg-background text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                </div>
            </div>
        </div>
    );
};

const TemplateTabSettingsComponent: React.FC<TabSettingsProps> = ({ settings, updateSettings }) => {
    const resolved = useMemo(() => getSettings(settings), [settings]);
    const titleId = useId();
    const checklistId = useId();

    const handleTitleChange = useCallback((value: string) => {
        updateSettings({ ...resolved, title: value });
    }, [resolved, updateSettings]);

    const handleChecklistToggle = useCallback((checked: boolean) => {
        updateSettings({ ...resolved, showChecklist: checked });
    }, [resolved, updateSettings]);

    return (
        <SettingsSection
            title="Display"
            description="Configure how this tab is displayed."
        >
            <div className="grid gap-4">
                <div className="grid gap-2">
                    <Label htmlFor={titleId}>
                        Template Title
                    </Label>
                    <Input
                        id={titleId}
                        value={resolved.title}
                        onChange={(event) => handleTitleChange(event.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Checkbox
                        id={checklistId}
                        checked={resolved.showChecklist}
                        onCheckedChange={(checked) => {
                            if (checked === "indeterminate") return;
                            handleChecklistToggle(checked);
                        }}
                    />
                    <Label htmlFor={checklistId} className="text-sm font-normal text-muted-foreground cursor-pointer">
                        Show quick-start checklist
                    </Label>
                </div>
            </div>
        </SettingsSection>
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
