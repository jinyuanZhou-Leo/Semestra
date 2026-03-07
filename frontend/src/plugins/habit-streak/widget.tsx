// input:  [widget settings/update callbacks, framer-motion animation runtime, shadcn form controls/dialog actions]
// output: [habit-streak widget component, settings component, helpers, and widget definition metadata]
// pos:    [plugin runtime + settings layer for interval-based habit check-ins with preset cadence controls, real recent-history tracking, switchable Duolingo-card/classic-ring visuals, ring-only encouragement toast behavior, shadowless check-in CTA styling, and reusable burst animations]
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
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Check, Flame, RotateCcw, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * HOUR_IN_MS;
const INTERVAL_OPTIONS = [
    { value: 0, label: 'No interval' },
    { value: 24, label: 'Every day' },
    { value: 168, label: 'Every week' },
] as const;
const ALLOWED_INTERVAL_HOURS = INTERVAL_OPTIONS.map((option) => option.value);
const MIN_TARGET_STREAK = 1;
const DISPLAY_STYLE_OPTIONS = [
    { value: 'calendar', label: 'Duolingo Style' },
    { value: 'ring', label: 'Ring' },
] as const;
type HabitStreakDisplayStyle = typeof DISPLAY_STYLE_OPTIONS[number]['value'];
interface HabitStreakSettings {
    habitName: string;
    checkInIntervalHours: number;
    targetStreak: number;
    streakCount: number;
    bestStreak: number;
    totalCheckIns: number;
    lastCheckInAt: string | null;
    checkInHistory: string[];
    displayStyle: HabitStreakDisplayStyle;
    showMotivationalMessage: boolean;
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
    checkInHistory: [],
    displayStyle: 'calendar',
    showMotivationalMessage: true,
};

const HISTORY_RETENTION_DAYS = 90;
const LOCAL_DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// ─── Motivational messages ────────────────────────────────────────────────────
type MessageTemplate = (n: number) => string;

