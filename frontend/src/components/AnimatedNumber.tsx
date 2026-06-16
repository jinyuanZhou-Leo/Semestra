// input:  [target numeric value, optional formatter/animation props, calligraph number variant, motion preference]
// output: [`AnimatedNumber` component]
// pos:    [Reusable metric value animator used in cards and progress summaries with calligraph digit transitions]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calligraph } from 'calligraph';
import type { CalligraphProps } from 'calligraph';

interface AnimatedNumberProps {
    value: number;
    format?: (value: number) => string;
    duration?: number;
    className?: string;
    style?: React.CSSProperties;
    animateOnMount?: boolean;
    rainbowThreshold?: number;
    rainbowStartDelayMs?: number;
    rainbowDurationMs?: number;
    rainbowFadeOutMs?: number;
}

const durationToAnimation = (duration: number): NonNullable<CalligraphProps['animation']> => {
    if (duration <= 400) {
        return 'snappy';
    }
    if (duration <= 700) {
        return 'smooth';
    }
    return 'bouncy';
};

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
    value,
    format,
    duration = 820,
    className = '',
    style,
    animateOnMount = true,
    rainbowThreshold,
    rainbowStartDelayMs = 280,
    rainbowDurationMs = 5000,
    rainbowFadeOutMs = 1200
}) => {
    const [rainbowState, setRainbowState] = useState<'hidden' | 'running' | 'fading'>('hidden');
    const rainbowStartTimeoutRef = useRef<number | null>(null);
    const rainbowStopTimeoutRef = useRef<number | null>(null);
    const rainbowHideTimeoutRef = useRef<number | null>(null);
    const animationGenerationRef = useRef(0);
    const hasSeededMountAnimationRef = useRef(false);

    const prefersReducedMotion = useMemo(() => {
        if (typeof window === 'undefined' || !('matchMedia' in window)) return false;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }, []);

    const renderValue = useCallback((nextValue: number) => {
        return format ? format(nextValue) : nextValue.toString();
    }, [format]);

    const formattedValue = useMemo(() => renderValue(value), [renderValue, value]);

    const [displayText, setDisplayText] = useState(() => {
        if (!Number.isFinite(value)) {
            return formattedValue;
        }
        if (!animateOnMount || prefersReducedMotion) {
            return formattedValue;
        }
        return renderValue(0);
    });

    const clearRainbowTimers = useCallback(() => {
        if (rainbowStartTimeoutRef.current) {
            window.clearTimeout(rainbowStartTimeoutRef.current);
            rainbowStartTimeoutRef.current = null;
        }
        if (rainbowStopTimeoutRef.current) {
            window.clearTimeout(rainbowStopTimeoutRef.current);
            rainbowStopTimeoutRef.current = null;
        }
        if (rainbowHideTimeoutRef.current) {
            window.clearTimeout(rainbowHideTimeoutRef.current);
            rainbowHideTimeoutRef.current = null;
        }
    }, []);

    const triggerRainbowMarquee = useCallback((generation: number) => {
        if (prefersReducedMotion || rainbowDurationMs <= 0) return;

        const startRunning = () => {
            if (animationGenerationRef.current !== generation) return;
            setRainbowState('running');
            rainbowStopTimeoutRef.current = window.setTimeout(() => {
                setRainbowState('fading');
                rainbowHideTimeoutRef.current = window.setTimeout(() => {
                    setRainbowState('hidden');
                    rainbowHideTimeoutRef.current = null;
                }, rainbowFadeOutMs);
                rainbowStopTimeoutRef.current = null;
            }, rainbowDurationMs);
        };

        if (rainbowStartDelayMs > 0) {
            rainbowStartTimeoutRef.current = window.setTimeout(() => {
                rainbowStartTimeoutRef.current = null;
                startRunning();
            }, rainbowStartDelayMs);
            return;
        }

        startRunning();
    }, [prefersReducedMotion, rainbowDurationMs, rainbowFadeOutMs, rainbowStartDelayMs]);

    const maybeTriggerRainbow = useCallback((generation: number) => {
        if (typeof rainbowThreshold === 'number' && value >= rainbowThreshold) {
            triggerRainbowMarquee(generation);
        }
    }, [rainbowThreshold, triggerRainbowMarquee, value]);

    useEffect(() => {
        const currentGeneration = animationGenerationRef.current + 1;
        animationGenerationRef.current = currentGeneration;
        clearRainbowTimers();
        setRainbowState('hidden');

        if (!Number.isFinite(value)) {
            setDisplayText(formattedValue);
            return () => {};
        }

        if (!hasSeededMountAnimationRef.current) {
            hasSeededMountAnimationRef.current = true;
            if (animateOnMount && !prefersReducedMotion) {
                setDisplayText(formattedValue);
                return () => {};
            }
        }

        setDisplayText(formattedValue);

        if (prefersReducedMotion) {
            maybeTriggerRainbow(currentGeneration);
        }

        return () => {
            clearRainbowTimers();
        };
    }, [
        animateOnMount,
        clearRainbowTimers,
        formattedValue,
        maybeTriggerRainbow,
        prefersReducedMotion,
        value,
    ]);

    const handleAnimationComplete = useCallback(() => {
        maybeTriggerRainbow(animationGenerationRef.current);
    }, [maybeTriggerRainbow]);

    const rainbowLayerClassName =
        rainbowState === 'running'
            ? 'animated-number__rainbow--running'
            : rainbowState === 'fading'
                ? 'animated-number__rainbow--fading'
                : 'animated-number__rainbow--hidden';

    const animation = durationToAnimation(duration);
    const shouldAnimate = !prefersReducedMotion && Number.isFinite(value);

    return (
        <span
            className={`animated-number ${className}`.trim()}
            style={style}
        >
            {shouldAnimate ? (
                <Calligraph
                    variant="number"
                    animation={animation}
                    initial={animateOnMount}
                    autoSize={false}
                    className="animated-number__base"
                    onComplete={handleAnimationComplete}
                >
                    {displayText}
                </Calligraph>
            ) : (
                <span className="animated-number__base">{formattedValue}</span>
            )}
            <span
                aria-hidden="true"
                className={`animated-number__rainbow ${rainbowLayerClassName}`}
            >
                {shouldAnimate ? displayText : formattedValue}
            </span>
        </span>
    );
};
