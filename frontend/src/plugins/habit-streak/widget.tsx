"use no memo";

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { WidgetDefinition, WidgetProps, WidgetSettingsProps } from '../../services/widgetRegistry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Flame, Gauge, RotateCcw, Sparkles } from 'lucide-react';

const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * HOUR_IN_MS;
const MIN_INTERVAL_HOURS = 0;
const MAX_INTERVAL_HOURS = 168;
const CELEBRATION_DURATION_MS = 950;

interface HabitStreakSettings {
    habitName: string;
    checkInIntervalHours: number;
    streakCount: number;
    bestStreak: number;
    totalCheckIns: number;
    lastCheckInAt: string | null;
}

interface CheckInWindowState {
    canCheckIn: boolean;
    remainingMs: number;
    windowsSinceLast: number;
}

const DEFAULT_HABIT_STREAK_SETTINGS: HabitStreakSettings = {
    habitName: '',
    checkInIntervalHours: 24,
    streakCount: 0,
    bestStreak: 0,
    totalCheckIns: 0,
    lastCheckInAt: null,
};

const clampIntervalHours = (value: unknown): number => {
    const numericValue = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
    if (!Number.isFinite(numericValue)) return DEFAULT_HABIT_STREAK_SETTINGS.checkInIntervalHours;
    const rounded = Math.round(numericValue);
    return Math.min(MAX_INTERVAL_HOURS, Math.max(MIN_INTERVAL_HOURS, rounded));
};

