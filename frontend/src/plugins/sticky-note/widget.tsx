"use no memo";

import React, { useCallback, useId } from 'react';
import type { WidgetDefinition, WidgetProps, WidgetSettingsProps } from '../../services/widgetRegistry';
import { ColorPicker, type ColorPickerPreset } from '@/components/ui/color-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Eraser, Lock, LockOpen } from 'lucide-react';

type LegacyNoteTone = 'yellow' | 'mint' | 'sky' | 'rose';

interface StickyNoteSettings {
    title: string;
    content: string;
    accentColor: string;
    showTitle: boolean;
    showCharCount: boolean;
    isEditingLocked: boolean;
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
    isEditingLocked: false,
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
        isEditingLocked: typeof source.isEditingLocked === 'boolean'
            ? source.isEditingLocked
            : DEFAULT_STICKY_NOTE_SETTINGS.isEditingLocked,
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
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-md transition-colors">
            <div className="flex min-h-0 flex-1 flex-col pt-5 pb-3">
                <div className="relative mb-2 min-h-8 shrink-0 px-3">
                    <span
                        data-note-accent
                        className="absolute top-1/2 left-3 h-5 w-1 -translate-y-1/2 rounded-full transition-colors"
                        style={{ backgroundColor: noteSettings.accentColor }}
                    />
                    {noteSettings.showTitle && (
                        <Input
                            value={noteSettings.title}
                            onChange={(event) => updateNote({ title: event.target.value })}
                            placeholder="Title"
                            readOnly={noteSettings.isEditingLocked}
                            className="h-8 w-full select-text border-transparent !bg-transparent pl-3 text-sm font-semibold shadow-none dark:!bg-transparent focus-visible:border-border/80 focus-visible:bg-muted/40 dark:focus-visible:bg-input/30 focus-visible:ring-0"
                        />
                    )}
                </div>

                <div className="flex min-h-0 flex-1 px-3">
                    <Textarea
                        value={noteSettings.content}
                        onChange={(event) => updateNote({ content: event.target.value })}
                        placeholder="Write your note here..."
                        readOnly={noteSettings.isEditingLocked}
                        className="no-scrollbar h-full min-h-0 w-full select-text resize-none overflow-x-hidden overflow-y-auto border-transparent !bg-transparent px-3 py-0 text-sm leading-6 shadow-none dark:!bg-transparent focus-visible:border-border/80 focus-visible:bg-muted/40 dark:focus-visible:bg-input/30 focus-visible:ring-0 [field-sizing:fixed] [overflow-wrap:anywhere] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    />
                </div>

                {noteSettings.showCharCount && (
                    <div className="mt-2 shrink-0 px-3 text-right text-xs text-muted-foreground/80">
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
    component: StickyNoteWidget,
    SettingsComponent: StickyNoteSettingsComponent,
    defaultSettings: DEFAULT_STICKY_NOTE_SETTINGS,
    headerButtons: [
        {
            id: 'toggle-edit-lock',
            render: ({ settings: rawSettings, updateSettings: updateWidgetSettings }, { ActionButton }) => {
                const currentSettings = normalizeStickyNoteSettings(rawSettings);
                const isEditingLocked = currentSettings.isEditingLocked;

                return (
                    <ActionButton
                        title={isEditingLocked ? 'Unlock editing' : 'Lock editing'}
                        icon={isEditingLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                        onClick={() => {
                            void updateWidgetSettings({
                                ...currentSettings,
                                isEditingLocked: !isEditingLocked,
                            });
                        }}
                    />
                );
            },
        },
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
