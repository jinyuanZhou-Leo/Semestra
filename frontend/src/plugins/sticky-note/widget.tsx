"use no memo";

import React, { useCallback, useId } from 'react';
import type { WidgetDefinition, WidgetProps, WidgetSettingsProps } from '../../services/widgetRegistry';
import { ColorPicker, type ColorPickerPreset } from '@/components/ui/color-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Eraser, StickyNote } from 'lucide-react';

type LegacyNoteTone = 'yellow' | 'mint' | 'sky' | 'rose';

interface StickyNoteSettings {
    title: string;
    content: string;
    accentColor: string;
    showTitle: boolean;
    showCharCount: boolean;
}

const STICKY_NOTE_COLOR_PRESETS: readonly ColorPickerPreset[] = [
    { name: 'Sun Yellow', value: '#f59e0b' },
    { name: 'Mint Green', value: '#10b981' },
    { name: 'Sky Blue', value: '#0ea5e9' },
    { name: 'Rose Pink', value: '#f43f5e' },
] as const;

const LEGACY_TONE_COLOR_MAP: Record<LegacyNoteTone, string> = {
    yellow: '#f59e0b',
    mint: '#10b981',
    sky: '#0ea5e9',
    rose: '#f43f5e',
};

const DEFAULT_STICKY_NOTE_SETTINGS: StickyNoteSettings = {
    title: '',
    content: '',
    accentColor: LEGACY_TONE_COLOR_MAP.yellow,
    showTitle: true,
    showCharCount: true,
};

const isHexColor = (value: unknown): value is string => {
    return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
};

const normalizeStickyNoteSettings = (settings: unknown): StickyNoteSettings => {
    if (!settings || typeof settings !== 'object') {
        return DEFAULT_STICKY_NOTE_SETTINGS;
    }

    const source = settings as Partial<StickyNoteSettings>;
    const legacySource = settings as { tone?: LegacyNoteTone };

    let accentColor = DEFAULT_STICKY_NOTE_SETTINGS.accentColor;
    if (isHexColor(source.accentColor)) {
        accentColor = source.accentColor;
    } else if (legacySource.tone && LEGACY_TONE_COLOR_MAP[legacySource.tone]) {
        accentColor = LEGACY_TONE_COLOR_MAP[legacySource.tone];
    }

    return {
        title: typeof source.title === 'string' ? source.title : DEFAULT_STICKY_NOTE_SETTINGS.title,
        content: typeof source.content === 'string' ? source.content : DEFAULT_STICKY_NOTE_SETTINGS.content,
        accentColor,
        showTitle: typeof source.showTitle === 'boolean' ? source.showTitle : DEFAULT_STICKY_NOTE_SETTINGS.showTitle,
        showCharCount: typeof source.showCharCount === 'boolean'
            ? source.showCharCount
            : DEFAULT_STICKY_NOTE_SETTINGS.showCharCount,
    };
};

const StickyNoteSettingsComponent: React.FC<WidgetSettingsProps> = ({ settings, onSettingsChange }) => {
    const ids = useId();
    const noteSettings = normalizeStickyNoteSettings(settings);

    const updateSettings = useCallback((patch: Partial<StickyNoteSettings>) => {
        onSettingsChange({
            ...noteSettings,
            ...patch,
        });
    }, [noteSettings, onSettingsChange]);

    return (
        <div className="grid gap-4">
            <div className="grid gap-2">
                <Label htmlFor={`${ids}-title`}>Title</Label>
                <Input
                    id={`${ids}-title`}
                    value={noteSettings.title}
                    placeholder="Edit note title"
                    onChange={(event) => updateSettings({ title: event.target.value })}
                />
            </div>

            <ColorPicker
                id={`${ids}-accent-color`}
                label="Color"
                value={noteSettings.accentColor}
                onChange={(accentColor) => updateSettings({ accentColor })}
                defaultColor={DEFAULT_STICKY_NOTE_SETTINGS.accentColor}
                presetColors={STICKY_NOTE_COLOR_PRESETS}
                triggerAriaLabel="Choose sticky note color"
            />

            <div className="flex items-center justify-between rounded-md border p-3">
                <Label htmlFor={`${ids}-show-title`} className="cursor-pointer">
                    Show Title Input
                </Label>
                <Switch
                    id={`${ids}-show-title`}
                    checked={noteSettings.showTitle}
                    onCheckedChange={(checked) => updateSettings({ showTitle: checked })}
                />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
                <Label htmlFor={`${ids}-show-char-count`} className="cursor-pointer">
                    Show Character Count
                </Label>
                <Switch
                    id={`${ids}-show-char-count`}
                    checked={noteSettings.showCharCount}
                    onCheckedChange={(checked) => updateSettings({ showCharCount: checked })}
                />
            </div>
        </div>
    );
};