const getStartOfLocalDay = (timestampMs: number) => {
    const date = new Date(timestampMs);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

const getIntervalLabel = (intervalHours: number) => {
    if (intervalHours <= 0) return 'No gap';
    if (intervalHours === 24) return 'Daily';
    return `${intervalHours}h`;
};

const normalizeHabitStreakSettings = (settings: unknown): HabitStreakSettings => {
    if (!settings || typeof settings !== 'object') {
        return DEFAULT_HABIT_STREAK_SETTINGS;
    }

    const source = settings as Partial<HabitStreakSettings>;
    const parsedLastCheckInAt = typeof source.lastCheckInAt === 'string' ? Date.parse(source.lastCheckInAt) : NaN;

    return {
        habitName: typeof source.habitName === 'string' ? source.habitName : DEFAULT_HABIT_STREAK_SETTINGS.habitName,
        checkInIntervalHours: clampIntervalHours(source.checkInIntervalHours),
        streakCount: Number.isFinite(source.streakCount) ? Math.max(0, Math.round(source.streakCount as number)) : 0,
        bestStreak: Number.isFinite(source.bestStreak) ? Math.max(0, Math.round(source.bestStreak as number)) : 0,
        totalCheckIns: Number.isFinite(source.totalCheckIns) ? Math.max(0, Math.round(source.totalCheckIns as number)) : 0,
        lastCheckInAt: Number.isNaN(parsedLastCheckInAt) ? null : new Date(parsedLastCheckInAt).toISOString(),
    };
};

export const getCheckInWindowState = (
    lastCheckInAt: string | null,
    intervalHours: number,
    nowMs: number
): CheckInWindowState => {
    const normalizedIntervalHours = clampIntervalHours(intervalHours);
    if (normalizedIntervalHours === 0) {
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
    if (windowsSinceLast <= 1) return Math.max(1, currentStreak + 1);
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

const HabitStreakSettingsComponent: React.FC<WidgetSettingsProps> = ({ settings, onSettingsChange }) => {
    const ids = useId();
    const habitSettings = normalizeHabitStreakSettings(settings);

    const updateSettings = useCallback((patch: Partial<HabitStreakSettings>) => {
        onSettingsChange({
            ...habitSettings,
            ...patch,
        });
    }, [habitSettings, onSettingsChange]);

    return (
        <div className="grid gap-4">
            <div className="grid gap-2">
                <Label htmlFor={`${ids}-habit-name`}>Habit Task</Label>
                <Input
                    id={`${ids}-habit-name`}
                    value={habitSettings.habitName}
                    placeholder="Review notes for 30 minutes"
                    onChange={(event) => updateSettings({ habitName: event.target.value })}
                />
            </div>

            <div className="grid gap-2">
                <Label htmlFor={`${ids}-interval-hours`}>Check-in Interval (hours)</Label>
                <Input
                    id={`${ids}-interval-hours`}
                    type="number"
                    min={MIN_INTERVAL_HOURS}
                    max={MAX_INTERVAL_HOURS}
                    value={habitSettings.checkInIntervalHours}
                    onChange={(event) => updateSettings({ checkInIntervalHours: clampIntervalHours(event.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                    Use `0` for no interval. `24` means once per day by calendar day.
                </p>
            </div>
        </div>
    );
};

const HabitStreakWidgetComponent: React.FC<WidgetProps> = ({ settings, updateSettings }) => {
    const habitSettings = normalizeHabitStreakSettings(settings);
    const [nowMs, setNowMs] = useState(() => Date.now());
    const [isCelebrating, setIsCelebrating] = useState(false);
    const [particleSeed, setParticleSeed] = useState(0);
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const checkInState = useMemo(
        () => getCheckInWindowState(habitSettings.lastCheckInAt, habitSettings.checkInIntervalHours, nowMs),
        [habitSettings.lastCheckInAt, habitSettings.checkInIntervalHours, nowMs]
    );

    useEffect(() => {
        if (checkInState.canCheckIn) return;
        const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [checkInState.canCheckIn]);

    useEffect(() => {
        if (!isCelebrating) return;
        const timer = window.setTimeout(() => setIsCelebrating(false), CELEBRATION_DURATION_MS);
        return () => window.clearTimeout(timer);
    }, [isCelebrating]);

    const updateHabitSettings = useCallback((patch: Partial<HabitStreakSettings>) => {
        updateSettings({
            ...habitSettings,
            ...patch,
        });
    }, [habitSettings, updateSettings]);

    const handleCheckIn = useCallback(() => {
        if (!checkInState.canCheckIn) return;

        const checkInAtMs = Date.now();
        const nextStreakCount = computeNextStreakCount(
            habitSettings.streakCount,
            checkInState.windowsSinceLast,
            Boolean(habitSettings.lastCheckInAt)
        );

        void updateSettings({
            ...habitSettings,
            streakCount: nextStreakCount,
            bestStreak: Math.max(habitSettings.bestStreak, nextStreakCount),
            totalCheckIns: habitSettings.totalCheckIns + 1,
            lastCheckInAt: new Date(checkInAtMs).toISOString(),
        });

        setNowMs(checkInAtMs);
        if (!prefersReducedMotion) {
            setIsCelebrating(true);
            setParticleSeed((seed) => seed + 1);
        }
    }, [checkInState.canCheckIn, checkInState.windowsSinceLast, habitSettings, prefersReducedMotion, updateSettings]);

    const streakHeat = Math.min(1, habitSettings.streakCount / 14);
    const flameScale = 1 + streakHeat * 0.16 + (isCelebrating ? 0.12 : 0);
    const intervalLabel = getIntervalLabel(habitSettings.checkInIntervalHours);
    const statusText = checkInState.canCheckIn
        ? (habitSettings.checkInIntervalHours === 0 ? 'No interval lock' : 'Ready to check in')
        : `Next check-in in ${formatRemainingTime(checkInState.remainingMs)}`;

    return (
        <div className="habit-streak-widget relative h-full overflow-hidden bg-gradient-to-br from-orange-100/65 via-amber-100/50 to-fuchsia-100/45 p-3 dark:from-orange-950/20 dark:via-amber-950/15 dark:to-fuchsia-950/15">
            <div className="pointer-events-none absolute -top-10 right-[-36px] h-24 w-24 rounded-full bg-orange-300/30 blur-3xl dark:bg-orange-500/20" />

            <div className="relative flex h-full min-h-0 flex-col gap-2">
                <div className="flex items-center gap-2">
                    <Input
                        value={habitSettings.habitName}
                        onChange={(event) => updateHabitSettings({ habitName: event.target.value })}
                        placeholder="Habit task (e.g. Review notes for 30 mins)"
                        className="h-8 border-transparent bg-white/70 text-sm font-medium shadow-none transition-[background-color,border-color,transform] duration-300 ease-out focus-visible:border-white/45 focus-visible:bg-white/90 focus-visible:ring-0 dark:bg-white/10 dark:focus-visible:bg-white/15"
                    />
                    <div className="inline-flex h-8 shrink-0 items-center rounded-full bg-gradient-to-r from-orange-500/85 via-amber-500/85 to-pink-500/85 px-2 text-xs font-semibold text-white shadow-sm transition-[transform,filter] duration-300 ease-out hover:brightness-110">
                        {intervalLabel}
                    </div>
                </div>

                <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
                    <div className="pointer-events-none absolute top-1 left-1/2 z-10 inline-flex max-w-[88%] -translate-x-1/2 items-center gap-1 truncate rounded-full bg-white/68 px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-sm backdrop-blur-sm dark:bg-black/35 dark:text-slate-100">
                        <Gauge className="h-3 w-3 shrink-0" />
                        <span className="truncate">{statusText}</span>
                    </div>
                    <div className="pointer-events-none absolute top-1 right-1 z-10 inline-flex items-center rounded-full bg-white/58 px-2 py-0.5 text-[10px] font-medium text-slate-700 backdrop-blur-sm dark:bg-black/30 dark:text-slate-100">
                        {habitSettings.totalCheckIns} check-ins
                    </div>

                    {isCelebrating && !prefersReducedMotion && (
                        <>
                            {Array.from({ length: 10 }).map((_, index) => (
                                <span
                                    key={`${particleSeed}-${index}`}
                                    className="habit-particle absolute h-2.5 w-2.5 rounded-full"
                                    style={{
                                        '--habit-particle-angle': `${index * 36}deg`,
                                        '--habit-particle-distance': `${32 + (index % 4) * 7}px`,
                                        '--habit-particle-color': `hsl(${20 + index * 22} 96% 60%)`,
                                    } as React.CSSProperties}
                                />
                            ))}
                        </>
                    )}

                    <div className="habit-flame-stage relative flex h-[11.5rem] w-[11.5rem] max-w-full items-center justify-center">
                        <div className={cn('habit-flame-aura absolute inset-0 rounded-full', !prefersReducedMotion && 'animate-[habit-aura-pulse_2100ms_ease-in-out_infinite]')} />
                        <div className="habit-flame-shadow absolute bottom-7 h-6 w-20 rounded-full" />
                        <div className="relative transition-transform duration-500 ease-out" style={{ transform: `scale(${flameScale})` }}>
                            <div className={cn('habit-flame-3d relative h-28 w-24', !prefersReducedMotion && 'animate-[habit-flame-tilt_1900ms_ease-in-out_infinite]')}>
                                <span className={cn('habit-flame-layer habit-flame-back', !prefersReducedMotion && 'animate-[habit-flicker-back_1700ms_ease-in-out_infinite]')} />
                                <span className={cn('habit-flame-layer habit-flame-mid', !prefersReducedMotion && 'animate-[habit-flicker-mid_1200ms_ease-in-out_infinite]')} />
                                <span className={cn('habit-flame-layer habit-flame-front', !prefersReducedMotion && 'animate-[habit-flicker-front_900ms_ease-in-out_infinite]')} />
                                <span className={cn('habit-flame-layer habit-flame-tip', !prefersReducedMotion && 'animate-[habit-flicker-tip_760ms_ease-in-out_infinite]')} />
                                <span className={cn('habit-flame-layer habit-flame-ember', !prefersReducedMotion && 'animate-[habit-flicker-ember_1280ms_ease-in-out_infinite]')} />
                                <span className="habit-flame-core absolute left-1/2 bottom-2 h-9 w-9 -translate-x-1/2 rounded-full" />
                            </div>
                        </div>
                        <div className="absolute bottom-1 inline-flex items-center rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-slate-800 dark:bg-black/45 dark:text-white">
                            {habitSettings.streakCount} streak
                        </div>
                    </div>
                </div>

                <div className="mt-auto shrink-0 grid gap-2">
                    <Button
                        onClick={handleCheckIn}
                        disabled={!checkInState.canCheckIn}
                        className="group/habit-checkin relative h-10 w-full overflow-hidden bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 text-sm font-semibold text-white transition-all duration-300 ease-out hover:brightness-110 active:scale-[0.985] enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.22)_50%,transparent_75%)] opacity-0 transition-opacity duration-300 group-hover/habit-checkin:opacity-100" />
                        <Sparkles className={cn(
                            'relative mr-1.5 h-4 w-4 transition-transform duration-300 ease-out',
                            checkInState.canCheckIn && 'group-hover/habit-checkin:rotate-12 group-hover/habit-checkin:scale-110'
                        )} />
                        <span className="relative">
                            {checkInState.canCheckIn ? 'Check In' : 'Locked for this interval'}
                        </span>
                    </Button>
                </div>
            </div>

            <style>{`
                .habit-flame-stage {
                    perspective: 920px;
                    transform-style: preserve-3d;
                }
                .habit-flame-aura {
                    background: radial-gradient(circle at 50% 58%, rgba(255, 215, 130, 0.62), rgba(251, 146, 60, 0.34) 36%, rgba(236, 72, 153, 0.18) 60%, rgba(124, 58, 237, 0.08) 74%, transparent 84%);
                    filter: blur(1px);
                }
                .habit-flame-shadow {
                    background: radial-gradient(circle at 50% 50%, rgba(17, 24, 39, 0.42), rgba(17, 24, 39, 0.08) 70%, transparent 100%);
                    filter: blur(5px);
                }
                .habit-flame-3d {
                    transform-style: preserve-3d;
                    transform-origin: center bottom;
                }
                .habit-flame-layer {
                    position: absolute;
                    left: 50%;
                    bottom: 0;
                    border-radius: 58% 58% 44% 44% / 72% 72% 30% 30%;
                    transform-origin: center bottom;
                    will-change: transform, opacity;
                }
                .habit-flame-back {
                    width: 78px;
                    height: 104px;
                    margin-left: -39px;
                    background: linear-gradient(180deg, #fef3c7 0%, #fb923c 44%, #f43f5e 76%, #6d28d9 100%);
                    filter: saturate(1.18) blur(0.7px);
                    opacity: 0.58;
                    transform: translateZ(-22px) rotateX(18deg);
                }
                .habit-flame-mid {
                    width: 66px;
                    height: 94px;
                    margin-left: -33px;
                    background: linear-gradient(180deg, #fff8cc 0%, #f59e0b 34%, #fb7185 72%, #7e22ce 100%);
                    transform: translateZ(-2px) rotateX(10deg);
                }
                .habit-flame-front {
                    width: 54px;
                    height: 84px;
                    margin-left: -27px;
                    background: linear-gradient(180deg, #fff9d5 0%, #facc15 26%, #fb923c 58%, #f43f5e 100%);
                    transform: translateZ(16px) rotateX(6deg);
                }
                .habit-flame-tip {
                    width: 30px;
                    height: 50px;
                    margin-left: -15px;
                    background: linear-gradient(180deg, #ffffff 0%, #fde68a 52%, rgba(251, 146, 60, 0.04) 100%);
                    opacity: 0.92;
                    transform: translateZ(24px) rotateX(4deg);
                    border-radius: 62% 62% 42% 42% / 88% 88% 24% 24%;
                }
                .habit-flame-ember {
                    width: 16px;
                    height: 22px;
                    margin-left: -8px;
                    bottom: 10px;
                    background: radial-gradient(circle, rgba(255, 251, 235, 0.92) 0%, rgba(254, 215, 170, 0.8) 48%, rgba(251, 146, 60, 0.08) 100%);
                    transform: translateZ(26px);
                }
                .habit-flame-core {
                    background: radial-gradient(circle, rgba(255, 252, 220, 0.96) 0%, rgba(255, 226, 150, 0.9) 48%, rgba(251, 146, 60, 0.1) 100%);
                }
                @keyframes habit-flame-tilt {
                    0%, 100% { transform: rotateY(-8deg) rotateX(9deg) translateY(1px); }
                    50% { transform: rotateY(8deg) rotateX(14deg) translateY(-3px); }
                }
                @keyframes habit-flicker-back {
                    0%, 100% { transform: translateZ(-22px) rotateX(18deg) scale(0.95, 0.94); }
                    45% { transform: translateZ(-19px) rotateX(13deg) scale(1.03, 1.04); }
                    70% { transform: translateZ(-21px) rotateX(17deg) scale(0.98, 0.98); }
                }
                @keyframes habit-flicker-mid {
                    0%, 100% { transform: translateZ(-2px) rotateX(10deg) scale(0.95, 0.94); }
                    40% { transform: translateZ(1px) rotateX(7deg) scale(1.03, 1.05); }
                    80% { transform: translateZ(0px) rotateX(9deg) scale(0.99, 0.99); }
                }
                @keyframes habit-flicker-front {
                    0%, 100% { transform: translateZ(16px) rotateX(6deg) scale(0.95, 0.93); }
                    35% { transform: translateZ(20px) rotateX(3deg) scale(1.05, 1.08); }
                    68% { transform: translateZ(17px) rotateX(5deg) scale(0.98, 1.02); }
                }
                @keyframes habit-flicker-tip {
                    0%, 100% { transform: translateZ(24px) rotateX(4deg) scale(0.96, 0.92); opacity: 0.9; }
                    50% { transform: translateZ(27px) rotateX(1deg) scale(1.06, 1.1); opacity: 1; }
                }
                @keyframes habit-flicker-ember {
                    0%, 100% { transform: translateZ(26px) translateY(0); opacity: 0.66; }
                    45% { transform: translateZ(30px) translateY(-3px); opacity: 0.95; }
                    80% { transform: translateZ(28px) translateY(-1px); opacity: 0.75; }
                }
                @keyframes habit-aura-pulse {
                    0%, 100% { opacity: 0.62; transform: scale(0.95); }
                    50% { opacity: 0.94; transform: scale(1.05); }
                }
                @keyframes habit-particle-burst {
                    0% {
                        opacity: 0;
                        transform: rotate(var(--habit-particle-angle)) translateY(0) scale(0.55);
                    }
                    15% { opacity: 1; }
                    100% {
                        opacity: 0;
                        transform: rotate(var(--habit-particle-angle)) translateY(calc(-1 * var(--habit-particle-distance))) scale(1.1);
                    }
                }
                .habit-particle {
                    background: var(--habit-particle-color);
                    animation: habit-particle-burst 860ms cubic-bezier(0.15, 0.8, 0.25, 1) forwards;
                }
                @media (prefers-reduced-motion: reduce) {
                    .habit-streak-widget * {
                        animation: none !important;
                        transition-duration: 0ms !important;
                    }
                }
            `}</style>
        </div>
    );
};

export const HabitStreakWidget = HabitStreakWidgetComponent;

export const HabitStreakWidgetDefinition: WidgetDefinition = {
    type: 'habit-streak',
    name: 'Habit Streak',
    description: 'Build momentum with interval-based check-ins and streak tracking.',
    icon: <Flame className="h-4 w-4" />,
    component: HabitStreakWidget,
    SettingsComponent: HabitStreakSettingsComponent,
    defaultSettings: DEFAULT_HABIT_STREAK_SETTINGS,
    layout: { w: 4, h: 4, minW: 3, minH: 3, maxW: 7, maxH: 8 },
    maxInstances: 'unlimited',
    allowedContexts: ['semester', 'course'],
    headerButtons: [
        {
            id: 'reset-streak',
            render: ({ settings: rawSettings, updateSettings: updateWidgetSettings }, { ConfirmActionButton }) => (
                <ConfirmActionButton
                    title="Reset streak"
                    icon={<RotateCcw className="h-4 w-4" />}
                    dialogTitle="Reset this habit streak?"
                    dialogDescription="This will clear streak progress and check-in history."
                    confirmText="Reset"
                    confirmVariant="destructive"
                    onClick={() => {
                        const currentSettings = normalizeHabitStreakSettings(rawSettings);
                        void updateWidgetSettings({
                            ...currentSettings,
                            streakCount: 0,
                            bestStreak: 0,
                            totalCheckIns: 0,
                            lastCheckInAt: null,
                        });
                    }}
                />
            ),
        },
    ],
};
