import React, { useEffect, useMemo, useRef, useState } from 'react';

interface AnimatedNumberProps {
    value: number;
    format?: (value: number) => string;
    duration?: number;
    className?: string;
    style?: React.CSSProperties;
    animateOnMount?: boolean;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
    value,
    format,
    duration = 650,
    className = '',
    style,
    animateOnMount = true
}) => {
    const [displayValue, setDisplayValue] = useState(() => (animateOnMount ? 0 : value));
    const [isAnimating, setIsAnimating] = useState(false);
    const previousValueRef = useRef<number | null>(null);
    const displayValueRef = useRef<number>(animateOnMount ? 0 : value);
    const hasAnimatedOnMountRef = useRef(false);
    const rafRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);

    const prefersReducedMotion = useMemo(() => {
        if (typeof window === 'undefined' || !('matchMedia' in window)) return false;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }, []);

    useEffect(() => {
        const previousValue = previousValueRef.current;
        previousValueRef.current = value;
        const isFirstAnimation = animateOnMount && !hasAnimatedOnMountRef.current;

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
            }
        };

        rafRef.current = requestAnimationFrame(tick);

        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = window.setTimeout(() => {
            setIsAnimating(false);
        }, duration);

        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            if (timeoutRef.current) {
                window.clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, [animateOnMount, duration, prefersReducedMotion, value]);

    const renderedValue = format ? format(displayValue) : displayValue.toString();

    return (
        <span
            className={`animated-number ${isAnimating ? 'animated-number--pulse' : ''} ${className}`.trim()}
            style={style}
        >
            {renderedValue}
        </span>
    );
};
