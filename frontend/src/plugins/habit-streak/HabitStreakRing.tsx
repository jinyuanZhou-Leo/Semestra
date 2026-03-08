// input:  [ring-mode habit streak values, shared burst helpers, and reduced-motion preference]
// output: [`HabitStreakRing` component for the classic ring display mode]
// pos:    [ring-mode visual surface with orbit animation, shared burst overlays, and centered streak readout]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BurstParticles, MilestoneBurstLayer, useStreakBursts } from './visuals';

interface HabitStreakRingProps {
    prefersReducedMotion: boolean;
    streakCount: number;
    targetProgress: number;
    reactionSignal: number;
}

export const HabitStreakRing: React.FC<HabitStreakRingProps> = ({
    prefersReducedMotion,
    streakCount,
    targetProgress,
    reactionSignal,
}) => {
    const { bursts, milestoneBursts } = useStreakBursts(targetProgress, reactionSignal, prefersReducedMotion);
    const gradientId = React.useId().replace(/:/g, '-');
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
                        {burst.isOverachieve && burst.overachieveParticles ? (
                            <BurstParticles
                                particles={burst.overachieveParticles}
                                color="#f43f5e"
                                prefersReducedMotion={prefersReducedMotion}
                            />
                        ) : null}
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
