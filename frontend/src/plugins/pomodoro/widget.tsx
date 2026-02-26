// input:  [widget registry contracts, shadcn/ui primitives, lucide icons, browser timer APIs]
// output: [`PomodoroWidget`, `PomodoroWidgetDefinition`, and pure timer helper exports]
// pos:    [Pomodoro widget runtime + compact per-instance settings form for dashboard plugin]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { WidgetDefinition, WidgetProps, WidgetSettingsProps } from '../../services/widgetRegistry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';

export type PomodoroMode = 'focus' | 'shortBreak' | 'longBreak';
export type PomodoroStatus = 'idle' | 'running' | 'paused';

export interface PomodoroSettings {
    mode: PomodoroMode;
    status: PomodoroStatus;
    focusMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
    longBreakInterval: number;
    completedFocusCount: number;
    remainingSeconds: number;
    sessionEndAt: number | null;
    autoStartBreak: boolean;
    autoStartFocus: boolean;
    soundEnabled: boolean;
    volume: number;
}

const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 180;
const MIN_LONG_BREAK_INTERVAL = 2;
const MAX_LONG_BREAK_INTERVAL = 12;
const TICK_INTERVAL_MS = 250;

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
    mode: 'focus',
    status: 'idle',
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakInterval: 4,
    completedFocusCount: 0,
    remainingSeconds: 25 * 60,
    sessionEndAt: null,
    autoStartBreak: true,
    autoStartFocus: false,
    soundEnabled: true,
    volume: 0.6,
};

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
    const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const rounded = Math.round(parsed);
    return Math.min(max, Math.max(min, rounded));
};

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
    const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
};

const isPomodoroMode = (value: unknown): value is PomodoroMode => {
    return value === 'focus' || value === 'shortBreak' || value === 'longBreak';
};

const isPomodoroStatus = (value: unknown): value is PomodoroStatus => {
    return value === 'idle' || value === 'running' || value === 'paused';
};

export const getDurationSecondsForMode = (mode: PomodoroMode, settings: Pick<PomodoroSettings, 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes'>): number => {
    if (mode === 'focus') return settings.focusMinutes * 60;
    if (mode === 'shortBreak') return settings.shortBreakMinutes * 60;
    return settings.longBreakMinutes * 60;
};

const getModeLabel = (mode: PomodoroMode): string => {
    if (mode === 'focus') return 'Focus';
    if (mode === 'shortBreak') return 'Short Break';
    return 'Long Break';
};

