// input:  [public plugin-system tab contracts, shared template settings helpers, plugin-sdk settings bucket, and form primitives]
// output: [`TemplateTab` and `TemplateTabDefinition` for the template plugin runtime]
// pos:    [starter tab runtime that reads and writes settings via the plugin settings bucket (usePluginSettingsBucketWithScope) instead of host-passed TabProps.settings/updateSettings]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React, { useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { TabDefinition, TabProps } from '@/plugin-system';
import { usePluginSettingsBucketWithScope } from '@/plugin-sdk';

import { resolveTemplateSettings } from './shared';

const TEMPLATE_SETTINGS_KEY = 'tab-template';

const TemplateTabComponent: React.FC<TabProps> = ({ semesterId, courseId }) => {
    const templateScope = useMemo(() => (
        courseId
            ? { kind: 'course' as const, courseId }
            : { kind: 'semester' as const, semesterId: semesterId ?? '__missing__' }
    ), [courseId, semesterId]);
    const bucket = usePluginSettingsBucketWithScope(TEMPLATE_SETTINGS_KEY, templateScope);
    const resolved = useMemo(() => resolveTemplateSettings(bucket.resolvedSettings), [bucket.resolvedSettings]);

    const handleNoteChange = useCallback((value: string) => {
        void bucket.updateField('note', value);
    }, [bucket]);

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
                                <li>Read settings via <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">usePluginSettingsBucketWithScope</code>.</li>
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
                            This textarea writes directly to the plugin settings bucket. Use it as a placeholder for any editable content.
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

export const TemplateTabDefinition: TabDefinition = {
    type: 'tab-template',
    component: TemplateTab,
};
