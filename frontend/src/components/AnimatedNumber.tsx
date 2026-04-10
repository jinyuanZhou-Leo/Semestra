// input:  [target numeric value, optional formatter/animation props, RAF + motion preference]
// output: [`AnimatedNumber` component]
// pos:    [Reusable metric value animator used in cards and progress summaries with softer shared motion]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useEffect, useMemo, useRef, useState } from 'react';

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

const easeInOutCubic = (t: number) => (
    t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2
);

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
    const baseTextRef = useRef<HTMLSpanElement | null>(null);
    const rainbowTextRef = useRef<HTMLSpanElement | null>(null);
    const previousValueRef = useRef<number | null>(null);
    const initialDisplayValue = animateOnMount ? 0 : value;
    const [initialRenderedValue] = useState(() => (format ? format(initialDisplayValue) : initialDisplayValue.toString()));
    const displayValueRef = useRef<number>(initialDisplayValue);
    const renderedTextRef = useRef<string>(initialRenderedValue);
    const hasAnimatedOnMountRef = useRef(false);
    const rafRef = useRef<number | null>(null);
    const animationGenerationRef = useRef(0);
    const rainbowStartTimeoutRef = useRef<number | null>(null);
    const rainbowStopTimeoutRef = useRef<number | null>(null);
    const rainbowHideTimeoutRef = useRef<number | null>(null);

    const prefersReducedMotion = useMemo(() => {
        if (typeof window === 'undefined' || !('matchMedia' in window)) return false;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }, []);

    const renderValue = React.useCallback((nextValue: number) => {
        return format ? format(nextValue) : nextValue.toString();
    }, [format]);

    const syncRenderedText = React.useCallback((nextValue: number) => {
        const nextText = renderValue(nextValue);
        if (renderedTextRef.current === nextText) {
            return;
        }

        renderedTextRef.current = nextText;
        if (baseTextRef.current) {
            baseTextRef.current.textContent = nextText;
        }
        if (rainbowTextRef.current) {
            rainbowTextRef.current.textContent = nextText;
        }
    }, [renderValue]);

    useEffect(() => {
        syncRenderedText(displayValueRef.current);
    }, [syncRenderedText]);

    useEffect(() => {
        const currentGeneration = animationGenerationRef.current + 1;
        animationGenerationRef.current = currentGeneration;

        const previousValue = previousValueRef.current;
        previousValueRef.current = value;
        const isFirstAnimation = animateOnMount && !hasAnimatedOnMountRef.current;
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
        setRainbowState('hidden');

        const triggerRainbowMarquee = () => {
            if (prefersReducedMotion || rainbowDurationMs <= 0) return;
            const startRunning = () => {
                if (animationGenerationRef.current !== currentGeneration) return;
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
        };

        if (!Number.isFinite(value)) {
            displayValueRef.current = value;
            syncRenderedText(value);
            return () => {};
        }

        const shouldAnimate = !prefersReducedMotion && duration > 0 && (isFirstAnimation || previousValue !== null);
        if (!shouldAnimate || (previousValue === value && !isFirstAnimation)) {
            displayValueRef.current = value;
            syncRenderedText(value);
            if (typeof rainbowThreshold === 'number' && value >= rainbowThreshold) {
                triggerRainbowMarquee();
            }
            return () => {};
        }

        const startValue = isFirstAnimation ? (animateOnMount ? 0 : value) : displayValueRef.current;
        const startTime = performance.now();

        const tick = (now: number) => {
            if (isFirstAnimation && !hasAnimatedOnMountRef.current) {
                hasAnimatedOnMountRef.current = true;
            }
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeInOutCubic(progress);
            const nextValue = startValue + (value - startValue) * eased;
            displayValueRef.current = nextValue;
            syncRenderedText(nextValue);

            if (progress < 1) {
                rafRef.current = requestAnimationFrame(tick);
                return;
            }

            if (animationGenerationRef.current !== currentGeneration) {
                return;
            }

            if (typeof rainbowThreshold === 'number' && value >= rainbowThreshold) {
                triggerRainbowMarquee();
            }
        };

        rafRef.current = requestAnimationFrame(tick);

        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
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
        };
    }, [animateOnMount, duration, prefersReducedMotion, rainbowDurationMs, rainbowFadeOutMs, rainbowStartDelayMs, rainbowThreshold, syncRenderedText, value]);

    const rainbowLayerClassName =
        rainbowState === 'running'
            ? 'animated-number__rainbow--running'
            : rainbowState === 'fading'
                ? 'animated-number__rainbow--fading'
                : 'animated-number__rainbow--hidden';

    return (
        <span
            className={`animated-number ${className}`.trim()}
            style={style}
        >
            <span ref={baseTextRef} className="animated-number__base">{initialRenderedValue}</span>
            <span
                ref={rainbowTextRef}
                aria-hidden="true"
                className={`animated-number__rainbow ${rainbowLayerClassName}`}
            >
                {initialRenderedValue}
            </span>
        </span>
    );
};