const formatSeconds = (totalSeconds: number): string => {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const isFiniteTimestamp = (value: unknown): value is number => {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
};

export const normalizePomodoroSettings = (settings: unknown): PomodoroSettings => {
    if (!settings || typeof settings !== 'object') {
        return DEFAULT_POMODORO_SETTINGS;
    }

    const source = settings as Partial<PomodoroSettings>;
    const mode = isPomodoroMode(source.mode) ? source.mode : DEFAULT_POMODORO_SETTINGS.mode;

    const normalized: PomodoroSettings = {
        mode,
        status: isPomodoroStatus(source.status) ? source.status : DEFAULT_POMODORO_SETTINGS.status,
        focusMinutes: clampInt(
            source.focusMinutes,
            MIN_DURATION_MINUTES,
            MAX_DURATION_MINUTES,
            DEFAULT_POMODORO_SETTINGS.focusMinutes
        ),
        shortBreakMinutes: clampInt(
            source.shortBreakMinutes,
            MIN_DURATION_MINUTES,
            MAX_DURATION_MINUTES,
            DEFAULT_POMODORO_SETTINGS.shortBreakMinutes
        ),
        longBreakMinutes: clampInt(
            source.longBreakMinutes,
            MIN_DURATION_MINUTES,
            MAX_DURATION_MINUTES,
            DEFAULT_POMODORO_SETTINGS.longBreakMinutes
        ),
        longBreakInterval: clampInt(
            source.longBreakInterval,
            MIN_LONG_BREAK_INTERVAL,
            MAX_LONG_BREAK_INTERVAL,
            DEFAULT_POMODORO_SETTINGS.longBreakInterval
        ),
        completedFocusCount: clampInt(
            source.completedFocusCount,
            0,
            Number.MAX_SAFE_INTEGER,
            DEFAULT_POMODORO_SETTINGS.completedFocusCount
        ),
        remainingSeconds: clampInt(
            source.remainingSeconds,
            0,
            MAX_DURATION_MINUTES * 60,
            DEFAULT_POMODORO_SETTINGS.remainingSeconds
        ),
        sessionEndAt: isFiniteTimestamp(source.sessionEndAt) ? source.sessionEndAt : null,
        autoStartBreak: typeof source.autoStartBreak === 'boolean' ? source.autoStartBreak : DEFAULT_POMODORO_SETTINGS.autoStartBreak,
        autoStartFocus: typeof source.autoStartFocus === 'boolean' ? source.autoStartFocus : DEFAULT_POMODORO_SETTINGS.autoStartFocus,
        soundEnabled: typeof source.soundEnabled === 'boolean' ? source.soundEnabled : DEFAULT_POMODORO_SETTINGS.soundEnabled,
        volume: clampNumber(source.volume, 0, 1, DEFAULT_POMODORO_SETTINGS.volume),
    };

    const durationForMode = getDurationSecondsForMode(normalized.mode, normalized);
    if (normalized.remainingSeconds <= 0 && normalized.status !== 'running') {
        normalized.remainingSeconds = durationForMode;
    }

    if (normalized.status !== 'running') {
        normalized.sessionEndAt = null;
    }

    return normalized;
};

const buildModeState = (
    base: PomodoroSettings,
    mode: PomodoroMode,
    status: PomodoroStatus,
    completedFocusCount: number,
    nowMs: number
): PomodoroSettings => {
    const duration = getDurationSecondsForMode(mode, base);
    return {
        ...base,
        mode,
        status,
        completedFocusCount,
        remainingSeconds: duration,
        sessionEndAt: status === 'running' ? nowMs + duration * 1000 : null,
    };
};

const buildResetState = (base: PomodoroSettings): PomodoroSettings => {
    const duration = getDurationSecondsForMode('focus', base);
    return {
        ...base,
        mode: 'focus',
        status: 'idle',
        completedFocusCount: 0,
        remainingSeconds: duration,
        sessionEndAt: null,
    };
};

export const getCompletionTransition = (current: PomodoroSettings, nowMs: number): PomodoroSettings => {
    if (current.mode === 'focus') {
        const completedFocusCount = current.completedFocusCount + 1;
        const isLongBreak = completedFocusCount % current.longBreakInterval === 0;
        const nextMode: PomodoroMode = isLongBreak ? 'longBreak' : 'shortBreak';
        const nextStatus: PomodoroStatus = current.autoStartBreak ? 'running' : 'idle';
        return buildModeState(current, nextMode, nextStatus, completedFocusCount, nowMs);
    }

    const nextStatus: PomodoroStatus = current.autoStartFocus ? 'running' : 'idle';
    return buildModeState(current, 'focus', nextStatus, current.completedFocusCount, nowMs);
};

const playNotificationTone = (volume: number) => {
    if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
        return;
    }

    try {
        const audioContext = new window.AudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
        gainNode.gain.setValueAtTime(Math.max(0.01, volume * 0.1), audioContext.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.18);
        oscillator.onended = () => {
            void audioContext.close();
        };
    } catch {
        // Ignore audio errors so timer state transitions are never blocked.
    }
};

