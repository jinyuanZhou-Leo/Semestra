// input:  [widget settings/update callbacks, sibling widget sync API calls, split Duolingo/ring display components, shared date/history helpers, and shadcn form controls/dialog actions]
// output: [habit-streak instance-state helpers, Duolingo widget component/definition, Ring widget component/definition, and mode-specific settings components]
// pos:    [plugin runtime + settings layer for dual habit-streak widgets with per-instance streak state, compact untitled fallback text, and mode-specific feedback wiring]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React, { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type {
    HeaderButtonContext,
    HeaderConfirmActionButtonProps,
    WidgetDefinition,
    WidgetProps,
    WidgetSettingsProps,
} from '@/plugin-system';
import { Button } from '@/components/ui/button';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { Field, FieldContent, FieldGroup, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import './habit-streak.css';
import { CalendarDays, RotateCcw, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { jsonDeepEqual } from '../../plugin-system/utils';
import { HabitStreakCalendar, type RecentDayCell } from './HabitStreakCalendar';
import { HabitStreakRing } from './HabitStreakRing';

const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * HOUR_IN_MS;
const INTERVAL_OPTIONS = [
    { value: 0, label: 'No interval' },
    { value: 24, label: 'Every day' },
    { value: 168, label: 'Every week' },
] as const;
const ALLOWED_INTERVAL_HOURS = INTERVAL_OPTIONS.map((option) => option.value);
const MIN_TARGET_STREAK = 1;
const HISTORY_RETENTION_DAYS = 90;
const LOCAL_DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DUOLINGO_WIDGET_TYPE = 'habit-streak-duolingo';
const RING_WIDGET_TYPE = 'habit-streak-ring';

type HabitStreakVariant = 'duolingo' | 'ring';

interface HabitStreakSharedSettings {
    habitName: string;
    checkInIntervalHours: number;
    targetStreak: number;
    streakCount: number;
    bestStreak: number;
    totalCheckIns: number;
    lastCheckInAt: string | null;
    checkInHistory: string[];
}

type HabitStreakDuolingoSettings = HabitStreakSharedSettings;

interface HabitStreakRingSettings extends HabitStreakSharedSettings {
    showMotivationalMessage: boolean;
}

type HabitStreakSettings = HabitStreakDuolingoSettings | HabitStreakRingSettings;

interface CheckInWindowState {
    canCheckIn: boolean;
    remainingMs: number;
    windowsSinceLast: number;
}

const DEFAULT_SHARED_SETTINGS: HabitStreakSharedSettings = {
    habitName: '',
    checkInIntervalHours: 24,
    targetStreak: 21,
    streakCount: 0,
    bestStreak: 0,
    totalCheckIns: 0,
    lastCheckInAt: null,
    checkInHistory: [],
};

const DEFAULT_HABIT_STREAK_DUOLINGO_SETTINGS: HabitStreakDuolingoSettings = {
    ...DEFAULT_SHARED_SETTINGS,
};

const DEFAULT_HABIT_STREAK_RING_SETTINGS: HabitStreakRingSettings = {
    ...DEFAULT_SHARED_SETTINGS,
    showMotivationalMessage: true,
};

interface HabitInstanceEntry {
    listeners: Set<() => void>;
    settings: HabitStreakSharedSettings;
}

const habitInstanceStore = new Map<string, HabitInstanceEntry>();

const getHabitInstanceEntry = (
    widgetId: string,
    fallbackSettings: HabitStreakSharedSettings
): HabitInstanceEntry => {
    const existing = habitInstanceStore.get(widgetId);
    if (existing) return existing;

    const created: HabitInstanceEntry = {
        listeners: new Set(),
        settings: fallbackSettings,
    };
    habitInstanceStore.set(widgetId, created);
    return created;
};

const emitHabitInstance = (widgetId: string) => {
    const entry = habitInstanceStore.get(widgetId);
    if (!entry) return;
    entry.listeners.forEach((listener) => listener());
};

const readHabitInstanceSettings = (
    widgetId: string,
    fallbackSettings: HabitStreakSharedSettings
) => getHabitInstanceEntry(widgetId, fallbackSettings).settings;

const writeHabitInstanceSettings = (
    widgetId: string,
    nextSettings: HabitStreakSharedSettings
) => {
    const entry = getHabitInstanceEntry(widgetId, nextSettings);
    if (jsonDeepEqual(entry.settings, nextSettings)) return;
    entry.settings = nextSettings;
    emitHabitInstance(widgetId);
};

const deleteHabitInstanceRecord = (widgetId: string) => {
    habitInstanceStore.delete(widgetId);
};

const subscribeHabitInstanceSettings = (widgetId: string, listener: () => void) => {
    const entry = getHabitInstanceEntry(widgetId, DEFAULT_SHARED_SETTINGS);
    entry.listeners.add(listener);

    return () => {
        const latestEntry = habitInstanceStore.get(widgetId);
        if (!latestEntry) return;
        latestEntry.listeners.delete(listener);
        if (latestEntry.listeners.size === 0) {
            habitInstanceStore.delete(widgetId);
        }
    };
};

export const resetHabitStreakSharedStoreForTests = () => {
    habitInstanceStore.clear();
};

type MessageTemplate = (n: number) => string;

const MOTIVATIONAL_MESSAGES: { streakMin: number; templates: MessageTemplate[] }[] = [
    {
        streakMin: 0,
        templates: [
            (n) => `Streak #${n}. Every streak starts here.`,
            (n) => `Check-in ${n} done. You showed up.`,
            (n) => `Streak #${n}. The hardest part is beginning.`,
            (n) => `Check-in ${n}. Nice start.`,
            (n) => `Streak #${n}. Keep going.`,
        ],
    },
    {
        streakMin: 3,
        templates: [
            (n) => `${n} check-ins in a row. Momentum is building.`,
            (n) => `Streak #${n}. Consistency adds up.`,
            (n) => `${n} in a row. Keep the chain going.`,
            (n) => `${n} locked in. Keep showing up.`,
            (n) => `Streak #${n}. You're on track.`,
        ],
    },
    {
        streakMin: 7,
        templates: [
            (n) => `${n} check-ins. You're showing up for yourself.`,
            (n) => `Streak #${n}. Habits are starting to form.`,
            (n) => `Streak #${n}. Keep this rhythm alive.`,
            (n) => `${n} strong. Keep the pace.`,
            (n) => `Streak #${n}. Solid rhythm.`,
        ],
    },
    {
        streakMin: 14,
        templates: [
            (n) => `${n} check-ins. That's dedication.`,
            (n) => `Streak #${n}. This is becoming part of you.`,
            (n) => `${n} in a row. You're building something real.`,
            (n) => `Streak #${n}. Discipline is visible.`,
            (n) => `${n} straight. You're leveling up.`,
        ],
    },
    {
        streakMin: 21,
        templates: [
            (n) => `${n} check-ins. This is real consistency.`,
            (n) => `Streak #${n}. Pure follow-through.`,
            (n) => `Streak #${n}. It's a habit now.`,
            (n) => `Streak #${n}. This is your standard.`,
            (n) => `${n} in a row. Keep it automatic.`,
        ],
    },
    {
        streakMin: 30,
        templates: [
            (n) => `${n} check-ins. You're committed.`,
            (n) => `Streak #${n}. Strong execution.`,
            (n) => `Streak #${n}. That's real commitment.`,
            (n) => `Streak #${n}. Locked and focused.`,
            (n) => `${n} check-ins. No excuses.`,
        ],
    },
    {
        streakMin: 60,
        templates: [
            (n) => `${n} check-ins. Incredible consistency.`,
            (n) => `Streak #${n}. This is who you are now.`,
            (n) => `Streak #${n}. Remarkable.`,
            (n) => `Streak #${n}. Elite consistency.`,
            (n) => `${n} straight. You're relentless.`,
        ],
    },
    {
        streakMin: 100,
        templates: [
            (n) => `${n} check-ins. Triple digits.`,
            (n) => `Streak #${n}. Most people only dream of this.`,
            (n) => `Streak #${n}. Legendary.`,
            (n) => `Streak #${n}. Top-tier consistency.`,
            (n) => `${n} in a row. Iconic run.`,
        ],
    },
];

const getMotivationalMessage = (streakCount: number): string => {
    const tiers = [...MOTIVATIONAL_MESSAGES].reverse();
    const tier = tiers.find((candidate) => streakCount >= candidate.streakMin) ?? MOTIVATIONAL_MESSAGES[0];
    const pool = tier.templates;
    return pool[Math.floor(Math.random() * pool.length)](streakCount);
};

const clampIntervalHours = (value: unknown): number => {
    const numericValue = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
    if (!Number.isFinite(numericValue)) return DEFAULT_SHARED_SETTINGS.checkInIntervalHours;
    const rounded = Math.round(numericValue);
    if (ALLOWED_INTERVAL_HOURS.includes(rounded as typeof ALLOWED_INTERVAL_HOURS[number])) {
        return rounded;
    }
    return DEFAULT_SHARED_SETTINGS.checkInIntervalHours;
};

const clampTargetStreak = (value: unknown): number => {
    const numericValue = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
    if (!Number.isFinite(numericValue)) return DEFAULT_SHARED_SETTINGS.targetStreak;
    const rounded = Math.round(numericValue);
    return Math.max(MIN_TARGET_STREAK, rounded);
};

const getStartOfLocalDay = (timestampMs: number) => {
    const date = new Date(timestampMs);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

const getLocalDateParts = (dateKey: string) => {
    if (!LOCAL_DATE_KEY_REGEX.test(dateKey)) return null;
    const [yearRaw, monthRaw, dayRaw] = dateKey.split('-');
    const year = Number.parseInt(yearRaw, 10);
    const monthIndex = Number.parseInt(monthRaw, 10) - 1;
    const day = Number.parseInt(dayRaw, 10);
    if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) {
        return null;
    }

    const date = new Date(year, monthIndex, day);
    if (
        Number.isNaN(date.getTime()) ||
        date.getFullYear() !== year ||
        date.getMonth() !== monthIndex ||
        date.getDate() !== day
    ) {
        return null;
    }

    return { year, monthIndex, day, timestampMs: date.getTime() };
};

const getLocalDateKey = (timestampMs: number) => {
    const date = new Date(timestampMs);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const normalizeCheckInHistory = (history: unknown, nowMs: number): string[] => {
    if (!Array.isArray(history)) return [];

    const maxTimestampMs = getStartOfLocalDay(nowMs);
    const minTimestampMs = maxTimestampMs - (HISTORY_RETENTION_DAYS - 1) * DAY_IN_MS;
    const uniqueKeys = new Set<string>();
    const normalizedHistory: { key: string; timestampMs: number }[] = [];

    history.forEach((value) => {
        if (typeof value !== 'string') return;
        const parsed = getLocalDateParts(value);
        if (!parsed) return;
        if (parsed.timestampMs < minTimestampMs || parsed.timestampMs > maxTimestampMs) return;
        if (uniqueKeys.has(value)) return;
        uniqueKeys.add(value);
        normalizedHistory.push({ key: value, timestampMs: parsed.timestampMs });
    });

    normalizedHistory.sort((left, right) => left.timestampMs - right.timestampMs);
    return normalizedHistory.map((entry) => entry.key);
};

const normalizeSharedSettings = (settings: unknown, nowMs: number = Date.now()): HabitStreakSharedSettings => {
    if (!settings || typeof settings !== 'object') {
        return DEFAULT_SHARED_SETTINGS;
    }

    const source = settings as Partial<HabitStreakSharedSettings>;
    const parsedLastCheckInAt = typeof source.lastCheckInAt === 'string' ? Date.parse(source.lastCheckInAt) : NaN;

    return {
        habitName: typeof source.habitName === 'string' ? source.habitName : DEFAULT_SHARED_SETTINGS.habitName,
        checkInIntervalHours: clampIntervalHours(source.checkInIntervalHours),
        targetStreak: clampTargetStreak(source.targetStreak),
        streakCount: Number.isFinite(source.streakCount) ? Math.max(0, Math.round(source.streakCount as number)) : 0,
        bestStreak: Number.isFinite(source.bestStreak) ? Math.max(0, Math.round(source.bestStreak as number)) : 0,
        totalCheckIns: Number.isFinite(source.totalCheckIns) ? Math.max(0, Math.round(source.totalCheckIns as number)) : 0,
        lastCheckInAt: Number.isNaN(parsedLastCheckInAt) ? null : new Date(parsedLastCheckInAt).toISOString(),
        checkInHistory: normalizeCheckInHistory(source.checkInHistory, nowMs),
    };
};

export const normalizeHabitStreakDuolingoSettings = (settings: unknown, nowMs: number = Date.now()): HabitStreakDuolingoSettings => {
    return normalizeSharedSettings(settings, nowMs);
};

export const normalizeHabitStreakRingSettings = (settings: unknown, nowMs: number = Date.now()): HabitStreakRingSettings => {
    const sharedSettings = normalizeSharedSettings(settings, nowMs);
    const source = settings && typeof settings === 'object'
        ? settings as Partial<HabitStreakRingSettings>
        : null;

    return {
        ...sharedSettings,
        showMotivationalMessage: typeof source?.showMotivationalMessage === 'boolean'
            ? source.showMotivationalMessage
            : DEFAULT_HABIT_STREAK_RING_SETTINGS.showMotivationalMessage,
    };
};

const extractHabitSharedSettings = (settings: HabitStreakSettings): HabitStreakSharedSettings => {
    return {
        habitName: settings.habitName,
        checkInIntervalHours: settings.checkInIntervalHours,
        targetStreak: settings.targetStreak,
        streakCount: settings.streakCount,
        bestStreak: settings.bestStreak,
        totalCheckIns: settings.totalCheckIns,
        lastCheckInAt: settings.lastCheckInAt,
        checkInHistory: settings.checkInHistory,
    };
};

const applySharedSettings = <T extends HabitStreakSettings>(
    settings: T,
    sharedSettings: HabitStreakSharedSettings
): T => {
    return {
        ...settings,
        ...sharedSettings,
    };
};

export const getCheckInWindowState = (
    lastCheckInAt: string | null,
    intervalHours: number,
    nowMs: number
): CheckInWindowState => {
    const normalizedIntervalHours = clampIntervalHours(intervalHours);
    if (normalizedIntervalHours === 0) {
        if (!lastCheckInAt) {
            return { canCheckIn: true, remainingMs: 0, windowsSinceLast: 0 };
        }
        if (Number.isNaN(Date.parse(lastCheckInAt))) {
            return { canCheckIn: true, remainingMs: 0, windowsSinceLast: 0 };
        }
        // No interval = tally counter: every check-in advances the streak by 1.
        // There is no "missed window" concept when no interval is required.
        return { canCheckIn: true, remainingMs: 0, windowsSinceLast: 1 };
    }

    if (!lastCheckInAt) {
        return { canCheckIn: true, remainingMs: 0, windowsSinceLast: 0 };
    }

    const lastCheckInMs = Date.parse(lastCheckInAt);
    if (Number.isNaN(lastCheckInMs)) {
        return { canCheckIn: true, remainingMs: 0, windowsSinceLast: 0 };
    }

    if (normalizedIntervalHours === 24) {
        const startOfCurrentDay = getStartOfLocalDay(nowMs);
        const startOfLastCheckInDay = getStartOfLocalDay(lastCheckInMs);
        const dayDiff = Math.max(0, Math.round((startOfCurrentDay - startOfLastCheckInDay) / DAY_IN_MS));

        if (dayDiff === 0) {
            return {
                canCheckIn: false,
                remainingMs: Math.max(0, startOfCurrentDay + DAY_IN_MS - nowMs),
                windowsSinceLast: 0,
            };
        }

        return {
            canCheckIn: true,
            remainingMs: 0,
            windowsSinceLast: dayDiff,
        };
    }

    const intervalMs = normalizedIntervalHours * HOUR_IN_MS;
    const elapsedMs = nowMs - lastCheckInMs;
    if (elapsedMs < intervalMs) {
        return {
            canCheckIn: false,
            remainingMs: intervalMs - elapsedMs,
            windowsSinceLast: 0,
        };
    }

    return {
        canCheckIn: true,
        remainingMs: 0,
        windowsSinceLast: Math.max(1, Math.floor(elapsedMs / intervalMs)),
    };
};

export const computeNextStreakCount = (
    currentStreak: number,
    windowsSinceLast: number,
    hasPreviousCheckIn: boolean
) => {
    if (!hasPreviousCheckIn) return 1;
    if (windowsSinceLast <= 0) return Math.max(1, currentStreak);
    if (windowsSinceLast === 1) return Math.max(1, currentStreak + 1);
    return 1;
};

const formatRemainingTime = (remainingMs: number): string => {
    const clampedMs = Math.max(0, remainingMs);
    const totalSeconds = Math.floor(clampedMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    return `${hours}h ${minutes}m ${seconds}s`;
};

const buildRecentDayCells = (checkInHistory: string[], nowMs: number): RecentDayCell[] => {
    const completedDays = new Set(checkInHistory);
    return Array.from({ length: 7 }, (_, index) => {
        const offset = 6 - index;
        const date = new Date(getStartOfLocalDay(nowMs) - offset * DAY_IN_MS);
        const key = getLocalDateKey(date.getTime());
        return {
            key,
            dayLabel: date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1),
            dayNumber: String(date.getDate()),
            isToday: offset === 0,
            isCompleted: completedDays.has(key),
        };
    });
};

const getResetSharedSettings = (settings: HabitStreakSharedSettings): HabitStreakSharedSettings => ({
    ...settings,
    streakCount: 0,
    bestStreak: 0,
    totalCheckIns: 0,
    lastCheckInAt: null,
    checkInHistory: [],
});

interface HabitSharedSettingsFieldsProps<TSettings extends HabitStreakSettings> {
    settings: TSettings;
    onSettingsChange: (nextSettings: TSettings) => void;
    showCadence: boolean;
    extraFooter?: React.ReactNode;
}

const HabitSharedSettingsFields = <TSettings extends HabitStreakSettings>({
    settings,
    onSettingsChange,
    showCadence,
    extraFooter,
}: HabitSharedSettingsFieldsProps<TSettings>) => {
    const ids = useId();

    const updateSettings = useCallback((patch: Partial<TSettings>) => {
        onSettingsChange({
            ...settings,
            ...patch,
        });
    }, [onSettingsChange, settings]);

    return (
        <FieldGroup>
            <Field>
                <FieldLabel htmlFor={`${ids}-habit-name`}>Habit</FieldLabel>
                <Input
                    id={`${ids}-habit-name`}
                    value={settings.habitName}
                    placeholder="Review notes"
                    onChange={(event) => updateSettings({ habitName: event.target.value } as Partial<TSettings>)}
                />
            </Field>

            <FieldGroup className={cn('grid gap-3', showCadence && 'sm:grid-cols-2')}>
                {showCadence ? (
                    <Field>
                        <FieldLabel htmlFor={`${ids}-interval-hours`}>Check-in cadence</FieldLabel>
                        <Select
                            value={String(settings.checkInIntervalHours)}
                            onValueChange={(value) => updateSettings({ checkInIntervalHours: clampIntervalHours(value) } as Partial<TSettings>)}
                        >
                            <SelectTrigger id={`${ids}-interval-hours`} className="w-full">
                                <SelectValue placeholder="Select cadence" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {INTERVAL_OPTIONS.map((option) => (
                                        <SelectItem key={`habit-interval-${option.value}`} value={String(option.value)}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </Field>
                ) : null}

                <Field>
                    <FieldLabel htmlFor={`${ids}-target-streak`}>Target streak (count)</FieldLabel>
                    <Input
                        id={`${ids}-target-streak`}
                        type="number"
                        min={MIN_TARGET_STREAK}
                        value={settings.targetStreak}
                        onChange={(event) => updateSettings({ targetStreak: clampTargetStreak(event.target.value) } as Partial<TSettings>)}
                    />
                </Field>
            </FieldGroup>

            {extraFooter}
        </FieldGroup>
    );
};

const HabitStreakDuolingoSettingsComponent: React.FC<WidgetSettingsProps<HabitStreakDuolingoSettings>> = ({
    settings,
    onSettingsChange,
}) => {
    const duolingoSettings = normalizeHabitStreakDuolingoSettings(settings);

    return (
        <HabitSharedSettingsFields
            settings={duolingoSettings}
            onSettingsChange={onSettingsChange}
            showCadence={false}
        />
    );
};

const HabitStreakRingSettingsComponent: React.FC<WidgetSettingsProps<HabitStreakRingSettings>> = ({
    settings,
    onSettingsChange,
}) => {
    const ringSettings = normalizeHabitStreakRingSettings(settings);

    const handleToggleMotivationalMessage = useCallback((checked: boolean) => {
        onSettingsChange({
            ...ringSettings,
            showMotivationalMessage: checked,
        });
    }, [onSettingsChange, ringSettings]);

    return (
        <HabitSharedSettingsFields
            settings={ringSettings}
            onSettingsChange={onSettingsChange}
            showCadence
            extraFooter={(
                <Field orientation="horizontal">
                    <FieldContent>
                        <FieldLabel htmlFor="habit-ring-motivational-msg">
                            Encouragement on check-in
                        </FieldLabel>
                        <FieldDescription>
                            Show a motivational message each time you check in from the ring widget.
                        </FieldDescription>
                    </FieldContent>
                    <Switch
                        id="habit-ring-motivational-msg"
                        checked={ringSettings.showMotivationalMessage}
                        onCheckedChange={handleToggleMotivationalMessage}
                    />
                </Field>
            )}
        />
    );
};

const CountdownDisplay: React.FC<{ remainingMs: number; onExpire: () => void }> = ({
    remainingMs: initialRemainingMs,
    onExpire,
}) => {
    const [ms, setMs] = useState(initialRemainingMs);
    const onExpireRef = useRef(onExpire);

    useEffect(() => {
        onExpireRef.current = onExpire;
    }, [onExpire]);

    useEffect(() => {
        setMs(initialRemainingMs);
    }, [initialRemainingMs]);

    useEffect(() => {
        if (ms <= 0) {
            onExpireRef.current();
            return;
        }
        const timer = window.setTimeout(() => setMs((prev) => Math.max(0, prev - 1000)), 1000);
        return () => clearTimeout(timer);
    }, [ms]);

    return <>{formatRemainingTime(ms)}</>;
};

interface MotivationalToast {
    id: number;
    message: string;
}

const useHabitInstanceSettings = (
    widgetId: string,
    normalizedSettings: HabitStreakSettings
) => {
    const initialSharedSettings = useMemo(
        () => extractHabitSharedSettings(normalizedSettings),
        [normalizedSettings]
    );
    const subscribe = useCallback(
        (listener: () => void) => subscribeHabitInstanceSettings(widgetId, listener),
        [widgetId]
    );
    const getSnapshot = useCallback(
        () => readHabitInstanceSettings(widgetId, initialSharedSettings),
        [widgetId, initialSharedSettings]
    );
    const instanceSettings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    useEffect(() => {
        writeHabitInstanceSettings(widgetId, initialSharedSettings);
    }, [initialSharedSettings, widgetId]);

    return instanceSettings;
};

interface HabitStreakWidgetComponentProps<TSettings extends HabitStreakSettings> extends WidgetProps<TSettings> {
    normalizeSettings: (settings: unknown, nowMs: number) => TSettings;
    variant: HabitStreakVariant;
}

const HabitStreakWidgetComponent = <TSettings extends HabitStreakSettings>({
    widgetId,
    settings,
    updateSettings,
    normalizeSettings,
    variant,
}: HabitStreakWidgetComponentProps<TSettings>) => {
    const [nowMs, setNowMs] = useState(() => Date.now());
    const normalizedSettings = normalizeSettings(settings, nowMs);
    const instanceSettings = useHabitInstanceSettings(widgetId, normalizedSettings);
    const habitSettings = useMemo(
        () => applySharedSettings(normalizedSettings, instanceSettings),
        [normalizedSettings, instanceSettings]
    );
    const [flameReactionSignal, setFlameReactionSignal] = useState(0);
    const [motivationalToast, setMotivationalToast] = useState<MotivationalToast | null>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prefersReducedMotion = usePrefersReducedMotion();
    const canShowMotivationalToast = variant === 'ring' && 'showMotivationalMessage' in habitSettings && habitSettings.showMotivationalMessage;

    const checkInState = useMemo(
        () => getCheckInWindowState(habitSettings.lastCheckInAt, habitSettings.checkInIntervalHours, nowMs),
        [habitSettings.checkInIntervalHours, habitSettings.lastCheckInAt, nowMs]
    );

    const handleCountdownExpire = useCallback(() => {
        setNowMs(Date.now());
    }, []);

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        };
    }, []);

    useEffect(() => {
        if (canShowMotivationalToast) return;
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
            toastTimerRef.current = null;
        }
        setMotivationalToast(null);
    }, [canShowMotivationalToast]);

    const pushInstanceSettings = useCallback((nextSharedSettings: HabitStreakSharedSettings) => {
        writeHabitInstanceSettings(widgetId, nextSharedSettings);
        void updateSettings(applySharedSettings(normalizedSettings, nextSharedSettings) as TSettings);
    }, [normalizedSettings, updateSettings, widgetId]);

    const handleCheckIn = useCallback(() => {
        if (!checkInState.canCheckIn) return;

        const checkInAtMs = Date.now();
        const todayKey = getLocalDateKey(checkInAtMs);
        const nextStreakCount = computeNextStreakCount(
            habitSettings.streakCount,
            checkInState.windowsSinceLast,
            Boolean(habitSettings.lastCheckInAt)
        );
        const nextSharedSettings: HabitStreakSharedSettings = {
            ...extractHabitSharedSettings(habitSettings),
            streakCount: nextStreakCount,
            bestStreak: Math.max(habitSettings.bestStreak, nextStreakCount),
            totalCheckIns: habitSettings.totalCheckIns + 1,
            lastCheckInAt: new Date(checkInAtMs).toISOString(),
            checkInHistory: normalizeCheckInHistory(
                [...habitSettings.checkInHistory, todayKey],
                checkInAtMs
            ),
        };

        pushInstanceSettings(nextSharedSettings);
        setNowMs(checkInAtMs);
        setFlameReactionSignal((signal) => signal + 1);

        if (canShowMotivationalToast) {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            setMotivationalToast({ id: checkInAtMs, message: getMotivationalMessage(nextStreakCount) });
            toastTimerRef.current = setTimeout(() => setMotivationalToast(null), 3800);
        }
    }, [canShowMotivationalToast, checkInState.canCheckIn, checkInState.windowsSinceLast, habitSettings, pushInstanceSettings]);

    const habitTitle = habitSettings.habitName.trim().length > 0
        ? habitSettings.habitName
        : 'Untitled habit';
    const checkInButtonAriaLabel = checkInState.canCheckIn
        ? `Check in ${habitTitle}`
        : `Check-in for ${habitTitle} is on cooldown.`;
    const targetProgress = Math.min(100, Math.round((habitSettings.streakCount / habitSettings.targetStreak) * 100));
    const recentDayCells = useMemo(
        () => buildRecentDayCells(habitSettings.checkInHistory, nowMs),
        [habitSettings.checkInHistory, nowMs]
    );

    return (
        <div className="habit-streak-widget group relative flex h-full min-h-0 flex-col overflow-hidden p-3 text-foreground transition-colors xl:p-4">
            <div className="pointer-events-none absolute inset-0 z-0 opacity-60 mix-blend-plus-lighter transition-opacity duration-1000 group-hover:opacity-100 dark:opacity-40">
                <div className="absolute -left-12 -top-12 h-40 w-40 rounded-full bg-amber-400/30 blur-3xl dark:bg-amber-600/20" />
                <div className="absolute -right-12 bottom-0 h-48 w-48 rounded-full bg-rose-400/20 blur-3xl dark:bg-rose-600/10" />
            </div>

            <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-between gap-2">
                <div className="flex items-start justify-between">
                    <div className="grid gap-0.5">
                        <h3 className={cn(
                            'line-clamp-2 text-sm font-bold tracking-tight text-stone-800 dark:text-foreground sm:text-base md:text-lg',
                            habitSettings.habitName.trim().length === 0 && 'text-stone-500 dark:text-foreground/60'
                        )}>
                            {habitTitle}
                        </h3>
                    </div>
                </div>

                <div className="flex min-h-0 flex-1 items-center justify-center">
                    {variant === 'duolingo' ? (
                        <HabitStreakCalendar
                            prefersReducedMotion={prefersReducedMotion}
                            streakCount={habitSettings.streakCount}
                            recentDayCells={recentDayCells}
                            targetProgress={targetProgress}
                            reactionSignal={flameReactionSignal}
                        />
                    ) : (
                        <HabitStreakRing
                            prefersReducedMotion={prefersReducedMotion}
                            streakCount={habitSettings.streakCount}
                            targetProgress={targetProgress}
                            reactionSignal={flameReactionSignal}
                        />
                    )}
                </div>

                <div className="mt-auto shrink-0 grid gap-2">
                    <Button
                        onClick={handleCheckIn}
                        disabled={!checkInState.canCheckIn}
                        aria-label={checkInButtonAriaLabel}
                        className="group/habit-checkin relative h-11 w-full overflow-hidden border-0 bg-gradient-to-r from-[var(--habit-btn-start)] via-[var(--habit-btn-mid)] to-[var(--habit-btn-end)] text-sm font-semibold text-white shadow-none transition-all duration-300 ease-out hover:brightness-110 active:scale-[0.985] enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-[var(--habit-btn-disabled)] disabled:text-white/80 disabled:shadow-none disabled:opacity-75"
                    >
                        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.22)_50%,transparent_75%)] opacity-0 transition-opacity duration-300 group-hover/habit-checkin:opacity-100" />
                        <Sparkles aria-hidden="true" className={cn(
                            'relative mr-1.5 h-4 w-4 shrink-0 transition-transform duration-300 ease-out',
                            checkInState.canCheckIn && 'group-hover/habit-checkin:rotate-12 group-hover/habit-checkin:scale-110'
                        )} />
                        <span className="relative truncate">
                            {checkInState.canCheckIn
                                ? 'Check In'
                                : <>Wait <CountdownDisplay remainingMs={checkInState.remainingMs} onExpire={handleCountdownExpire} /></>}
                        </span>
                    </Button>
                </div>

                <AnimatePresence>
                    {motivationalToast && (
                        <motion.div
                            key={motivationalToast.id}
                            data-testid="habit-motivational-toast"
                            className="pointer-events-none absolute inset-x-0 bottom-11 z-20 flex items-end justify-center px-1 pb-1"
                            initial={{ opacity: 0, y: 6, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.96 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                        >
                            <p
                                className="max-w-[95%] rounded-full px-3 py-1.5 text-center text-xs font-semibold leading-snug shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                                role="status"
                                aria-live="polite"
                                style={{
                                    backgroundColor: 'color-mix(in srgb, var(--color-background) 88%, transparent)',
                                    color: 'var(--color-foreground)',
                                }}
                            >
                                {motivationalToast.message}
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>


        </div>
    );
};

export const HabitStreakDuolingoWidget: React.FC<WidgetProps<HabitStreakDuolingoSettings>> = (props) => (
    <HabitStreakWidgetComponent {...props} normalizeSettings={normalizeHabitStreakDuolingoSettings} variant="duolingo" />
);

export const HabitStreakRingWidget: React.FC<WidgetProps<HabitStreakRingSettings>> = (props) => (
    <HabitStreakWidgetComponent {...props} normalizeSettings={normalizeHabitStreakRingSettings} variant="ring" />
);

const createResetHeaderButton = <TSettings extends HabitStreakSettings>(
    normalizeSettings: (settings: unknown) => TSettings
) => ({
    id: 'reset-streak',
    render: ({ widgetId, settings: rawSettings, updateSettings }: HeaderButtonContext, { ConfirmActionButton }: { ConfirmActionButton: React.FC<HeaderConfirmActionButtonProps> }) => (
        <ConfirmActionButton
            title="Reset streak"
            icon={<RotateCcw className="h-4 w-4" />}
            dialogTitle="Reset this habit streak?"
            dialogDescription="This will clear streak progress and check-in history."
            confirmText="Reset"
            confirmVariant="destructive"
            onClick={async () => {
                const currentSettings = normalizeSettings(rawSettings);
                const nextSharedSettings = getResetSharedSettings(extractHabitSharedSettings(currentSettings));
                writeHabitInstanceSettings(widgetId, nextSharedSettings);
                void updateSettings(applySharedSettings(currentSettings, nextSharedSettings));
            }}
        />
    ),
});

export const HabitStreakDuolingoWidgetDefinition: WidgetDefinition = {
    type: DUOLINGO_WIDGET_TYPE,
    component: HabitStreakDuolingoWidget as WidgetDefinition['component'],
    SettingsComponent: HabitStreakDuolingoSettingsComponent as WidgetDefinition['SettingsComponent'],
    defaultSettings: DEFAULT_HABIT_STREAK_DUOLINGO_SETTINGS,
    headerButtons: [createResetHeaderButton(normalizeHabitStreakDuolingoSettings)],
    onDelete: ({ widgetId }) => {
        deleteHabitInstanceRecord(widgetId);
    },
};

export const HabitStreakRingWidgetDefinition: WidgetDefinition = {
    type: RING_WIDGET_TYPE,
    component: HabitStreakRingWidget as WidgetDefinition['component'],
    SettingsComponent: HabitStreakRingSettingsComponent as WidgetDefinition['SettingsComponent'],
    defaultSettings: DEFAULT_HABIT_STREAK_RING_SETTINGS,
    headerButtons: [createResetHeaderButton(normalizeHabitStreakRingSettings)],
    onDelete: ({ widgetId }) => {
        deleteHabitInstanceRecord(widgetId);
    },
};

export const HabitStreakWidgetDefinitions = [
    HabitStreakDuolingoWidgetDefinition,
    HabitStreakRingWidgetDefinition,
];

export const HabitStreakWidgetTypes = {
    duolingo: DUOLINGO_WIDGET_TYPE,
    ring: RING_WIDGET_TYPE,
};

export const HabitStreakIcons = {
    duolingo: CalendarDays,
    ring: Sparkles,
};
