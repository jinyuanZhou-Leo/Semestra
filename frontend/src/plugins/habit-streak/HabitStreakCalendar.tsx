// input:  [calendar-mode habit streak values, local-date history, shared burst helpers, and reduced-motion preference]
// output: [`HabitStreakCalendar` component for the Duolingo-style board mode]
// pos:    [calendar-mode visual surface with cell-targeted check-in feedback and milestone celebration overlays]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame } from 'lucide-react';
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
        <div className="relative flex w-full flex-col items-center justify-center gap-3">
            <AnimatePresence>
                {milestoneBursts.map((burst) => (
                    <MilestoneBurstLayer key={burst.id} burst={burst} prefersReducedMotion={prefersReducedMotion} />
                ))}
            </AnimatePresence>

            <div className="w-full">
                <div className="mb-2.5 flex items-center justify-end whitespace-nowrap px-1">
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
                            <Flame aria-hidden="true" className="h-3.5 w-3.5" style={{ color: 'var(--habit-accent-fire)' }} />
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

                <div className="grid w-full grid-cols-7 gap-1 @[200px]:gap-1.5 @[300px]:gap-2" role="list" data-testid="habit-calendar-board">
                    {recentDayCells.map((day) => (
                        <motion.div
                            key={day.key}
                            role="listitem"
                            aria-label={`${new Date(`${day.key}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${day.isToday ? ', today' : ''}. ${day.isCompleted ? 'Checked in.' : 'Not checked in.'}`}
                            data-testid={`habit-day-${day.key}`}
                            data-completed={day.isCompleted ? 'true' : 'false'}
                            data-today={day.isToday ? 'true' : 'false'}
                            data-feedback-target={day.isToday ? 'true' : 'false'}
                            className={cn(
                                'relative flex min-h-[72px] @[200px]:min-h-[84px] flex-col items-center justify-center gap-1 overflow-hidden rounded-xl px-1 py-2 @[200px]:py-2.5 text-center transition-transform duration-300',
                                day.isCompleted
                                    ? 'text-white'
                                    : 'bg-black/[0.04] text-stone-500 dark:bg-white/[0.05] dark:text-white/50',
                                day.isToday && 'scale-[1.02]',
                                day.isToday && !day.isCompleted && 'ring-1 ring-orange-400/40 dark:ring-orange-300/25',
                            )}
                            style={day.isCompleted ? { background: 'linear-gradient(165deg, var(--habit-accent-warm), var(--habit-accent-hot))' } : undefined}
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
                                            className="absolute inset-[2px] rounded-[10px] ring-2 ring-[#ffd28d]/90"
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

                            <span className={cn(
                                'relative z-10 text-[0.6rem] font-semibold tracking-widest',
                                day.isCompleted ? 'text-white/60' : 'text-stone-400 dark:text-white/30'
                            )}>
                                {day.dayLabel}
                            </span>
                            <span className="relative z-10 text-[1.08rem] font-black leading-none tracking-tight">
                                {day.dayNumber}
                            </span>
                            <motion.span
                                className={cn(
                                    'relative z-10 h-[3px] w-3 rounded-full',
                                    day.isCompleted ? 'bg-white/40' : 'bg-transparent',
                                )}
                                animate={prefersReducedMotion || !day.isToday || reactionSignal === 0
                                    ? { scaleX: 1 }
                                    : { scaleX: [1, 1.4, 1] }}
                                transition={{ duration: 0.38, ease: 'easeOut' }}
                            />
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};
