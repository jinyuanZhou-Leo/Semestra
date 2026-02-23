// input:  [window scroll position, threshold parameter, animation-frame scheduling]
// output: [`useScrollProgress(threshold)` hook returning normalized 0..1 progress]
// pos:    [Scroll signal helper for collapsible/sticky header animation calculations]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useState, useEffect } from 'react';

/**
 * Hook to track scroll progress for header collapsing effects.
 * Returns a value between 0 and 1.
 * 
 * @param threshold The scroll distance in pixels at which progress reaches 1. Default is 100.
 */
export const useScrollProgress = (threshold: number = 100) => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        let ticking = false;

        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const scrollY = window.scrollY;
                    const newProgress = Math.min(Math.max(scrollY / threshold, 0), 1);
                    setProgress(() => {
                        // Only update state if the value has changed significantly or reached boundaries
                        // to prevent unnecessary re-renders for micro-scrolls if we wanted to throttle more,
                        // but for smooth animation, we strictly want the latest value.
                        // However, React's useState bail-out handles identical values.
                        return newProgress;
                    });
                    ticking = false;
                });
                ticking = true;
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        // Initialize
        handleScroll();

        return () => window.removeEventListener('scroll', handleScroll);
    }, [threshold]);

    return progress;
};