const StickyNoteWidgetComponent: React.FC<WidgetProps> = ({ settings, updateSettings }) => {
    const noteSettings = normalizeStickyNoteSettings(settings);

    const updateNote = useCallback((patch: Partial<StickyNoteSettings>) => {
        updateSettings({
            ...noteSettings,
            ...patch,
        });
    }, [noteSettings, updateSettings]);

    return (
        <div className="relative h-full overflow-hidden rounded-md bg-card/40 transition-colors dark:bg-card/20">
            <div className="flex h-full flex-col pt-5 pb-3">
                <div className="mb-2 flex items-center gap-1 px-3">
                    <span
                        data-note-accent
                        className="h-5 w-1 shrink-0 rounded-full transition-colors"
                        style={{ backgroundColor: noteSettings.accentColor }}
                    />
                    {noteSettings.showTitle && (
                        <Input
                            value={noteSettings.title}
                            onChange={(event) => updateNote({ title: event.target.value })}
                            placeholder="Title"
                            className="h-8 flex-1 border-transparent bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:border-border/80 focus-visible:ring-0"
                        />
                    )}
                </div>

                <Textarea
                    value={noteSettings.content}
                    onChange={(event) => updateNote({ content: event.target.value })}
                    placeholder="Write your note here..."
                    className="min-h-0 flex-1 resize-none overflow-x-hidden overflow-y-auto border-transparent bg-transparent px-4 py-0 text-sm leading-6 shadow-none focus-visible:border-border/80 focus-visible:ring-0 [field-sizing:fixed] [overflow-wrap:anywhere]"
                />

                {noteSettings.showCharCount && (
                    <div className="mt-2 px-3 text-right text-xs text-muted-foreground/80">
                        {noteSettings.content.length} chars
                    </div>
                )}
            </div>
        </div>
    );
};

export const StickyNoteWidget = StickyNoteWidgetComponent;

export const StickyNoteWidgetDefinition: WidgetDefinition = {
    type: 'sticky-note',
    name: 'Sticky Note',
    description: 'Quickly capture short notes directly on your dashboard.',
    icon: <StickyNote className="h-4 w-4" />,
    component: StickyNoteWidget,
    SettingsComponent: StickyNoteSettingsComponent,
    defaultSettings: DEFAULT_STICKY_NOTE_SETTINGS,
    layout: { w: 4, h: 3, minW: 3, minH: 2, maxW: 8, maxH: 8 },
    maxInstances: 'unlimited',
    allowedContexts: ['semester', 'course'],
    headerButtons: [
        {
            id: 'clear',
            render: ({ settings: rawSettings, updateSettings: updateWidgetSettings }, { ConfirmActionButton }) => (
                <ConfirmActionButton
                    title="Clear note"
                    icon={<Eraser className="h-4 w-4" />}
                    dialogTitle="Clear this note?"
                    dialogDescription="This will remove the note title and content."
                    confirmText="Clear"
                    confirmVariant="destructive"
                    onClick={() => {
                        const currentSettings = normalizeStickyNoteSettings(rawSettings);
                        void updateWidgetSettings({
                            ...currentSettings,
                            title: '',
                            content: '',
                        });
                    }}
                />
            ),
        },
    ],
};
