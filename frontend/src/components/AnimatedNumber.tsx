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

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
    value,
    format,
    duration = 650,
    className = '',
    style,
    animateOnMount = true,
    rainbowThreshold,
    rainbowStartDelayMs = 280,
    rainbowDurationMs = 5000,
    rainbowFadeOutMs = 1200
}) => {
    const [displayValue, setDisplayValue] = useState(() => (animateOnMount ? 0 : value));
    const [isAnimating, setIsAnimating] = useState(false);
    const [rainbowState, setRainbowState] = useState<'hidden' | 'running' | 'fading'>('hidden');
    const previousValueRef = useRef<number | null>(null);
    const displayValueRef = useRef<number>(animateOnMount ? 0 : value);
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
            setIsAnimating(false);
            displayValueRef.current = value;
            setDisplayValue(value);
            return () => {};
        }

        const shouldAnimate = !prefersReducedMotion && duration > 0 && (isFirstAnimation || previousValue !== null);
        if (!shouldAnimate || (previousValue === value && !isFirstAnimation)) {
            setIsAnimating(false);
            displayValueRef.current = value;
            setDisplayValue(value);
            if (typeof rainbowThreshold === 'number' && value >= rainbowThreshold) {
                triggerRainbowMarquee();
            }
            return () => {};
        }

        const startValue = isFirstAnimation ? (animateOnMount ? 0 : value) : displayValueRef.current;
        const startTime = performance.now();

        setIsAnimating(true);

        const tick = (now: number) => {
            if (isFirstAnimation && !hasAnimatedOnMountRef.current) {
                hasAnimatedOnMountRef.current = true;
            }
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeOutCubic(progress);
            const nextValue = startValue + (value - startValue) * eased;
            displayValueRef.current = nextValue;
            setDisplayValue(nextValue);

            if (progress < 1) {
                rafRef.current = requestAnimationFrame(tick);
                return;
            }

            if (animationGenerationRef.current !== currentGeneration) {
                return;
            }

            setIsAnimating(false);
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
    }, [animateOnMount, duration, prefersReducedMotion, rainbowDurationMs, rainbowFadeOutMs, rainbowStartDelayMs, rainbowThreshold, value]);

    const renderedValue = format ? format(displayValue) : displayValue.toString();
    const rainbowLayerClassName =
        rainbowState === 'running'
            ? 'animated-number__rainbow--running'
            : rainbowState === 'fading'
                ? 'animated-number__rainbow--fading'
                : 'animated-number__rainbow--hidden';

    return (
        <span
            className={`animated-number ${isAnimating ? 'animated-number--pulse' : ''} ${className}`.trim()}
            style={style}
        >
            <span className="animated-number__base">{renderedValue}</span>
            <span
                aria-hidden="true"
                className={`animated-number__rainbow ${rainbowLayerClassName}`}
            >
                {renderedValue}
            </span>
        </span>
    );
};
