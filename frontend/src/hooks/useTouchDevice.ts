import { useEffect, useState } from 'react';

type Listener = (value: boolean) => void;

let mediaQuery: MediaQueryList | null = null;
let listeners: Set<Listener> = new Set();
let mediaChangeHandler: (() => void) | null = null;

const getCurrentValue = (): boolean => {
    if (typeof window === 'undefined') return false;
    if (!mediaQuery) {
        mediaQuery = window.matchMedia('(hover: none), (pointer: coarse)');
    }
    return mediaQuery.matches || navigator.maxTouchPoints > 0;
};

const notify = (value: boolean) => {
    listeners.forEach(listener => listener(value));
};

const ensureListener = () => {
    if (typeof window === 'undefined' || mediaQuery) return;
    mediaQuery = window.matchMedia('(hover: none), (pointer: coarse)');
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