const PomodoroSettingsComponent: React.FC<WidgetSettingsProps> = ({ settings, onSettingsChange }) => {
    const fieldId = useId();
    const pomodoroSettings = normalizePomodoroSettings(settings);

    const updatePatch = useCallback((patch: Partial<PomodoroSettings>) => {
        onSettingsChange({
            ...pomodoroSettings,
            ...patch,
        });
    }, [onSettingsChange, pomodoroSettings]);

    const updateDuration = useCallback((key: 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes', value: string) => {
        updatePatch({
            [key]: clampInt(value, MIN_DURATION_MINUTES, MAX_DURATION_MINUTES, pomodoroSettings[key]),
        } as Pick<PomodoroSettings, typeof key>);
    }, [pomodoroSettings, updatePatch]);

    return (
        <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                    <Label htmlFor={`${fieldId}-focus`}>Focus minutes</Label>
                    <Input
                        id={`${fieldId}-focus`}
                        type="number"
                        min={MIN_DURATION_MINUTES}
                        max={MAX_DURATION_MINUTES}
                        value={pomodoroSettings.focusMinutes}
                        onChange={(event) => updateDuration('focusMinutes', event.target.value)}
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`${fieldId}-short-break`}>Short break minutes</Label>
                    <Input
                        id={`${fieldId}-short-break`}
                        type="number"
                        min={MIN_DURATION_MINUTES}
                        max={MAX_DURATION_MINUTES}
                        value={pomodoroSettings.shortBreakMinutes}
                        onChange={(event) => updateDuration('shortBreakMinutes', event.target.value)}
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`${fieldId}-long-break`}>Long break minutes</Label>
                    <Input
                        id={`${fieldId}-long-break`}
                        type="number"
                        min={MIN_DURATION_MINUTES}
                        max={MAX_DURATION_MINUTES}
                        value={pomodoroSettings.longBreakMinutes}
                        onChange={(event) => updateDuration('longBreakMinutes', event.target.value)}
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`${fieldId}-interval`}>Long break interval</Label>
                    <Input
                        id={`${fieldId}-interval`}
                        type="number"
                        min={MIN_LONG_BREAK_INTERVAL}
                        max={MAX_LONG_BREAK_INTERVAL}
                        value={pomodoroSettings.longBreakInterval}
                        onChange={(event) => {
                            updatePatch({
                                longBreakInterval: clampInt(
                                    event.target.value,
                                    MIN_LONG_BREAK_INTERVAL,
                                    MAX_LONG_BREAK_INTERVAL,
                                    pomodoroSettings.longBreakInterval
                                ),
                            });
                        }}
                    />
                </div>
            </div>

            <div className="grid gap-2">
                <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                    <Label htmlFor={`${fieldId}-auto-break`} className="cursor-pointer">Auto start break</Label>
                    <Switch
                        id={`${fieldId}-auto-break`}
                        checked={pomodoroSettings.autoStartBreak}
                        onCheckedChange={(checked) => updatePatch({ autoStartBreak: checked })}
                    />
                </div>

                <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                    <Label htmlFor={`${fieldId}-auto-focus`} className="cursor-pointer">Auto start focus</Label>
                    <Switch
                        id={`${fieldId}-auto-focus`}
                        checked={pomodoroSettings.autoStartFocus}
                        onCheckedChange={(checked) => updatePatch({ autoStartFocus: checked })}
                    />
                </div>

                <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                    <Label htmlFor={`${fieldId}-sound`} className="cursor-pointer">Sound enabled</Label>
                    <Switch
                        id={`${fieldId}-sound`}
                        checked={pomodoroSettings.soundEnabled}
                        onCheckedChange={(checked) => updatePatch({ soundEnabled: checked })}
                    />
                </div>
            </div>

            <div className="grid gap-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor={`${fieldId}-volume`}>Notification volume</Label>
                    <span className="text-xs text-muted-foreground">{Math.round(pomodoroSettings.volume * 100)}%</span>
                </div>
                <Slider
                    id={`${fieldId}-volume`}
                    min={0}
                    max={100}
                    step={5}
                    disabled={!pomodoroSettings.soundEnabled}
                    value={[Math.round(pomodoroSettings.volume * 100)]}
                    onValueChange={(value) => {
                        const nextVolume = Array.isArray(value) && value.length > 0 ? value[0] / 100 : pomodoroSettings.volume;
                        updatePatch({ volume: clampNumber(nextVolume, 0, 1, pomodoroSettings.volume) });
                    }}
                />
            </div>
        </div>
    );
};

