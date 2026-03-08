// input:  [container ref, browser resize/observer APIs, and calendar layout dependencies]
// output: [`useViewportBoundHeight()` hook that measures an available Calendar shell height]
// pos:    [layout hook that isolates viewport-bound Calendar sizing from feature orchestration logic]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';

const MIN_CALENDAR_PANEL_HEIGHT = 480;
const VIEWPORT_BOTTOM_GUTTER = 12;

interface UseViewportBoundHeightOptions {
  cardRef: React.RefObject<HTMLDivElement | null>;
  dependencies: React.DependencyList;
}

export const useViewportBoundHeight = ({ cardRef, dependencies }: UseViewportBoundHeightOptions) => {
  const [viewportBoundHeight, setViewportBoundHeight] = React.useState<number | null>(null);

  const updateViewportBoundHeight = React.useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const available = Math.floor(window.innerHeight - rect.top - VIEWPORT_BOTTOM_GUTTER);
    const nextHeight = Math.max(MIN_CALENDAR_PANEL_HEIGHT, available);
    setViewportBoundHeight((current) => (current === nextHeight ? current : nextHeight));
  }, [cardRef]);

  React.useLayoutEffect(() => {
    updateViewportBoundHeight();
  }, [updateViewportBoundHeight, ...dependencies]);

  React.useEffect(() => {
    const card = cardRef.current;
    const resizeObserver = new ResizeObserver(() => {
      updateViewportBoundHeight();
    });

    window.addEventListener('resize', updateViewportBoundHeight);
    if (card) {
      resizeObserver.observe(card);
      if (card.parentElement) {
        resizeObserver.observe(card.parentElement);
      }
    }

    return () => {
      window.removeEventListener('resize', updateViewportBoundHeight);
      resizeObserver.disconnect();
    };
  }, [cardRef, updateViewportBoundHeight]);

  return viewportBoundHeight;
};
