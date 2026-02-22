"use no memo";

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { WidgetDefinition, WidgetProps, WidgetSettingsProps } from '../../services/widgetRegistry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Flame, RotateCcw, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * HOUR_IN_MS;
const INTERVAL_OPTIONS = [
    { value: 0, label: 'No interval' },
    { value: 1, label: 'Every hour' },
    { value: 24, label: 'Every day' },
    { value: 168, label: 'Every week' },
] as const;
const ALLOWED_INTERVAL_HOURS = INTERVAL_OPTIONS.map((option) => option.value);
const MIN_TARGET_STREAK = 1;
const MAX_TARGET_STREAK = 365;
interface HabitStreakSettings {
    habitName: string;
    checkInIntervalHours: number;
    targetStreak: number;
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
    targetStreak: 21,
    streakCount: 0,
    bestStreak: 0,
    totalCheckIns: 0,
    lastCheckInAt: null,
};

const clampIntervalHours = (value: unknown): number => {
    const numericValue = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
    if (!Number.isFinite(numericValue)) return DEFAULT_HABIT_STREAK_SETTINGS.checkInIntervalHours;
    const rounded = Math.round(numericValue);
    if (ALLOWED_INTERVAL_HOURS.includes(rounded as typeof ALLOWED_INTERVAL_HOURS[number])) {
        return rounded;
    }
    return DEFAULT_HABIT_STREAK_SETTINGS.checkInIntervalHours;
};

const clampTargetStreak = (value: unknown): number => {
    const numericValue = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
    if (!Number.isFinite(numericValue)) return DEFAULT_HABIT_STREAK_SETTINGS.targetStreak;
    const rounded = Math.round(numericValue);
    return Math.min(MAX_TARGET_STREAK, Math.max(MIN_TARGET_STREAK, rounded));
};

