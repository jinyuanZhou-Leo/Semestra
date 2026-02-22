"use no memo";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { WidgetDefinition, WidgetProps, WidgetSettingsProps } from '../../services/widgetRegistry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Flame, RotateCcw, Sparkles } from 'lucide-react';

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

interface HabitFlameProps {
    flameScale: number;
    prefersReducedMotion: boolean;
    streakCount: number;
    targetStreak: number;
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

const FLAME_PARTICLES = [
    { ox: '-3.4rem', oy: '1.2rem', dx1: '-1.4rem', dy1: '-2.6rem', dx2: '-4.8rem', dy2: '-7.8rem', size: '0.44rem', delay: '0ms', duration: '980ms', color: '#ffd38a' },
    { ox: '-3rem', oy: '0.2rem', dx1: '-1rem', dy1: '-3rem', dx2: '-3.9rem', dy2: '-8.6rem', size: '0.38rem', delay: '12ms', duration: '1040ms', color: '#ffc767' },
    { ox: '-2.4rem', oy: '-0.9rem', dx1: '-0.8rem', dy1: '-2.8rem', dx2: '-3rem', dy2: '-8.2rem', size: '0.34rem', delay: '24ms', duration: '980ms', color: '#ffd88e' },
    { ox: '-1.5rem', oy: '-2rem', dx1: '-0.4rem', dy1: '-2.5rem', dx2: '-1.8rem', dy2: '-7.4rem', size: '0.3rem', delay: '34ms', duration: '940ms', color: '#fff1cf' },
    { ox: '-0.4rem', oy: '-2.9rem', dx1: '-0.1rem', dy1: '-2.3rem', dx2: '-0.6rem', dy2: '-6.9rem', size: '0.28rem', delay: '42ms', duration: '920ms', color: '#fff6dc' },
    { ox: '0.4rem', oy: '-3rem', dx1: '0.1rem', dy1: '-2.3rem', dx2: '0.8rem', dy2: '-6.8rem', size: '0.28rem', delay: '48ms', duration: '920ms', color: '#fff4d8' },
    { ox: '1.5rem', oy: '-2rem', dx1: '0.5rem', dy1: '-2.5rem', dx2: '2rem', dy2: '-7.4rem', size: '0.3rem', delay: '56ms', duration: '940ms', color: '#fff0cc' },
    { ox: '2.4rem', oy: '-0.9rem', dx1: '0.8rem', dy1: '-2.8rem', dx2: '3.1rem', dy2: '-8.1rem', size: '0.34rem', delay: '66ms', duration: '980ms', color: '#ffcb78' },
    { ox: '3rem', oy: '0.2rem', dx1: '1rem', dy1: '-3rem', dx2: '4rem', dy2: '-8.6rem', size: '0.38rem', delay: '78ms', duration: '1040ms', color: '#ffb866' },
    { ox: '3.4rem', oy: '1.2rem', dx1: '1.4rem', dy1: '-2.6rem', dx2: '4.9rem', dy2: '-7.8rem', size: '0.44rem', delay: '90ms', duration: '980ms', color: '#ffa258' },
    { ox: '-2.8rem', oy: '1.7rem', dx1: '-1.1rem', dy1: '-2.4rem', dx2: '-3.8rem', dy2: '-7rem', size: '0.4rem', delay: '20ms', duration: '980ms', color: '#ffc984' },
    { ox: '2.8rem', oy: '1.7rem', dx1: '1.1rem', dy1: '-2.4rem', dx2: '3.9rem', dy2: '-7rem', size: '0.4rem', delay: '74ms', duration: '980ms', color: '#ffb26e' },
    { ox: '-1rem', oy: '1.9rem', dx1: '-0.4rem', dy1: '-2.2rem', dx2: '-1.5rem', dy2: '-6.6rem', size: '0.32rem', delay: '30ms', duration: '920ms', color: '#ffd38e' },
    { ox: '1rem', oy: '1.9rem', dx1: '0.4rem', dy1: '-2.2rem', dx2: '1.6rem', dy2: '-6.6rem', size: '0.32rem', delay: '84ms', duration: '920ms', color: '#ffc179' },
] as const;

const HabitFlame: React.FC<HabitFlameProps> = ({ flameScale, prefersReducedMotion, streakCount, targetStreak, targetProgress, reactionSignal }) => {
    const [reactionTick, setReactionTick] = useState(0);
    const [hasTriggeredReaction, setHasTriggeredReaction] = useState(false);
    const [milestoneBurstTick, setMilestoneBurstTick] = useState(0);
    const milestoneTier = getMilestoneTier(targetProgress);
    const flameStateClass = `habit-flame-state-${milestoneTier}`;
    const lastMilestoneTierRef = useRef(milestoneTier);
    const reactionClassName = !prefersReducedMotion && hasTriggeredReaction
        ? (reactionTick % 2 === 0
            ? 'animate-[habit-reaction-a_460ms_ease-out_1]'
            : 'animate-[habit-reaction-b_460ms_ease-out_1]')
        : '';

    useEffect(() => {
        if (prefersReducedMotion || reactionSignal === 0) return;
        setHasTriggeredReaction(true);
        setReactionTick((current) => current + 1);
    }, [prefersReducedMotion, reactionSignal]);

    useEffect(() => {
        if (prefersReducedMotion) {
            lastMilestoneTierRef.current = milestoneTier;
            return;
        }
        if (milestoneTier > lastMilestoneTierRef.current) {
            setMilestoneBurstTick((current) => current + 1);
        }
        lastMilestoneTierRef.current = milestoneTier;
    }, [milestoneTier, prefersReducedMotion]);

    return (
        <div className={cn('habit-flame-stage relative flex max-h-full max-w-full items-center justify-center', flameStateClass)}>
            <div className={cn('habit-flame-aura absolute inset-0 rounded-full', !prefersReducedMotion && 'animate-[habit-flame-aura_2200ms_ease-in-out_infinite]')} />
            {milestoneTier > 0 && (
                <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
                    <div className={cn(
                        'habit-milestone-glow absolute inset-[18%] rounded-full',
                        milestoneTier === 1 && 'habit-milestone-tier-1',
                        milestoneTier === 2 && 'habit-milestone-tier-2',
                        milestoneTier === 3 && 'habit-milestone-tier-3',
                        milestoneTier === 4 && 'habit-milestone-tier-4'
                    )} />
                    {!prefersReducedMotion && milestoneBurstTick > 0 && (
                        <div
                            key={`habit-milestone-burst-${milestoneBurstTick}`}
                            className={cn(
                                'habit-milestone-burst absolute inset-[10%] rounded-full',
                                milestoneTier === 1 && 'habit-milestone-burst-tier-1',
                                milestoneTier === 2 && 'habit-milestone-burst-tier-2',
                                milestoneTier === 3 && 'habit-milestone-burst-tier-3',
                                milestoneTier === 4 && 'habit-milestone-burst-tier-4'
                            )}
                        />
                    )}
                    {milestoneTier === 4 && (
                        <div className="habit-milestone-crown absolute inset-[2%] rounded-full animate-[habit-milestone-crown_1600ms_ease-in-out_infinite]" />
                    )}
                </div>
            )}
            <svg
                viewBox="0 0 24 24"
                className={cn('habit-flame-svg relative z-[2]', reactionClassName)}
                aria-hidden="true"
            >
                <g className="habit-flame-scale" style={{ transform: `scale(${flameScale})`, transformOrigin: '12px 22px' }}>
                    <g className={cn('habit-flame-motion', !prefersReducedMotion && 'animate-[habit-flame-sway_1900ms_ease-in-out_infinite]')}>
                        <path
                            className={cn('habit-flame-path habit-flame-path-main', !prefersReducedMotion && 'animate-[habit-flame-main_1650ms_ease-in-out_infinite]')}
                            d="M17.55 7.17c-.29-.19-.65-.22-.97-.08-.31.14-.53.44-.58.78 0 .01-.08.57-.38 1.28-.06-.81-.27-1.69-.73-2.6-1.07-2.14-4.2-4.29-4.33-4.38a1 1 0 0 0-1.04-.04c-.33.18-.53.54-.52.92 0 .02.02 1.83-2.48 4.33C4.22 9.68 3 12.19 3 14.64 3 18.12 5.46 22 9 22c.38 0 .73-.21.89-.55s.13-.74-.09-1.05c-1.2-1.6-1.04-3.09-.55-4.21C9.95 19.75 12.09 22 15 22s6-1.96 6-7.5c0-4.98-3.31-7.24-3.45-7.33Z"
                            fill="var(--habit-flame-solid-active)"
                        />
                        <path
                            className={cn('habit-flame-path habit-flame-path-main', !prefersReducedMotion && 'animate-[habit-flame-main_1650ms_ease-in-out_infinite]')}
                            d="M15 20c-2.39 0-4-2.61-4-6.5 0-.39-.23-.75-.59-.91a1 1 0 0 0-.41-.09c-.24 0-.47.08-.66.25-1.28 1.12-2.99 3.64-2.3 6.49-1.23-1.02-2.05-2.9-2.05-4.59 0-1.9 1.02-3.93 2.94-5.85 1.59-1.59 2.36-2.99 2.73-4.03.91.76 1.99 1.78 2.44 2.69.72 1.43.71 2.87-.03 4.66-.16.39-.06.85.26 1.13s.78.33 1.15.12c1.65-.93 2.53-2.36 3-3.49.71.9 1.51 2.42 1.51 4.62 0 5.1-3.06 5.5-4 5.5Z"
                            fill="var(--habit-flame-solid-active)"
                        />
                    </g>
                </g>
            </svg>
            {!prefersReducedMotion && hasTriggeredReaction && (
                <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden="true">
                    {FLAME_PARTICLES.map((particle, index) => (
                        <span
                            key={`flame-particle-${index}-${reactionTick}`}
                            className={cn(
                                'habit-flame-particle absolute left-1/2 top-[66%]',
                                reactionTick % 2 === 0 ? 'habit-particle-burst-a' : 'habit-particle-burst-b'
                            )}
                            style={{
                                '--particle-ox': particle.ox,
                                '--particle-oy': particle.oy,
                                '--particle-dx1': particle.dx1,
                                '--particle-dy1': particle.dy1,
                                '--particle-dx2': particle.dx2,
                                '--particle-dy2': particle.dy2,
                                '--particle-size': particle.size,
                                '--particle-delay': particle.delay,
                                '--particle-duration': particle.duration,
                                '--particle-color': particle.color,
                            } as React.CSSProperties}
                        />
                    ))}
                </div>
            )}
            <div className="absolute bottom-1 z-[3] inline-flex items-center rounded-full bg-white/62 px-2 py-0.5 text-xs font-semibold text-foreground/95 shadow-[0_6px_16px_rgba(15,23,42,0.16)] backdrop-blur-md dark:bg-black/60 dark:text-white/95">
                {streakCount}/{targetStreak} streak
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

    const streakHeat = Math.min(1, habitSettings.streakCount / 14);
    const buttonLabel = checkInState.canCheckIn
        ? 'Check In'
        : `Wait ${formatRemainingTime(checkInState.remainingMs)}`;
    const habitTitle = habitSettings.habitName.trim().length > 0
        ? habitSettings.habitName
        : 'Habit task (e.g. Review notes for 30 mins)';
    const targetProgress = Math.min(100, Math.round((habitSettings.streakCount / habitSettings.targetStreak) * 100));
    const progressHeat = Math.min(1, targetProgress / 100);
    const flameScale = 1 + streakHeat * 0.14 + progressHeat * 0.12;

    return (
        <div className="habit-streak-widget relative h-full overflow-hidden p-2.5 text-foreground shadow-[0_14px_30px_rgba(236,114,41,0.22)] dark:shadow-[0_20px_40px_rgba(77,24,8,0.56)] sm:p-3">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-16 -left-12 h-40 w-40 rounded-full bg-amber-300/46 blur-3xl dark:bg-amber-300/24" />
                <div className="absolute -right-16 bottom-[-4rem] h-48 w-48 rounded-full bg-orange-300/38 blur-3xl dark:bg-red-400/20" />
                <div className="absolute top-1/3 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-yellow-200/35 blur-2xl dark:bg-orange-300/16" />
            </div>
            <div className="relative flex h-full min-h-0 flex-col gap-1.5 sm:gap-2">
                <div className="grid gap-1">
                    <h3 className={cn(
                        'line-clamp-2 px-1 text-sm font-semibold leading-tight sm:text-base md:text-lg',
                        habitSettings.habitName.trim().length > 0 ? 'text-foreground' : 'text-foreground/65'
                    )}>
                        {habitTitle}
                    </h3>
                    <div className="grid gap-1 px-1">
                        <div className="flex items-center justify-between text-[11px] text-foreground/80 dark:text-foreground/95">
                            <span>Goal</span>
                            <span>{habitSettings.streakCount}/{habitSettings.targetStreak}</span>
                        </div>
                        <Progress
                            value={targetProgress}
                            aria-label="Target streak progress"
                            className="h-1.5 bg-white/45 dark:bg-black/28 [&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-[#ffbf3c] [&>[data-slot=progress-indicator]]:via-[#ff7a22] [&>[data-slot=progress-indicator]]:to-[#e8452f] [&>[data-slot=progress-indicator]]:transition-transform [&>[data-slot=progress-indicator]]:duration-500 [&>[data-slot=progress-indicator]]:ease-out"
                        />
                    </div>
                </div>

                <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-0.5 sm:px-1">
                    <HabitFlame
                        flameScale={flameScale}
                        prefersReducedMotion={prefersReducedMotion}
                        streakCount={habitSettings.streakCount}
                        targetStreak={habitSettings.targetStreak}
                        targetProgress={targetProgress}
                        reactionSignal={flameReactionSignal}
                    />
                </div>

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
                    --habit-aura-gradient: radial-gradient(circle at 50% 58%, rgba(255, 220, 145, 0.64), rgba(251, 146, 60, 0.34) 38%, rgba(244, 114, 54, 0.17) 64%, rgba(251, 191, 36, 0.08) 78%, transparent 86%);
                    --habit-flame-solid: #f35c2d;
                    --habit-flame-stage-size: 11.5rem;
                    --habit-flame-svg-size: 9.5rem;
                }
                .dark .habit-streak-widget {
                    background:
                        radial-gradient(128% 100% at 14% 10%, rgba(255, 172, 80, 0.32) 0%, rgba(255, 172, 80, 0) 52%),
                        radial-gradient(108% 86% at 88% 88%, rgba(255, 98, 64, 0.34) 0%, rgba(255, 98, 64, 0) 58%),
                        radial-gradient(72% 62% at 52% 58%, rgba(247, 151, 43, 0.2) 0%, rgba(247, 151, 43, 0) 66%),
                        linear-gradient(142deg, #2f1208 0%, #3e170b 46%, #4a1b10 100%);
                    --habit-aura-gradient: radial-gradient(circle at 50% 58%, rgba(251, 146, 60, 0.64), rgba(239, 68, 68, 0.5) 40%, rgba(194, 65, 12, 0.26) 68%, rgba(120, 53, 15, 0.1) 84%, transparent 92%);
                    --habit-flame-solid: #ff6e36;
                }
                .habit-flame-stage {
                    isolation: isolate;
                    --habit-flame-solid-active: var(--habit-flame-solid);
                    width: var(--habit-flame-stage-size);
                    height: var(--habit-flame-stage-size);
                }
                .habit-flame-aura {
                    background: var(--habit-aura-gradient);
                    filter: blur(1.2px) saturate(1);
                }
                .habit-flame-svg {
                    overflow: visible;
                    width: var(--habit-flame-svg-size);
                    height: var(--habit-flame-svg-size);
                    filter: drop-shadow(0 6px 12px rgba(251, 146, 60, 0.24));
                }
                .habit-flame-scale,
                .habit-flame-motion,
                .habit-flame-path {
                    will-change: transform, opacity;
                }
                .habit-flame-path-main {
                    opacity: 1;
                }
                .habit-flame-state-1 {
                    --habit-flame-solid-active: #f97935;
                }
                .habit-flame-state-2 {
                    --habit-flame-solid-active: #f9682c;
                }
                .habit-flame-state-2 .habit-flame-svg {
                    filter: drop-shadow(0 8px 14px rgba(251, 128, 56, 0.34));
                }
                .habit-flame-state-3 {
                    --habit-flame-solid-active: #f45827;
                }
                .habit-flame-state-3 .habit-flame-svg {
                    filter: drop-shadow(0 10px 16px rgba(245, 101, 44, 0.42));
                }
                .habit-flame-state-3 .habit-flame-aura {
                    filter: blur(1.6px) saturate(1.08);
                }
                .habit-flame-state-4 {
                    --habit-flame-solid-active: #ef4a22;
                }
                .habit-flame-state-4 .habit-flame-svg {
                    filter: drop-shadow(0 14px 22px rgba(245, 94, 45, 0.56));
                }
                .habit-flame-state-4 .habit-flame-aura {
                    filter: blur(1.9px) saturate(1.16);
                }
                .habit-milestone-glow {
                    filter: blur(10px);
                    opacity: 0.65;
                }
                .habit-milestone-tier-1 {
                    background: radial-gradient(circle, rgba(255, 220, 134, 0.52) 0%, rgba(255, 220, 134, 0) 72%);
                }
                .habit-milestone-tier-2 {
                    background: radial-gradient(circle, rgba(255, 174, 96, 0.58) 0%, rgba(255, 174, 96, 0) 72%);
                }
                .habit-milestone-tier-3 {
                    background: radial-gradient(circle, rgba(255, 122, 84, 0.66) 0%, rgba(255, 122, 84, 0) 74%);
                }
                .habit-milestone-tier-4 {
                    background: radial-gradient(circle, rgba(255, 100, 68, 0.8) 0%, rgba(255, 100, 68, 0) 78%);
                }
                .habit-milestone-burst {
                    border-width: 1px;
                    transform: scale(0.56);
                    opacity: 0;
                    animation: habit-milestone-burst 860ms cubic-bezier(0.22, 1, 0.36, 1) 1;
                }
                .habit-milestone-burst-tier-1 {
                    border-color: rgba(255, 212, 112, 0.7);
                    box-shadow: 0 0 18px rgba(255, 196, 104, 0.42);
                }
                .habit-milestone-burst-tier-2 {
                    border-color: rgba(255, 156, 82, 0.72);
                    box-shadow: 0 0 20px rgba(255, 128, 59, 0.46);
                }
                .habit-milestone-burst-tier-3 {
                    border-color: rgba(255, 124, 84, 0.76);
                    box-shadow: 0 0 22px rgba(255, 96, 59, 0.52);
                }
                .habit-milestone-burst-tier-4 {
                    border-color: rgba(255, 98, 68, 0.82);
                    box-shadow: 0 0 26px rgba(255, 82, 50, 0.56);
                    animation: habit-milestone-burst-strong 1000ms cubic-bezier(0.22, 1, 0.36, 1) 1;
                }
                .habit-milestone-crown {
                    border: 2px solid rgba(255, 146, 106, 0.72);
                    box-shadow: 0 0 0 2px rgba(255, 122, 80, 0.22), 0 0 24px rgba(255, 98, 62, 0.42);
                    background: radial-gradient(circle, rgba(255, 194, 150, 0.16) 18%, rgba(255, 118, 76, 0.05) 56%, rgba(255, 90, 58, 0) 76%);
                }
                .habit-flame-particle {
                    display: block;
                    width: var(--particle-size);
                    height: var(--particle-size);
                    border-radius: 9999px;
                    background: var(--particle-color);
                    box-shadow: 0 0 8px rgba(255, 182, 104, 0.6);
                    opacity: 0;
                    transform: translate(calc(-50% + var(--particle-ox)), calc(-50% + var(--particle-oy))) scale(0.26) rotate(0deg);
                    will-change: transform, opacity;
                }
                .habit-particle-burst-a {
                    animation-name: habit-particle-a;
                    animation-duration: var(--particle-duration);
                    animation-delay: var(--particle-delay);
                    animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
                    animation-fill-mode: both;
                }
                .habit-particle-burst-b {
                    animation-name: habit-particle-b;
                    animation-duration: var(--particle-duration);
                    animation-delay: var(--particle-delay);
                    animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
                    animation-fill-mode: both;
                }
                @keyframes habit-flame-sway {
                    0%, 100% { transform: rotate(-2.8deg) translateY(1px); }
                    50% { transform: rotate(2.8deg) translateY(-2px); }
                }
                @keyframes habit-flame-main {
                    0%, 100% { transform: scale(0.97, 0.95); }
                    42% { transform: scale(1.03, 1.05); }
                    76% { transform: scale(0.99, 0.98); }
                }
                @keyframes habit-reaction-a {
                    0% { transform: scale(1); filter: drop-shadow(0 6px 12px rgba(251, 146, 60, 0.24)); }
                    35% { transform: scale(1.1) rotate(-2deg); filter: drop-shadow(0 12px 24px rgba(251, 146, 60, 0.5)); }
                    100% { transform: scale(1); filter: drop-shadow(0 6px 12px rgba(251, 146, 60, 0.24)); }
                }
                @keyframes habit-reaction-b {
                    0% { transform: scale(1); filter: drop-shadow(0 6px 12px rgba(251, 146, 60, 0.24)); }
                    35% { transform: scale(1.1) rotate(2deg); filter: drop-shadow(0 12px 24px rgba(251, 146, 60, 0.5)); }
                    100% { transform: scale(1); filter: drop-shadow(0 6px 12px rgba(251, 146, 60, 0.24)); }
                }
                @keyframes habit-flame-aura {
                    0%, 100% { opacity: 0.62; transform: scale(0.95); }
                    50% { opacity: 0.94; transform: scale(1.05); }
                }
                @keyframes habit-milestone-burst {
                    0% { transform: scale(0.56); opacity: 0; }
                    16% { opacity: 0.9; }
                    100% { transform: scale(1.2); opacity: 0; }
                }
                @keyframes habit-milestone-burst-strong {
                    0% { transform: scale(0.46); opacity: 0; }
                    14% { opacity: 1; }
                    100% { transform: scale(1.42); opacity: 0; }
                }
                @keyframes habit-milestone-crown {
                    0%, 100% { transform: scale(0.96); opacity: 0.68; }
                    50% { transform: scale(1.03); opacity: 0.96; }
                }
                @keyframes habit-particle-a {
                    0% { opacity: 0; transform: translate(calc(-50% + var(--particle-ox)), calc(-50% + var(--particle-oy))) scale(0.22); }
                    16% { opacity: 1; }
                    58% { opacity: 0.9; transform: translate(calc(-50% + var(--particle-ox) + var(--particle-dx1)), calc(-50% + var(--particle-oy) + var(--particle-dy1))) scale(1); }
                    100% { opacity: 0; transform: translate(calc(-50% + var(--particle-ox) + var(--particle-dx2)), calc(-50% + var(--particle-oy) + var(--particle-dy2))) scale(0.76); }
                }
                @keyframes habit-particle-b {
                    0% { opacity: 0; transform: translate(calc(-50% + var(--particle-ox)), calc(-50% + var(--particle-oy))) scale(0.26); }
                    20% { opacity: 1; }
                    56% { opacity: 0.86; transform: translate(calc(-50% + var(--particle-ox) + var(--particle-dx1)), calc(-50% + var(--particle-oy) + var(--particle-dy1))) scale(0.95); }
                    100% { opacity: 0; transform: translate(calc(-50% + var(--particle-ox) + var(--particle-dx2)), calc(-50% + var(--particle-oy) + var(--particle-dy2))) scale(0.7); }
                }
                @container (max-width: 300px), (max-height: 300px) {
                    .habit-streak-widget {
                        --habit-flame-stage-size: 9.25rem;
                        --habit-flame-svg-size: 7.5rem;
                    }
                }
                @container (max-width: 240px), (max-height: 240px) {
                    .habit-streak-widget {
                        --habit-flame-stage-size: 7.5rem;
                        --habit-flame-svg-size: 6rem;
                    }
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
