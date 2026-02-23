// input:  [pointer-capability media query, `navigator.maxTouchPoints`, shared listener registry]
// output: [boolean `useTouchDevice()` hook result]
// pos:    [Central touch-device detector that avoids duplicate component-level listeners]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useEffect, useState } from 'react';

type Listener = (value: boolean) => void;

let mediaQuery: MediaQueryList | null = null;
const listeners: Set<Listener> = new Set();
let mediaChangeHandler: (() => void) | null = null;
let matchMediaSource: typeof window.matchMedia | null = null;

const getCurrentValue = (): boolean => {
    if (typeof window === 'undefined') return false;
    if (typeof window.matchMedia !== 'function') {
        return navigator.maxTouchPoints > 0;
    }
    if (!mediaQuery || matchMediaSource !== window.matchMedia) {
        matchMediaSource = window.matchMedia;
        mediaQuery = window.matchMedia('(hover: none), (pointer: coarse)');
    }
    return mediaQuery.matches || navigator.maxTouchPoints > 0;
};

const notify = (value: boolean) => {
    listeners.forEach(listener => listener(value));
};

const ensureListener = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    if (!mediaQuery || matchMediaSource !== window.matchMedia) {
        matchMediaSource = window.matchMedia;
        mediaQuery = window.matchMedia('(hover: none), (pointer: coarse)');
    }
    if (!mediaQuery || mediaChangeHandler) return;
    mediaChangeHandler = () => notify(getCurrentValue());
    if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', mediaChangeHandler);
    } else {
        mediaQuery.addListener(mediaChangeHandler);
    }
};

const cleanupListener = () => {
    if (!mediaQuery || !mediaChangeHandler) return;
    if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', mediaChangeHandler);
    } else {
        mediaQuery.removeListener(mediaChangeHandler);
    }
    mediaQuery = null;
    mediaChangeHandler = null;
    matchMediaSource = null;
};

export const useTouchDevice = () => {
    const [isTouchDevice, setIsTouchDevice] = useState(() => getCurrentValue());

    useEffect(() => {
        if (typeof window === 'undefined') return;
        ensureListener();
        setIsTouchDevice(getCurrentValue());
        listeners.add(setIsTouchDevice);
        return () => {
            listeners.delete(setIsTouchDevice);
            if (listeners.size === 0) {
                cleanupListener();
            }
        };
    }, []);

    return isTouchDevice;
};