const getStartOfLocalDay = (timestampMs: number) => {
    const date = new Date(timestampMs);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
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
        targetStreak: clampTargetStreak(source.targetStreak),
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
                <Label htmlFor={`${ids}-habit-name`}>Habit</Label>
                <Input
                    id={`${ids}-habit-name`}
                    value={habitSettings.habitName}
                    placeholder="Review notes"
                    onChange={(event) => updateSettings({ habitName: event.target.value })}
                />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                    <Label htmlFor={`${ids}-interval-hours`}>Check-in cadence</Label>
                    <Select
                        value={String(habitSettings.checkInIntervalHours)}
                        onValueChange={(value) => updateSettings({ checkInIntervalHours: clampIntervalHours(value) })}
                    >
                        <SelectTrigger id={`${ids}-interval-hours`} className="w-full">
                            <SelectValue placeholder="Select cadence" />
                        </SelectTrigger>
                        <SelectContent>
                            {INTERVAL_OPTIONS.map((option) => (
                                <SelectItem key={`habit-interval-${option.value}`} value={String(option.value)}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`${ids}-target-streak`}>Target streak (count)</Label>
                    <Input
                        id={`${ids}-target-streak`}
                        type="number"
                        min={MIN_TARGET_STREAK}
                        max={MAX_TARGET_STREAK}
                        value={habitSettings.targetStreak}
                        onChange={(event) => updateSettings({ targetStreak: clampTargetStreak(event.target.value) })}
                    />
                </div>
            </div>
        </div>
    );
};

interface HabitRingProps {
    prefersReducedMotion: boolean;
    streakCount: number;
    targetProgress: number;
    reactionSignal: number;
}

const getMilestoneTier = (progress: number): 0 | 1 | 2 | 3 | 4 => {
    if (progress >= 100) return 4;
    if (progress >= 75) return 3;
    if (progress >= 50) return 2;
    if (progress >= 25) return 1;
    return 0;
};

const HabitRing: React.FC<HabitRingProps> = ({ prefersReducedMotion, streakCount, targetProgress, reactionSignal }) => {
    const [bursts, setBursts] = useState<{ id: number }[]>([]);
    const [milestoneBursts, setMilestoneBursts] = useState<{ id: number; color: string }[]>([]);

    // Track previous tier to detect boundary crossings
    const prevTierRef = React.useRef(getMilestoneTier(targetProgress));

    useEffect(() => {
        if (prefersReducedMotion || reactionSignal === 0) return;
        setBursts((prev) => [...prev, { id: Date.now() }].slice(-3));
    }, [reactionSignal, prefersReducedMotion]);

    useEffect(() => {
        if (prefersReducedMotion) return;
        const currentTier = getMilestoneTier(targetProgress);
        if (currentTier > prevTierRef.current && currentTier > 0) {
            // Reached a new 25% milestone
            const colors = ['#fde047', '#fcd34d', '#fbbf24', '#f59e0b', '#f97316'];
            setMilestoneBursts(prev => [...prev, { id: Date.now(), color: colors[currentTier] }].slice(-4));
        }
        prevTierRef.current = currentTier;
    }, [targetProgress, prefersReducedMotion]);

    const circumference = 2 * Math.PI * 46; // r=46
    const strokeDashoffset = circumference - (targetProgress / 100) * circumference;

    // Progress-based vibrant glow
    const getCoreColor = (progress: number) => {
        if (progress >= 100) return 'rgba(244, 63, 94, 0.8)'; // Rose
        if (progress >= 75) return 'rgba(249, 115, 22, 0.8)'; // Orange
        if (progress >= 50) return 'rgba(245, 158, 11, 0.8)'; // Amber
        return 'rgba(250, 204, 21, 0.8)'; // Yellow
    };

    return (
        <div className="relative flex aspect-square h-full max-h-[160px] min-h-[120px] items-center justify-center">
            {/* Animated Glowing Core */}
            <motion.div
                className="absolute inset-[18%] rounded-full opacity-60 mix-blend-screen blur-xl dark:opacity-40"
                animate={prefersReducedMotion ? {} : {
                    scale: [1, 1.05, 1],
                    opacity: [0.5, 0.7, 0.5]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                style={{ background: `radial-gradient(circle, ${getCoreColor(targetProgress)} 0%, transparent 70%)` }}
            />

            {/* Progress SVG Ring */}
            <svg className="absolute inset-0 h-full w-full -rotate-90 transform drop-shadow-[0_4px_12px_rgba(249,115,22,0.3)]" viewBox="0 0 100 100">
                {/* Track background */}
                <circle
                    cx="50"
                    cy="50"
                    r="46"
                    stroke="currentColor"
                    strokeWidth="4.5"
                    fill="none"
                    className="text-black/5 dark:text-white/5"
                />
                {/* Animated progress */}
                <motion.circle
                    cx="50"
                    cy="50"
                    r="46"
                    stroke="url(#streak-gradient)"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    fill="none"
                    initial={prefersReducedMotion ? { strokeDashoffset } : { strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    strokeDasharray={circumference}
                />
                <defs>
                    <linearGradient id="streak-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#facc15" />
                        <stop offset="50%" stopColor="#f97316" />
                        <stop offset="100%" stopColor="#f43f5e" />
                    </linearGradient>
                </defs>
            </svg>

            {/* Reaction Ripple Burst */}
            <AnimatePresence>
                {bursts.map(burst => (
                    <motion.div
                        key={burst.id}
                        className="absolute inset-0 rounded-full border-2 border-orange-500/50 mix-blend-plus-lighter"
                        initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.8, opacity: 1, borderWidth: '3px' }}
                        animate={prefersReducedMotion ? { opacity: 0 } : { scale: 1.6, opacity: 0, borderWidth: '0px' }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                ))}
            </AnimatePresence>

            {/* Milestone Particle Bursts (every 25%) */}
            <AnimatePresence>
                {milestoneBursts.map(burst => (
                    <div key={burst.id} className="pointer-events-none absolute inset-0 mix-blend-screen">
                        {Array.from({ length: 12 }).map((_, i) => {
                            const angle = (i * 30 + (Math.random() * 10 - 5)) * (Math.PI / 180);
                            const distance = 50 + Math.random() * 20;
                            return (
                                <motion.div
                                    key={i}
                                    className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                                    style={{ backgroundColor: burst.color, boxShadow: `0 0 6px ${burst.color}` }}
                                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 1, x: 0, y: 0, scale: 0.8 }}
                                    animate={prefersReducedMotion ? { opacity: 0 } : {
                                        opacity: [1, 0.8, 0],
                                        x: Math.cos(angle) * distance,
                                        y: Math.sin(angle) * distance,
                                        scale: [0.8, 1.2, 0]
                                    }}
                                    transition={{ duration: 1.2, ease: "easeOut", delay: i * 0.02 }}
                                />
                            );
                        })}
                    </div>
                ))}
            </AnimatePresence>

            {/* Center Content */}
            <div className="flex flex-col items-center justify-center -space-y-1">
                <motion.span
                    key={streakCount}
                    initial={prefersReducedMotion ? false : { scale: 1.15, opacity: 0.5 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="text-4xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-foreground to-foreground/60 drop-shadow-sm dark:from-white dark:to-white/60"
                >
                    {streakCount}
                </motion.span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/50">
                    Streak
                </span>
            </div>
        </div>
    );
};

const HabitStreakWidgetComponent: React.FC<WidgetProps> = ({ settings, updateSettings }) => {
    const habitSettings = normalizeHabitStreakSettings(settings);
    const [nowMs, setNowMs] = useState(() => Date.now());
    const [flameReactionSignal, setFlameReactionSignal] = useState(0);
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
        setFlameReactionSignal((signal) => signal + 1);
    }, [checkInState.canCheckIn, checkInState.windowsSinceLast, habitSettings, updateSettings]);

    const buttonLabel = checkInState.canCheckIn
        ? 'Check In'
        : `Wait ${formatRemainingTime(checkInState.remainingMs)}`;
    const habitTitle = habitSettings.habitName.trim().length > 0
        ? habitSettings.habitName
        : 'Habit task (e.g. Review notes for 30 mins)';
    const targetProgress = Math.min(100, Math.round((habitSettings.streakCount / habitSettings.targetStreak) * 100));

    return (
        <div className="habit-streak-widget group relative flex h-full min-h-0 flex-col overflow-hidden p-3 text-foreground shadow-[0_14px_30px_rgba(236,114,41,0.22)] outline outline-1 -outline-offset-1 outline-black/5 transition-colors dark:shadow-[0_20px_40px_rgba(77,24,8,0.56)] dark:outline-white/10 xl:p-4">
            {/* Modern Glowing Aura Blobs */}
            <div className="pointer-events-none absolute inset-0 z-0 opacity-60 mix-blend-plus-lighter transition-opacity duration-1000 group-hover:opacity-100 dark:opacity-40">
                <div className="absolute -left-12 -top-12 h-40 w-40 rounded-full bg-amber-400/30 blur-3xl dark:bg-amber-600/20" />
                <div className="absolute -right-12 bottom-0 h-48 w-48 rounded-full bg-rose-400/20 blur-3xl dark:bg-rose-600/10" />
            </div>

            <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-between gap-2">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div className="grid gap-0.5">
                        <h3 className={cn(
                            'line-clamp-2 text-sm font-bold tracking-tight text-foreground sm:text-base md:text-lg',
                            habitSettings.habitName.trim().length === 0 && 'text-foreground/60'
                        )}>
                            {habitTitle}
                        </h3>
                        <span className="text-[11px] font-medium text-foreground/50">
                            Goal: {habitSettings.targetStreak} streaks
                        </span>
                    </div>
                </div>

                {/* Ring Visualization */}
                <div className="flex min-h-0 flex-1 items-center justify-center">
                    <HabitRing
                        prefersReducedMotion={prefersReducedMotion}
                        streakCount={habitSettings.streakCount}
                        targetProgress={targetProgress}
                        reactionSignal={flameReactionSignal}
                    />
                </div>

                {/* Check In Action */}
                <div className="mt-auto shrink-0 grid gap-2">
                    <Button
                        onClick={handleCheckIn}
                        disabled={!checkInState.canCheckIn}
                        className="group/habit-checkin relative h-10 w-full overflow-hidden bg-gradient-to-r from-[#ff9f1c] via-[#ff6b35] to-[#e5383b] text-sm font-semibold text-white shadow-[0_12px_24px_rgba(229,80,40,0.34)] transition-all duration-300 ease-out hover:brightness-110 active:scale-[0.985] enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-[#8e6f53] disabled:text-white/80 disabled:shadow-none disabled:opacity-75 dark:shadow-[0_16px_30px_rgba(234,102,47,0.34)]"
                    >
                        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.22)_50%,transparent_75%)] opacity-0 transition-opacity duration-300 group-hover/habit-checkin:opacity-100" />
                        <Sparkles className={cn(
                            'relative mr-1.5 h-4 w-4 transition-transform duration-300 ease-out',
                            checkInState.canCheckIn && 'group-hover/habit-checkin:rotate-12 group-hover/habit-checkin:scale-110'
                        )} />
                        <span className="relative">
                            {buttonLabel}
                        </span>
                    </Button>
                </div>
            </div>

            <style>{`
                .habit-streak-widget {
                    container-type: size;
                    background:
                        radial-gradient(120% 96% at 14% 10%, rgba(255, 240, 181, 0.9) 0%, rgba(255, 240, 181, 0) 52%),
                        radial-gradient(104% 82% at 90% 88%, rgba(255, 170, 128, 0.7) 0%, rgba(255, 170, 128, 0) 60%),
                        radial-gradient(70% 62% at 50% 56%, rgba(255, 194, 120, 0.38) 0%, rgba(255, 194, 120, 0) 68%),
                        linear-gradient(138deg, #fff2d9 0%, #ffe4c1 44%, #ffd8bf 100%);
                }
                .dark .habit-streak-widget {
                    background:
                        radial-gradient(128% 100% at 14% 10%, rgba(255, 172, 80, 0.32) 0%, rgba(255, 172, 80, 0) 52%),
                        radial-gradient(108% 86% at 88% 88%, rgba(255, 98, 64, 0.34) 0%, rgba(255, 98, 64, 0) 58%),
                        radial-gradient(72% 62% at 52% 58%, rgba(247, 151, 43, 0.2) 0%, rgba(247, 151, 43, 0) 66%),
                        linear-gradient(142deg, #2f1208 0%, #3e170b 46%, #4a1b10 100%);
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
