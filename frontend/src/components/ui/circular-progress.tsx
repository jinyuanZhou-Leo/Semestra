/**
 * CircularProgress — shadcn-style circular progress indicator.
 *
 * Uses the Radix UI Progress primitive for ARIA semantics (role="progressbar",
 * aria-valuenow, aria-valuemin, aria-valuemax) and shadcn CSS variables for
 * automatic light/dark theming.
 *
 * Usage:
 *   <CircularProgress value={earned} max={total} size={64} strokeWidth={5}>
 *     <span className="text-xl font-bold tracking-tight">{earned}</span>
 *     <span className="text-[10px] text-muted-foreground">/{total}</span>
 *   </CircularProgress>
 */

import * as React from 'react';
import { Progress as ProgressPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

export interface CircularProgressProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Current value (0 – max). */
    value: number;
    /** Maximum value. Defaults to 100. */
    max?: number;
    /** Diameter of the SVG ring in px. Defaults to 64. */
    size?: number;
    /** Stroke width of the ring in px. Defaults to 5. */
    strokeWidth?: number;
    /** Content rendered in the centre of the ring (e.g. a number + label). */
    children?: React.ReactNode;
}

const CircularProgress = React.forwardRef<HTMLDivElement, CircularProgressProps>(
    ({ value, max = 100, size = 64, strokeWidth = 5, children, className, ...props }, ref) => {
        const safeMax = max || 1;
        const safeValue = Math.min(Math.max(value, 0), safeMax);
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference * (1 - safeValue / safeMax);

        return (
            // Radix Progress root supplies role="progressbar" + aria-value* attributes.
            <ProgressPrimitive.Root
                ref={ref}
                data-slot="circular-progress"
                value={safeValue}
                max={safeMax}
                className={cn('relative flex items-center justify-center', className)}
                style={{ width: size, height: size }}
                {...props}
            >
                {/* SVG ring — decorative, hidden from screen readers (aria-hidden). */}
                <svg
                    width={size}
                    height={size}
                    aria-hidden="true"
                    style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
                >
                    {/* Track */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="var(--muted)"
                        strokeWidth={strokeWidth}
                    />
                    {/* Progress arc */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="var(--primary)"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                    />
                </svg>

                {/* Centre content — layered on top of the SVG. */}
                {children && (
                    <div className="relative z-10 flex flex-col items-center justify-center leading-none">
                        {children}
                    </div>
                )}
            </ProgressPrimitive.Root>
        );
    }
);

CircularProgress.displayName = 'CircularProgress';

export { CircularProgress };
