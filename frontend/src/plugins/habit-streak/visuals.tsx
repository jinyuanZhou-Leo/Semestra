// input:  [Framer Motion runtime, target-progress values, reaction ticks, and reduced-motion preference]
// output: [shared habit-streak burst types, milestone helpers, and reusable visual feedback primitives]
// pos:    [shared visual-feedback layer used by the habit-streak calendar and ring display components]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from 'react';
import { motion } from 'framer-motion';

export interface MilestoneBurstState {
    id: number;
    color: string;
    tier: number;
}

export interface ParticleSpec {
    id: number;
    x: number;
    y: number;
    duration: number;
    delay: number;
    sizeClass: string;
    scalePeak: number;
    glowBlur: number;
}

export interface BurstState {
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
        sizeClass: isMax ? 'h-2 w-2' : 'h-1.5 w-1.5',
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
        sizeClass: 'h-1 w-1',
        scalePeak: 1.4,
        glowBlur: 7,
    });
};

let burstSequence = 0;

const getNextBurstId = () => {
    burstSequence += 1;
    return burstSequence;
};

export const useStreakBursts = (
    targetProgress: number,
    reactionSignal: number,
    prefersReducedMotion: boolean
) => {
    const [bursts, setBursts] = React.useState<BurstState[]>([]);
    const [milestoneBursts, setMilestoneBursts] = React.useState<MilestoneBurstState[]>([]);
    const prevTierRef = React.useRef(getMilestoneTier(targetProgress));

    React.useEffect(() => {
        if (prefersReducedMotion || reactionSignal === 0) return;
        const burstId = getNextBurstId();
        const isOverachieve = targetProgress >= 100;
        const nextBurst: BurstState = {
            id: burstId,
            isOverachieve,
            overachieveParticles: isOverachieve ? buildOverachieveParticleSpecs(burstId) : undefined,
        };
        setBursts((prev) => [...prev, nextBurst].slice(-3));
    }, [reactionSignal, targetProgress, prefersReducedMotion]);

    React.useEffect(() => {
        if (prefersReducedMotion) return;
        const currentTier = getMilestoneTier(targetProgress);
        if (currentTier > prevTierRef.current && currentTier > 0 && targetProgress > 0) {
            const colors = ['#fde047', '#fcd34d', '#fbbf24', '#f59e0b', '#f43f5e'];
            setMilestoneBursts((prev) => [...prev, { id: getNextBurstId(), color: colors[currentTier], tier: currentTier }].slice(-4));
        }
        prevTierRef.current = currentTier;
    }, [targetProgress, prefersReducedMotion]);

    return { bursts, milestoneBursts };
};

export const BurstParticles: React.FC<{
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
                transition={{ duration: particle.duration, delay: particle.delay, ease: 'easeOut' }}
            />
        ))}
    </>
);

export const MilestoneBurstLayer: React.FC<{
    burst: MilestoneBurstState;
    prefersReducedMotion: boolean;
}> = ({ burst, prefersReducedMotion }) => {
    const isMax = burst.tier === 4;
    const particleSpecs = React.useMemo(
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
                    transition={{ duration: 0.66, ease: 'easeOut' }}
                />
            )}
            <BurstParticles particles={particleSpecs} color={burst.color} prefersReducedMotion={prefersReducedMotion} />
        </div>
    );
};