const MOTIVATIONAL_MESSAGES: { streakMin: number; templates: MessageTemplate[] }[] = [
    {
        streakMin: 0,
        templates: [
            (n) => `Streak #${n}. Every streak starts here.`,
            (n) => `Check-in ${n} done. You showed up.`,
            (n) => `Streak #${n} - the hardest part is beginning.`,
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
    const tier = tiers.find((t) => streakCount >= t.streakMin) ?? MOTIVATIONAL_MESSAGES[0];
    const pool = tier.templates;
    return pool[Math.floor(Math.random() * pool.length)](streakCount);
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
    return Math.max(MIN_TARGET_STREAK, rounded);
};

const clampDisplayStyle = (value: unknown): HabitStreakDisplayStyle => {
    if (typeof value !== 'string') return DEFAULT_HABIT_STREAK_SETTINGS.displayStyle;
    return DISPLAY_STYLE_OPTIONS.some((option) => option.value === value)
        ? value as HabitStreakDisplayStyle
        : DEFAULT_HABIT_STREAK_SETTINGS.displayStyle;
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

export const normalizeHabitStreakSettings = (settings: unknown): HabitStreakSettings => {
    if (!settings || typeof settings !== 'object') {
        return DEFAULT_HABIT_STREAK_SETTINGS;
    }

    const source = settings as Partial<HabitStreakSettings>;
    const parsedLastCheckInAt = typeof source.lastCheckInAt === 'string' ? Date.parse(source.lastCheckInAt) : NaN;
    const nowMs = Date.now();

    return {
        habitName: typeof source.habitName === 'string' ? source.habitName : DEFAULT_HABIT_STREAK_SETTINGS.habitName,
        checkInIntervalHours: clampIntervalHours(source.checkInIntervalHours),
        targetStreak: clampTargetStreak(source.targetStreak),
        streakCount: Number.isFinite(source.streakCount) ? Math.max(0, Math.round(source.streakCount as number)) : 0,
        bestStreak: Number.isFinite(source.bestStreak) ? Math.max(0, Math.round(source.bestStreak as number)) : 0,
        totalCheckIns: Number.isFinite(source.totalCheckIns) ? Math.max(0, Math.round(source.totalCheckIns as number)) : 0,
        lastCheckInAt: Number.isNaN(parsedLastCheckInAt) ? null : new Date(parsedLastCheckInAt).toISOString(),
        checkInHistory: normalizeCheckInHistory(source.checkInHistory, nowMs),
        displayStyle: clampDisplayStyle(source.displayStyle),
        showMotivationalMessage: typeof source.showMotivationalMessage === 'boolean' ? source.showMotivationalMessage : DEFAULT_HABIT_STREAK_SETTINGS.showMotivationalMessage,
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
                        value={habitSettings.targetStreak}
                        onChange={(event) => updateSettings({ targetStreak: clampTargetStreak(event.target.value) })}
                    />
                </div>
            </div>

            <div className="grid gap-2">
                <Label htmlFor={`${ids}-display-style`}>Display style</Label>
                <Select
                    value={habitSettings.displayStyle}
                    onValueChange={(value) => updateSettings({ displayStyle: clampDisplayStyle(value) })}
                >
                    <SelectTrigger id={`${ids}-display-style`} className="w-full">
                        <SelectValue placeholder="Select display style" />
                    </SelectTrigger>
                    <SelectContent>
                        {DISPLAY_STYLE_OPTIONS.map((option) => (
                            <SelectItem key={`habit-display-style-${option.value}`} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Motivational message toggle */}
            <div className="flex items-center justify-between gap-4 pt-2">
                <div className="grid gap-0.5">
                    <Label htmlFor={`${ids}-motivational-msg`} className="cursor-pointer text-sm font-medium">
                        Encouragement on check-in
                    </Label>
                    <p className="text-xs text-muted-foreground">
                        {habitSettings.displayStyle === 'calendar'
                            ? 'Hidden in Duolingo calendar view, preserved for classic ring.'
                            : 'Show a motivational message each time you check in.'}
                    </p>
                </div>
                <Switch
                    id={`${ids}-motivational-msg`}
                    checked={habitSettings.showMotivationalMessage}
                    onCheckedChange={(checked) => updateSettings({ showMotivationalMessage: checked })}
                />
            </div>
        </div>
    );
};

interface HabitStreakCardProps {
    prefersReducedMotion: boolean;
    nowMs: number;
    streakCount: number;
    checkInHistory: string[];
    targetProgress: number;
    reactionSignal: number;
}

interface HabitRingProps {
    prefersReducedMotion: boolean;
    streakCount: number;
    targetProgress: number;
    reactionSignal: number;
}

interface MilestoneBurstState {
    id: number;
    color: string;
    tier: number;
}

interface ParticleSpec {
    id: number;
    x: number;
    y: number;
    duration: number;
    delay: number;
    sizeClass: string;
    scalePeak: number;
    glowBlur: number;
}

interface BurstState {
    id: number;
    isOverachieve?: boolean;
    overachieveParticles?: ParticleSpec[];
}

interface ParticlePlan {
    count: number;
    angleJitterDeg: number;
    distanceMin: number;
    distanceMax: number;
    durationMin: number;
    durationMax: number;
    delayMax: number;
    sizeClass: string;
    scalePeak: number;
    glowBlur: number;
}

const getMilestoneTier = (progress: number): 0 | 1 | 2 | 3 | 4 => {
    if (progress >= 100) return 4;
    if (progress >= 75) return 3;
    if (progress >= 50) return 2;
    if (progress >= 25) return 1;
    return 0;
};

const createSeededRandom = (seed: number) => {
    let state = Math.abs(seed % 2147483647) || 1;
    return () => {
        state = (state * 16807) % 2147483647;
        return (state - 1) / 2147483646;
    };
};

const buildParticleSpecs = (seed: number, plan: ParticlePlan): ParticleSpec[] => {
    const random = createSeededRandom(seed);
    return Array.from({ length: plan.count }, (_, index) => {
        const angle = (index * (360 / plan.count) + (random() * plan.angleJitterDeg - plan.angleJitterDeg / 2)) * (Math.PI / 180);
        const distance = plan.distanceMin + random() * (plan.distanceMax - plan.distanceMin);
        return {
            id: index,
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            duration: plan.durationMin + random() * (plan.durationMax - plan.durationMin),
            delay: random() * plan.delayMax,
            sizeClass: plan.sizeClass,
            scalePeak: plan.scalePeak,
            glowBlur: plan.glowBlur,
        };
    });
};

const buildMilestoneParticleSpecs = (seed: number, isMax: boolean): ParticleSpec[] => {
    return buildParticleSpecs(seed, {
        count: isMax ? 24 : 12,
        angleJitterDeg: 10,
        distanceMin: isMax ? 74 : 54,
        distanceMax: isMax ? 98 : 74,
        durationMin: isMax ? 0.82 : 0.58,
        durationMax: isMax ? 0.98 : 0.70,
        delayMax: 0.06,
        sizeClass: isMax ? "h-2 w-2" : "h-1.5 w-1.5",
        scalePeak: isMax ? 1.6 : 1.3,
        glowBlur: isMax ? 9 : 6,
    });
};

const buildOverachieveParticleSpecs = (seed: number): ParticleSpec[] => {
    return buildParticleSpecs(seed, {
        count: 8,
        angleJitterDeg: 14,
        distanceMin: 42,
        distanceMax: 58,
        durationMin: 0.5,
        durationMax: 0.64,
        delayMax: 0.05,
        sizeClass: "h-1 w-1",
        scalePeak: 1.4,
        glowBlur: 7,
    });
};

const BurstParticles: React.FC<{
    particles: ParticleSpec[];
    color: string;
    prefersReducedMotion: boolean;
}> = ({ particles, color, prefersReducedMotion }) => (
    <>
        {particles.map((particle) => (
            <motion.div
                key={particle.id}
                className={`absolute left-1/2 top-1/2 ${particle.sizeClass} -translate-x-1/2 -translate-y-1/2 rounded-full will-change-transform`}
                style={{ backgroundColor: color, boxShadow: `0 0 ${particle.glowBlur}px ${color}` }}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 1, x: 0, y: 0, scale: 0.6 }}
                animate={prefersReducedMotion ? { opacity: 0 } : {
                    opacity: [1, 0.85, 0],
                    x: particle.x,
                    y: particle.y,
                    scale: [1, particle.scalePeak, 0],
                }}
                transition={{ duration: particle.duration, delay: particle.delay, ease: "easeOut" }}
            />
        ))}
    </>
);

const MilestoneBurstLayer: React.FC<{
    burst: MilestoneBurstState;
    prefersReducedMotion: boolean;
}> = ({ burst, prefersReducedMotion }) => {
    const isMax = burst.tier === 4;
    const particleSpecs = useMemo(
        () => buildMilestoneParticleSpecs(burst.id, isMax),
        [burst.id, isMax]
    );

    return (
        <div className="pointer-events-none absolute inset-0 mix-blend-screen">
            {isMax && (
                <motion.div
                    className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px]"
                    style={{ borderColor: burst.color }}
                    initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.9, opacity: 0.95, borderWidth: '4px' }}
                    animate={prefersReducedMotion ? { opacity: 0 } : { scale: 2.4, opacity: 0, borderWidth: '0px' }}
                    transition={{ duration: 0.66, ease: "easeOut" }}
                />
            )}
            <BurstParticles particles={particleSpecs} color={burst.color} prefersReducedMotion={prefersReducedMotion} />
        </div>
    );
};

