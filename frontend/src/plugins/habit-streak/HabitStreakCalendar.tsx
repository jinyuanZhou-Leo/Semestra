// input:  [calendar-mode habit streak values, local-date history, shared burst helpers, and reduced-motion preference]
// output: [`HabitStreakCalendar` component for the Duolingo-style board mode]
// pos:    [calendar-mode visual surface with cell-targeted check-in feedback and milestone celebration overlays]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MilestoneBurstLayer, useStreakBursts } from './visuals';

export interface RecentDayCell {
    key: string;
    dayLabel: string;
    dayNumber: string;
    isToday: boolean;
    isCompleted: boolean;
}

interface HabitStreakCalendarProps {
    prefersReducedMotion: boolean;
    streakCount: number;
    recentDayCells: RecentDayCell[];
    targetProgress: number;
    reactionSignal: number;
}

export const HabitStreakCalendar: React.FC<HabitStreakCalendarProps> = ({
    prefersReducedMotion,
    streakCount,
    recentDayCells,
    targetProgress,
    reactionSignal,
}) => {
    const { milestoneBursts } = useStreakBursts(targetProgress, reactionSignal, prefersReducedMotion);

    return (
        <div className="relative flex w-full max-w-[286px] flex-col items-center justify-center gap-2.5">
            <AnimatePresence>
                {milestoneBursts.map((burst) => (
                    <MilestoneBurstLayer key={burst.id} burst={burst} prefersReducedMotion={prefersReducedMotion} />
                ))}
            </AnimatePresence>

            <div className="w-full">
                <div className="mb-2.5 flex items-center justify-between gap-3 whitespace-nowrap px-1">
                    <span className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-stone-500 dark:text-white/45">
                        Week
                    </span>
                    <motion.div
                        key={reactionSignal === 0 ? `idle-${streakCount}` : `react-${reactionSignal}-${streakCount}`}
                        className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-stone-600 dark:text-white/68"
                        initial={prefersReducedMotion ? false : { scale: 0.92, y: 2, opacity: 0.82 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                    >
                        <motion.div
                            animate={prefersReducedMotion || reactionSignal === 0
                                ? { rotate: 0, scale: 1 }
                                : { rotate: [0, -10, 12, 0], scale: [1, 1.18, 1] }}
                            transition={{ duration: 0.55, ease: 'easeOut' }}
                        >
                            <Flame className="h-3.5 w-3.5 text-[#ef7b2d]" />
                        </motion.div>
                        <motion.span
                            className="font-black text-stone-900 dark:text-white"
                            animate={prefersReducedMotion || reactionSignal === 0
                                ? { scale: 1 }
                                : { scale: [1, 1.16, 1] }}
                            transition={{ duration: 0.48, ease: 'easeOut' }}
                        >
                            {streakCount}d
                        </motion.span>
                    </motion.div>
                </div>

                <div className="grid w-full grid-cols-7 gap-1.5" data-testid="habit-calendar-board">
                    {recentDayCells.map((day) => (
                        <motion.div
                            key={day.key}
                            data-testid={`habit-day-${day.key}`}
                            data-completed={day.isCompleted ? 'true' : 'false'}
                            data-today={day.isToday ? 'true' : 'false'}
                            data-feedback-target={day.isToday ? 'true' : 'false'}
                            className={cn(
                                'relative flex min-h-[84px] flex-col items-center justify-between overflow-hidden rounded-[18px] px-1 py-2.5 text-center ring-1 transition-transform duration-300',
                                day.isCompleted
                                    ? 'bg-[linear-gradient(180deg,#ffbb52_0%,#ff8c40_50%,#e45433_100%)] text-white ring-transparent shadow-[0_10px_20px_rgba(232,73,45,0.2)]'
                                    : 'bg-white/84 text-stone-600 ring-black/6 dark:bg-white/6 dark:text-white/72 dark:ring-white/10',
                                day.isToday && 'scale-[1.02] ring-2 ring-[#ff8f2c] dark:ring-[#ffb14b]',
                            )}
                            initial={false}
                            animate={prefersReducedMotion || !day.isToday || reactionSignal === 0
                                ? { scale: day.isToday ? 1.02 : 1, y: 0 }
                                : { scale: [1.02, 1.09, 1.02], y: [0, -3, 0] }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                        >
                            {day.isToday && reactionSignal > 0 && !prefersReducedMotion ? (
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={`feedback-${reactionSignal}`}
                                        data-testid="habit-calendar-feedback"
                                        className="pointer-events-none absolute inset-0"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.3, ease: 'easeOut' }}
                                    >
                                        <motion.div
                                            className="absolute inset-[2px] rounded-[15px] ring-2 ring-[#ffd28d]/90"
                                            initial={{ opacity: 0, scale: 0.86 }}
                                            animate={{ opacity: [0, 1, 0], scale: [0.86, 1.06, 1.14] }}
                                            transition={{ duration: 0.62, ease: 'easeOut' }}
                                        />
                                        <motion.div
                                            className="absolute inset-y-0 left-[-45%] w-[55%] rotate-12 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.06)_25%,rgba(255,255,255,0.52)_50%,rgba(255,255,255,0.06)_75%,transparent_100%)]"
                                            initial={{ x: '0%', opacity: 0 }}
                                            animate={{ x: '240%', opacity: [0, 0.95, 0] }}
                                            transition={{ duration: 0.68, ease: 'easeOut' }}
                                        />
                                    </motion.div>
                                </AnimatePresence>
                            ) : null}

                            <span className={cn('relative z-10 text-[0.56rem] font-bold uppercase tracking-[0.18em]', day.isCompleted ? 'text-white/72' : 'text-stone-400 dark:text-white/45')}>
                                {day.dayLabel}
                            </span>
                            <span className="relative z-10 text-[1.08rem] font-black leading-none tracking-tight">
                                {day.dayNumber}
                            </span>
                            <motion.span
                                className={cn(
                                    'relative z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px]',
                                    day.isCompleted
                                        ? 'bg-white/22 text-white'
                                        : 'bg-stone-200 text-stone-400 dark:bg-white/10 dark:text-white/36',
                                )}
                                animate={prefersReducedMotion || !day.isToday || reactionSignal === 0
                                    ? { scale: 1 }
                                    : { scale: [1, 1.2, 1] }}
                                transition={{ duration: 0.38, ease: 'easeOut' }}
                            >
                                {day.isCompleted ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                            </motion.span>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};