const PomodoroWidgetComponent: React.FC<WidgetProps> = ({ settings, updateSettings }) => {
    const normalizedSettings = useMemo(() => normalizePomodoroSettings(settings), [settings]);
    const [nowMs, setNowMs] = useState(() => Date.now());
    const completionGuardRef = useRef<string>('');

    const persistSettings = useCallback((nextSettings: PomodoroSettings) => {
        void Promise.resolve(updateSettings(nextSettings));
    }, [updateSettings]);

    const remainingSeconds = useMemo(() => {
        if (normalizedSettings.status !== 'running' || !normalizedSettings.sessionEndAt) {
            return normalizedSettings.remainingSeconds;
        }
        return Math.max(0, Math.ceil((normalizedSettings.sessionEndAt - nowMs) / 1000));
    }, [normalizedSettings.remainingSeconds, normalizedSettings.sessionEndAt, normalizedSettings.status, nowMs]);

    const currentDurationSeconds = useMemo(() => {
        return getDurationSecondsForMode(normalizedSettings.mode, normalizedSettings);
    }, [normalizedSettings]);

    const progressValue = useMemo(() => {
        if (currentDurationSeconds <= 0) return 0;
        const elapsed = currentDurationSeconds - remainingSeconds;
        return Math.min(100, Math.max(0, (elapsed / currentDurationSeconds) * 100));
    }, [currentDurationSeconds, remainingSeconds]);

    useEffect(() => {
        if (normalizedSettings.status !== 'running') return;

        setNowMs(Date.now());
        const timerId = window.setInterval(() => {
            setNowMs(Date.now());
        }, TICK_INTERVAL_MS);

        return () => {
            window.clearInterval(timerId);
        };
    }, [normalizedSettings.status]);

    useEffect(() => {
        if (normalizedSettings.status !== 'running') {
            completionGuardRef.current = '';
            return;
        }
        if (remainingSeconds > 0) {
            completionGuardRef.current = '';
            return;
        }

        const signature = [
            normalizedSettings.mode,
            normalizedSettings.completedFocusCount,
            normalizedSettings.sessionEndAt ?? 0,
        ].join(':');

        if (completionGuardRef.current === signature) {
            return;
        }
        completionGuardRef.current = signature;

        if (normalizedSettings.soundEnabled) {
            playNotificationTone(normalizedSettings.volume);
        }

        const transitionedSettings = getCompletionTransition(normalizedSettings, Date.now());
        persistSettings(transitionedSettings);
    }, [normalizedSettings, persistSettings, remainingSeconds]);

    const startOrResume = useCallback(() => {
        if (normalizedSettings.status === 'running') return;

        const secondsToRun = normalizedSettings.status === 'idle'
            ? getDurationSecondsForMode(normalizedSettings.mode, normalizedSettings)
            : Math.max(1, remainingSeconds);

        persistSettings({
            ...normalizedSettings,
            status: 'running',
            remainingSeconds: secondsToRun,
            sessionEndAt: Date.now() + secondsToRun * 1000,
        });
    }, [normalizedSettings, persistSettings, remainingSeconds]);

    const pauseSession = useCallback(() => {
        if (normalizedSettings.status !== 'running') return;
        persistSettings({
            ...normalizedSettings,
            status: 'paused',
            remainingSeconds,
            sessionEndAt: null,
        });
    }, [normalizedSettings, persistSettings, remainingSeconds]);

    const resetSession = useCallback(() => {
        persistSettings(buildResetState(normalizedSettings));
    }, [normalizedSettings, persistSettings]);

    const skipSession = useCallback(() => {
        const nextMode: PomodoroMode = normalizedSettings.mode === 'focus' ? 'shortBreak' : 'focus';
        const shouldAutoStart = nextMode === 'focus' ? normalizedSettings.autoStartFocus : normalizedSettings.autoStartBreak;
        const nextStatus: PomodoroStatus = shouldAutoStart ? 'running' : 'idle';

        persistSettings(
            buildModeState(
                normalizedSettings,
                nextMode,
                nextStatus,
                normalizedSettings.completedFocusCount,
                Date.now()
            )
        );
    }, [normalizedSettings, persistSettings]);

    const primaryAction = normalizedSettings.status === 'running'
        ? {
            label: 'Pause',
            icon: <Pause className="h-4 w-4" aria-hidden="true" />,
            onClick: pauseSession,
            ariaLabel: 'Pause timer',
        }
        : {
            label: normalizedSettings.status === 'paused' ? 'Resume' : 'Start',
            icon: <Play className="h-4 w-4" aria-hidden="true" />,
            onClick: startOrResume,
            ariaLabel: normalizedSettings.status === 'paused' ? 'Resume timer' : 'Start timer',
        };

    return (
        <div className="flex h-full min-h-0 flex-col p-3">
            <div className="flex items-center justify-end gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                    Completed Focus Sessions: {normalizedSettings.completedFocusCount}
                </span>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-2">
                <p className="inline-flex items-center rounded-full border border-border/60 bg-muted/60 px-2.5 py-1 text-xs font-semibold text-foreground">
                    {getModeLabel(normalizedSettings.mode)}
                </p>
                <div className="text-center text-[clamp(2rem,12cqw,3rem)] font-semibold tabular-nums leading-none tracking-tight text-foreground">
                    {formatSeconds(remainingSeconds)}
                </div>
                <Progress value={progressValue} className="h-2 w-full" />
            </div>

            <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                    <Button
                        type="button"
                        onClick={primaryAction.onClick}
                        size="sm"
                        aria-label={primaryAction.ariaLabel}
                    >
                        {primaryAction.icon}
                        <span>{primaryAction.label}</span>
                    </Button>
                    <Button
                        type="button"
                        onClick={resetSession}
                        size="sm"
                        variant="secondary"
                        aria-label="Reset timer"
                    >
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        <span>Reset</span>
                    </Button>
                </div>
                <Button
                    type="button"
                    onClick={skipSession}
                    size="sm"
                    variant="outline"
                    aria-label="Skip to next mode"
                >
                    <SkipForward className="h-4 w-4" aria-hidden="true" />
                    <span>Skip</span>
                </Button>
            </div>
        </div>
    );
};

export const PomodoroWidget = PomodoroWidgetComponent;

export const PomodoroWidgetDefinition: WidgetDefinition = {
    type: 'pomodoro',
    component: PomodoroWidget,
    defaultSettings: DEFAULT_POMODORO_SETTINGS,
    SettingsComponent: PomodoroSettingsComponent,
    headerButtons: [
        {
            id: 'reset-session',
            render: ({ settings: currentSettings, updateSettings: updateHeaderSettings }, { ActionButton }) => (
                <ActionButton
                    title="Reset timer"
                    icon={<RotateCcw className="h-4 w-4" />}
                    onClick={() => {
                        const normalized = normalizePomodoroSettings(currentSettings);
                        void Promise.resolve(updateHeaderSettings(buildResetState(normalized)));
                    }}
                />
            ),
        },
    ],
};