const useStreakBursts = (
    targetProgress: number,
    reactionSignal: number,
    prefersReducedMotion: boolean
) => {
    const [bursts, setBursts] = useState<BurstState[]>([]);
    const [milestoneBursts, setMilestoneBursts] = useState<MilestoneBurstState[]>([]);
    const prevTierRef = React.useRef(getMilestoneTier(targetProgress));

    useEffect(() => {
        if (prefersReducedMotion || reactionSignal === 0) return;
        const burstId = Date.now();
        const isOverachieve = targetProgress >= 100;
        const nextBurst: BurstState = {
            id: burstId,
            isOverachieve,
            overachieveParticles: isOverachieve ? buildOverachieveParticleSpecs(burstId) : undefined,
        };
        setBursts((prev) => [...prev, nextBurst].slice(-3));
    }, [reactionSignal, targetProgress, prefersReducedMotion]);

    useEffect(() => {
        if (prefersReducedMotion) return;
        const currentTier = getMilestoneTier(targetProgress);
        if (currentTier > prevTierRef.current && currentTier > 0 && targetProgress > 0) {
            const colors = ['#fde047', '#fcd34d', '#fbbf24', '#f59e0b', '#f43f5e'];
            setMilestoneBursts((prev) => [...prev, { id: Date.now(), color: colors[currentTier], tier: currentTier }].slice(-4));
        }
        prevTierRef.current = currentTier;
    }, [targetProgress, prefersReducedMotion]);

    return { bursts, milestoneBursts };
};

