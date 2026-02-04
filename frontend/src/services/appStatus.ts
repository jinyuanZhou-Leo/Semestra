export type AppStatus = {
    id: number;
    type: 'error' | 'info';
    message: string;
    createdAt: number;
};

type Listener = () => void;

const listeners = new Set<Listener>();
let currentStatus: AppStatus | null = null;
let clearTimer: ReturnType<typeof setTimeout> | null = null;
let lastErrorAt = 0;

const notify = () => {
    listeners.forEach(listener => listener());
};

const scheduleClear = (ttlMs: number) => {
    if (clearTimer) {
        clearTimeout(clearTimer);
        clearTimer = null;
    }
    if (ttlMs > 0) {
        clearTimer = setTimeout(() => {
            clearStatus();
        }, ttlMs);
    }
};

export const setStatus = (status: AppStatus, ttlMs: number = 8000) => {
    currentStatus = status;
    notify();
    scheduleClear(ttlMs);
};

export const clearStatus = () => {
    if (clearTimer) {
        clearTimeout(clearTimer);
        clearTimer = null;
    }
    if (currentStatus) {
        currentStatus = null;
        notify();
    }
};

export const reportError = (message: string, ttlMs: number = 8000) => {
    const now = Date.now();
    // Avoid spamming the same error repeatedly in a short window.
    if (currentStatus?.type === 'error' && currentStatus.message === message && now - lastErrorAt < 2000) {
        return;
    }
    lastErrorAt = now;
    setStatus({
        id: now,
        type: 'error',
        message,
        createdAt: now
    }, ttlMs);
};

export const appStatusStore = {
    subscribe(listener: Listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
    getSnapshot() {
        return currentStatus;
    }
};
