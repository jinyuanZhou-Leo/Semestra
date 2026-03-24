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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
            <Card>
                <CardHeader className="pb-3">
                    <CardDescription>Template Overview</CardDescription>
                    <CardTitle>{resolved.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm leading-relaxed text-muted-foreground">
                    Use this tab as a starting point for new plugins. Swap out the blocks below with real data, and wire up
                    any settings through the settings panel.
                </CardContent>
            </Card>

            <div className="grid gap-4 min-[500px]:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Layout Scaffold</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                        <div className="text-sm leading-relaxed text-muted-foreground">
                            Keep tab content focused on the main area. Avoid duplicating the tab title, and use CSS variables for
                            theme-aware colors.
                        </div>
                        {resolved.showChecklist && (
                            <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                                <li>Use <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">updateSettings</code> for persistence.</li>
                                <li>Prefer <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">useCallback</code> for handlers.</li>
                                <li>Keep layout responsive with auto-fit grids.</li>
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Persistent Notes</CardTitle>
                        <CardDescription>
                            This textarea writes directly to tab settings. Use it as a placeholder for any editable content.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Textarea
                            value={resolved.note}
                            onChange={(event) => handleNoteChange(event.target.value)}
                            placeholder="Type notes that persist with the tab..."
                            className="min-h-[160px] resize-y"
                        />
                    </CardContent>
                </Card>
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
