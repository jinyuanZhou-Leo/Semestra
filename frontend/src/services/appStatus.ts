export type AppStatus = {
    id: number;
    type: 'error' | 'info';
    message: string;
    createdAt: number;
};

type Listener = () => void;
type RetryHandler = () => void | Promise<void>;

type AppStatusSnapshot = {
    status: AppStatus | null;
    pendingSyncRetryCount: number;
};

const listeners = new Set<Listener>();
const syncRetryHandlers = new Map<string, RetryHandler>();
let clearTimer: ReturnType<typeof setTimeout> | null = null;
let lastErrorAt = 0;

let snapshot: AppStatusSnapshot = {
    status: null,
    pendingSyncRetryCount: 0
};

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

const setSnapshot = (patch: Partial<AppStatusSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    notify();
};

const updateSyncRetryCount = () => {
    const nextCount = syncRetryHandlers.size;
    if (snapshot.pendingSyncRetryCount === nextCount) return;
    setSnapshot({ pendingSyncRetryCount: nextCount });
};

export const setStatus = (status: AppStatus, ttlMs: number = 8000) => {
    setSnapshot({ status });
    scheduleClear(ttlMs);
};

export const clearStatus = () => {
    if (clearTimer) {
        clearTimeout(clearTimer);
        clearTimer = null;
    }
    if (snapshot.status) {
        setSnapshot({ status: null });
    }
};

export const registerSyncRetryAction = (key: string, handler: RetryHandler) => {
    syncRetryHandlers.set(key, handler);
    updateSyncRetryCount();
};

export const clearSyncRetryAction = (key: string) => {
    if (!syncRetryHandlers.delete(key)) return;
    updateSyncRetryCount();
};

export const clearAllSyncRetryActions = () => {
    if (syncRetryHandlers.size === 0) return;
    syncRetryHandlers.clear();
    updateSyncRetryCount();
};

export const retryFailedSync = async () => {
    const pendingHandlers = Array.from(syncRetryHandlers.values());
    syncRetryHandlers.clear();
    updateSyncRetryCount();
    if (pendingHandlers.length === 0) return;
    await Promise.allSettled(
        pendingHandlers.map((handler) => Promise.resolve(handler()))
    );
};

export const reportError = (message: string, ttlMs: number = 8000) => {
    const now = Date.now();
    // Avoid spamming the same error repeatedly in a short window.
    if (snapshot.status?.type === 'error' && snapshot.status.message === message && now - lastErrorAt < 2000) {
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
        return snapshot;
    }
};
