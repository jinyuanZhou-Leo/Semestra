import { useEffect, useMemo, useRef, useState } from 'react';

interface UseStickyCollapseOptions {
  collapseThreshold?: number;
  transitionMs?: number;
}

interface UseStickyCollapseResult {
  isShrunk: boolean;
  heroRef: React.RefObject<HTMLDivElement | null>;
  heroSpacerHeight: number;
}

/**
 * Keeps a sticky hero section in two states (expanded/shrunk) with a transition lock.
 * The behavior matches the previous binary collapse logic: shrunk when scrollY > threshold.
 */
export const useStickyCollapse = ({
  collapseThreshold = 0,
  transitionMs = 300,
}: UseStickyCollapseOptions = {}): UseStickyCollapseResult => {
  const [isShrunk, setIsShrunk] = useState(false);
  const [heroHeights, setHeroHeights] = useState({ expanded: 0, shrunk: 0 });

  const isShrunkRef = useRef(false);
  const isTransitioningRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const isShrunkStateRef = useRef(isShrunk);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;

        if (isTransitioningRef.current) {
          ticking = false;
          return;
        }

        const nextIsShrunk = currentScrollY > collapseThreshold;
        if (nextIsShrunk !== isShrunkRef.current) {
          isShrunkRef.current = nextIsShrunk;
          setIsShrunk(nextIsShrunk);

          isTransitioningRef.current = true;
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            isTransitioningRef.current = false;
            const finalIsShrunk = window.scrollY > collapseThreshold;
            if (finalIsShrunk !== isShrunkRef.current) {
              isShrunkRef.current = finalIsShrunk;
              setIsShrunk(finalIsShrunk);
            }
          }, transitionMs);
        }

        ticking = false;
      });
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [collapseThreshold, transitionMs]);

  useEffect(() => {
    isShrunkStateRef.current = isShrunk;
  }, [isShrunk]);

  useEffect(() => {
    const element = heroRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const measure = () => {
      const height = element.getBoundingClientRect().height;
      setHeroHeights((prev) => {
        const key = isShrunkStateRef.current ? 'shrunk' : 'expanded';
        if (Math.abs(prev[key] - height) < 1) return prev;
        return { ...prev, [key]: height };
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const heroSpacerHeight = useMemo(() => {
    if (!heroHeights.expanded || !heroHeights.shrunk) return 0;
    return Math.max(0, heroHeights.expanded - heroHeights.shrunk);
  }, [heroHeights.expanded, heroHeights.shrunk]);

  return { isShrunk, heroRef, heroSpacerHeight };
};