interface RecentDayCell {
    key: string;
    dayLabel: string;
    dayNumber: string;
    isToday: boolean;
    isCompleted: boolean;
}

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

const HabitStreakCard: React.FC<HabitStreakCardProps> = ({
    prefersReducedMotion,
    nowMs,
    streakCount,
    checkInHistory,
    targetProgress,
    reactionSignal,
}) => {
    const { bursts, milestoneBursts } = useStreakBursts(targetProgress, reactionSignal, prefersReducedMotion);
    const recentDayCells = useMemo(() => buildRecentDayCells(checkInHistory, nowMs), [checkInHistory, nowMs]);

    return (
        <div className="relative flex w-full max-w-[250px] flex-col items-center justify-center gap-4">
            <AnimatePresence>
                {bursts.map(burst => (
                    <div key={burst.id} className="pointer-events-none absolute left-1/2 top-12 h-28 w-28 -translate-x-1/2 -translate-y-1/2 mix-blend-screen">
                        <motion.div
                            className="absolute inset-0 rounded-full border-2"
                            style={{ borderColor: burst.isOverachieve ? 'rgba(244, 63, 94, 0.4)' : 'rgba(249, 115, 22, 0.5)' }}
                            initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.8, opacity: 1, borderWidth: '3px' }}
                            animate={prefersReducedMotion ? { opacity: 0 } : { scale: burst.isOverachieve ? 1.8 : 1.6, opacity: 0, borderWidth: '0px' }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                        {burst.isOverachieve && burst.overachieveParticles && (
                            <BurstParticles
                                particles={burst.overachieveParticles}
                                color="#f43f5e"
                                prefersReducedMotion={prefersReducedMotion}
                            />
                        )}
                    </div>
                ))}
            </AnimatePresence>

            <AnimatePresence>
                {milestoneBursts.map((burst) => (
                    <MilestoneBurstLayer key={burst.id} burst={burst} prefersReducedMotion={prefersReducedMotion} />
                ))}
            </AnimatePresence>

            <motion.div
                className="relative flex w-full max-w-[210px] items-center gap-3 rounded-[26px] px-4 py-3 text-white shadow-[0_18px_40px_rgba(242,109,44,0.26)]"
                style={{
                    background:
                        'linear-gradient(180deg, rgba(255,184,75,0.98) 0%, rgba(255,128,40,0.98) 48%, rgba(232,73,45,0.98) 100%)',
                }}
                initial={prefersReducedMotion ? false : { scale: 0.97, opacity: 0.96 }}
                animate={prefersReducedMotion ? { scale: 1, opacity: 1 } : { scale: [1, 1.02, 1], opacity: 1 }}
                transition={prefersReducedMotion ? { duration: 0.2 } : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            >
                <div className="absolute inset-x-5 top-0 h-px bg-white/45" />
                <div className="absolute -left-3 top-2 h-10 w-10 rounded-full bg-white/18 blur-2xl" />
                <motion.div
                    key={streakCount}
                    className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/18 ring-1 ring-white/35 backdrop-blur-[2px]"
                    initial={prefersReducedMotion ? false : { scale: 0.88, rotate: -8 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                >
                    <Flame className="h-8 w-8 fill-current text-white drop-shadow-[0_6px_12px_rgba(131,31,2,0.28)]" />
                </motion.div>
                <div className="grid min-w-0 gap-0.5">
                    <motion.span
                        key={`streak-count-${streakCount}`}
                        className="text-[clamp(1.8rem,12cqmin,2.6rem)] font-black leading-none tracking-[-0.06em]"
                        initial={prefersReducedMotion ? false : { scale: 1.1, opacity: 0.7 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                    >
                        {streakCount}
                    </motion.span>
                    <span className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-white/80">
                        Day Streak
                    </span>
                </div>
            </motion.div>

            <div className="grid w-full grid-cols-7 gap-1.5">
                {recentDayCells.map((day) => (
                    <div
                        key={day.key}
                        data-testid={`habit-day-${day.key}`}
                        data-completed={day.isCompleted ? 'true' : 'false'}
                        data-today={day.isToday ? 'true' : 'false'}
                        className={cn(
                            'relative flex min-h-[72px] flex-col items-center justify-between rounded-[18px] px-1.5 py-2 text-center ring-1 transition-transform duration-300',
                            day.isCompleted
                                ? 'bg-[linear-gradient(180deg,#ffb84b_0%,#ff7f3a_52%,#e54a2e_100%)] text-white ring-transparent shadow-[0_10px_24px_rgba(232,73,45,0.22)]'
                                : 'bg-white/72 text-stone-600 ring-black/6 dark:bg-white/8 dark:text-white/72 dark:ring-white/10',
                            day.isToday && 'scale-[1.03] ring-2 ring-[#ff8f2c] dark:ring-[#ffb14b]',
                        )}
                    >
                        {day.isToday && (
                            <div className="pointer-events-none absolute inset-x-2 -top-1 h-3 rounded-full bg-[#ffb55d]/70 blur-md dark:bg-[#ff9f57]/55" />
                        )}
                        <span className={cn('text-[0.6rem] font-bold uppercase tracking-[0.18em]', day.isCompleted ? 'text-white/72' : 'text-stone-400 dark:text-white/45')}>
                            {day.dayLabel}
                        </span>
                        <span className="text-base font-black leading-none tracking-tight">
                            {day.dayNumber}
                        </span>
                        <span
                            className={cn(
                                'flex h-5 w-5 items-center justify-center rounded-full text-[10px]',
                                day.isCompleted
                                    ? 'bg-white/22 text-white'
                                    : 'bg-stone-200 text-stone-400 dark:bg-white/10 dark:text-white/36',
                            )}
                        >
                            {day.isCompleted ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const HabitRing: React.FC<HabitRingProps> = ({ prefersReducedMotion, streakCount, targetProgress, reactionSignal }) => {
    const { bursts, milestoneBursts } = useStreakBursts(targetProgress, reactionSignal, prefersReducedMotion);
    const gradientId = useId().replace(/:/g, '-');
    const circumference = 2 * Math.PI * 46;
    const strokeDashoffset = circumference - (targetProgress / 100) * circumference;

    return (
        <div className="relative flex aspect-square h-full max-h-[160px] min-h-[70px] items-center justify-center" data-testid="habit-display-ring">
            <motion.svg
                className="absolute inset-0 h-full w-full transform"
                viewBox="0 0 100 100"
                initial={{ rotate: -90, scale: 1 }}
                animate={prefersReducedMotion ? { rotate: -90, scale: 1 } : { rotate: [-90, -88.8, -90.8, -90], scale: [1, 1.012, 1] }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 6.6, repeat: Infinity, ease: 'easeInOut' }}
            >
                <circle
                    cx="50"
                    cy="50"
                    r="46"
                    strokeWidth="4.5"
                    fill="none"
                    style={{ stroke: 'var(--habit-ring-track)' }}
                />
                <motion.circle
                    cx="50"
                    cy="50"
                    r="46"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    fill="none"
                    initial={prefersReducedMotion ? { strokeDashoffset } : { strokeDashoffset: circumference }}
                    animate={prefersReducedMotion ? { strokeDashoffset } : { strokeDashoffset, opacity: [0.9, 1, 0.9] }}
                    transition={prefersReducedMotion
                        ? { duration: 1.2, ease: [0.16, 1, 0.3, 1] }
                        : {
                            strokeDashoffset: { duration: 1.2, ease: [0.16, 1, 0.3, 1] },
                            opacity: { duration: 2.3, repeat: Infinity, ease: 'easeInOut' },
                        }}
                    strokeDasharray={circumference}
                />
                <motion.g
                    animate={prefersReducedMotion ? { rotate: 0 } : { rotate: 360 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 9, repeat: Infinity, ease: 'linear' }}
                    style={{ transformOrigin: '50% 50%' }}
                >
                    <circle
                        cx="50"
                        cy="50"
                        r="46"
                        strokeWidth="1.15"
                        fill="none"
                        stroke="rgba(255,255,255,0.4)"
                        strokeDasharray="6 26"
                        strokeLinecap="round"
                        opacity={0.28}
                    />
                </motion.g>
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#facc15" />
                        <stop offset="50%" stopColor="#f97316" />
                        <stop offset="100%" stopColor="#f43f5e" />
                    </linearGradient>
                </defs>
            </motion.svg>

            <AnimatePresence>
                {bursts.map((burst) => (
                    <div key={burst.id} className="pointer-events-none absolute inset-0 mix-blend-screen">
                        <motion.div
                            className="absolute inset-0 rounded-full border-2"
                            style={{ borderColor: burst.isOverachieve ? 'rgba(244, 63, 94, 0.4)' : 'rgba(249, 115, 22, 0.5)' }}
                            initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.8, opacity: 1, borderWidth: '3px' }}
                            animate={prefersReducedMotion ? { opacity: 0 } : { scale: burst.isOverachieve ? 1.8 : 1.6, opacity: 0, borderWidth: '0px' }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                        {burst.isOverachieve && burst.overachieveParticles && (
                            <BurstParticles
                                particles={burst.overachieveParticles}
                                color="#f43f5e"
                                prefersReducedMotion={prefersReducedMotion}
                            />
                        )}
                    </div>
                ))}
            </AnimatePresence>

            <AnimatePresence>
                {milestoneBursts.map((burst) => (
                    <MilestoneBurstLayer key={burst.id} burst={burst} prefersReducedMotion={prefersReducedMotion} />
                ))}
            </AnimatePresence>

            <div className="flex flex-col items-center justify-center -space-y-1">
                <motion.span
                    key={streakCount}
                    initial={prefersReducedMotion ? false : { scale: 1.15, opacity: 0.5 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="font-extrabold tracking-tighter drop-shadow-[0_1px_0_rgba(255,255,255,0.45)] dark:drop-shadow-none"
                    style={{
                        fontSize: 'clamp(1rem, 18cqmin, 2.5rem)',
                        lineHeight: 1,
                        color: 'var(--habit-ring-center-number)',
                    }}
                >
                    {streakCount}
                </motion.span>
                <span
                    className="mt-0 font-bold uppercase tracking-widest"
                    style={{
                        fontSize: 'clamp(0.45rem, 6cqmin, 0.6rem)',
                        color: 'var(--habit-ring-center-label)',
                    }}
                >
                    Streak
                </span>
            </div>
        </div>
    );
};

interface MotivationalToast {
    id: number;
    message: string;
}

const HabitStreakWidgetComponent: React.FC<WidgetProps> = ({ settings, updateSettings }) => {
    const habitSettings = normalizeHabitStreakSettings(settings);
    const [nowMs, setNowMs] = useState(() => Date.now());
    const [flameReactionSignal, setFlameReactionSignal] = useState(0);
    const [motivationalToast, setMotivationalToast] = useState<MotivationalToast | null>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const canShowMotivationalToast = habitSettings.displayStyle === 'ring' && habitSettings.showMotivationalMessage;

    const checkInState = useMemo(
        () => getCheckInWindowState(habitSettings.lastCheckInAt, habitSettings.checkInIntervalHours, nowMs),
        [habitSettings.lastCheckInAt, habitSettings.checkInIntervalHours, nowMs]
    );

    useEffect(() => {
        if (checkInState.canCheckIn) return;
        const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [checkInState.canCheckIn]);

    // Clean up toast timer on unmount
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

    const handleCheckIn = useCallback(() => {
        if (!checkInState.canCheckIn) return;

        const checkInAtMs = Date.now();
        const todayKey = getLocalDateKey(checkInAtMs);
        const nextStreakCount = computeNextStreakCount(
            habitSettings.streakCount,
            checkInState.windowsSinceLast,
            Boolean(habitSettings.lastCheckInAt)
        );
        const nextCheckInHistory = normalizeCheckInHistory(
            [...habitSettings.checkInHistory, todayKey],
            checkInAtMs
        );

        void updateSettings({
            ...habitSettings,
            streakCount: nextStreakCount,
            bestStreak: Math.max(habitSettings.bestStreak, nextStreakCount),
            totalCheckIns: habitSettings.totalCheckIns + 1,
            lastCheckInAt: new Date(checkInAtMs).toISOString(),
            checkInHistory: nextCheckInHistory,
        });

        setNowMs(checkInAtMs);
        setFlameReactionSignal((signal) => signal + 1);

        // Show motivational message if enabled
        if (canShowMotivationalToast) {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            setMotivationalToast({ id: checkInAtMs, message: getMotivationalMessage(nextStreakCount) });
            toastTimerRef.current = setTimeout(() => setMotivationalToast(null), 3800);
        }
    }, [canShowMotivationalToast, checkInState.canCheckIn, checkInState.windowsSinceLast, habitSettings, updateSettings]);

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
                            'line-clamp-2 text-sm font-bold tracking-tight text-stone-800 dark:text-foreground sm:text-base md:text-lg',
                            habitSettings.habitName.trim().length === 0 && 'text-stone-500 dark:text-foreground/60'
                        )}>
                            {habitTitle}
                        </h3>
                    </div>
                </div>

                {/* Streak Visualization */}
                <div className="flex min-h-0 flex-1 items-center justify-center">
                    {habitSettings.displayStyle === 'calendar' ? (
                        <HabitStreakCard
                            prefersReducedMotion={prefersReducedMotion}
                            nowMs={nowMs}
                            streakCount={habitSettings.streakCount}
                            checkInHistory={habitSettings.checkInHistory}
                            targetProgress={targetProgress}
                            reactionSignal={flameReactionSignal}
                        />
                    ) : (
                            <HabitRing
                                prefersReducedMotion={prefersReducedMotion}
                                streakCount={habitSettings.streakCount}
                                targetProgress={targetProgress}
                                reactionSignal={flameReactionSignal}
                            />
                    )}
                </div>

                {/* Check In Action */}
                <div className="mt-auto shrink-0 grid gap-2">
                    <Button
                        onClick={handleCheckIn}
                        disabled={!checkInState.canCheckIn}
                        className="group/habit-checkin relative h-10 w-full overflow-hidden border-0 bg-gradient-to-r from-[#ff9f1c] via-[#ff6b35] to-[#e5383b] text-sm font-semibold text-white shadow-none transition-all duration-300 ease-out hover:brightness-110 active:scale-[0.985] enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-[#8e6f53] disabled:text-white/80 disabled:shadow-none disabled:opacity-75"
                    >
                        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.22)_50%,transparent_75%)] opacity-0 transition-opacity duration-300 group-hover/habit-checkin:opacity-100" />
                        <Sparkles className={cn(
                            'relative mr-1.5 h-4 w-4 shrink-0 transition-transform duration-300 ease-out',
                            checkInState.canCheckIn && 'group-hover/habit-checkin:rotate-12 group-hover/habit-checkin:scale-110'
                        )} />
                        <span className="relative truncate">
                            {buttonLabel}
                        </span>
                    </Button>
                </div>

                {/* Motivational Message Toast */}
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
                                className="max-w-[95%] rounded-full px-3 py-1.5 text-center text-[10.5px] font-semibold leading-snug shadow-sm ring-1 ring-black/5 dark:ring-white/10"
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

            <style>{`
                .habit-streak-widget {
                    --habit-ring-track: color-mix(in srgb, var(--color-foreground) 16%, var(--color-background) 84%);
                    --habit-ring-center-number: color-mix(in srgb, var(--color-foreground) 96%, black 4%);
                    --habit-ring-center-label: color-mix(in srgb, var(--color-foreground) 70%, var(--color-background) 30%);
                    container-type: size;
                    background:
                        radial-gradient(120% 96% at 14% 10%, rgba(254, 243, 199, 0.4) 0%, rgba(254, 243, 199, 0) 52%),
                        radial-gradient(104% 82% at 90% 88%, rgba(255, 228, 230, 0.4) 0%, rgba(255, 228, 230, 0) 60%),
                        radial-gradient(70% 62% at 50% 56%, rgba(255, 237, 213, 0.3) 0%, rgba(255, 237, 213, 0) 68%),
                        linear-gradient(138deg, #ffffff 0%, #fafafa 44%, #f5f5f4 100%);
                }
                .dark .habit-streak-widget {
                    --habit-ring-track: color-mix(in srgb, var(--color-foreground) 24%, transparent);
                    --habit-ring-center-number: color-mix(in srgb, white 92%, var(--color-foreground) 8%);
                    --habit-ring-center-label: color-mix(in srgb, white 56%, transparent);
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
    component: HabitStreakWidget,
    SettingsComponent: HabitStreakSettingsComponent,
    defaultSettings: DEFAULT_HABIT_STREAK_SETTINGS,
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
                            checkInHistory: [],
                        });
                    }}
                />
            ),
        },
    ],
};
