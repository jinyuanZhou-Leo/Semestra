// input:  [tab registry contracts, shared template settings helpers, and form primitives]
// output: [`TemplateTab`, `TemplateTabDefinition`, and template tab instance settings UI]
// pos:    [starter tab runtime that demonstrates instance settings through `TabDefinition.SettingsComponent`]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useCallback, useId, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsSection } from '@/components/SettingsSection';
import type { TabDefinition, TabProps, TabSettingsProps } from '../../services/tabRegistry';
import { resolveTemplateSettings } from './shared';

const TemplateTabComponent: React.FC<TabProps> = ({ settings, updateSettings }) => {
    const resolved = useMemo(() => resolveTemplateSettings(settings), [settings]);

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

export const TemplateTab = TemplateTabComponent;

const TemplateTabSettingsComponent: React.FC<TabSettingsProps> = ({ settings, updateSettings }) => {
    const resolved = useMemo(() => resolveTemplateSettings(settings), [settings]);
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
                <div className="grid max-w-sm gap-2">
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
                            if (checked === 'indeterminate') return;
                            handleChecklistToggle(checked);
                        }}
                    />
                    <Label htmlFor={checklistId} className="cursor-pointer text-sm font-normal text-muted-foreground">
                        Show quick-start checklist
                    </Label>
                </div>
            </div>
        </SettingsSection>
    );
};

export const TemplateTabDefinition: TabDefinition = {
    type: 'tab-template',
    component: TemplateTab,
    SettingsComponent: TemplateTabSettingsComponent,
    defaultSettings: {
        title: 'Tab Template',
        note: '',
        showChecklist: true
    },
};
