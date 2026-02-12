import { useSyncExternalStore } from 'react';
import { appStatusStore, clearStatus, retryFailedSync } from '../services/appStatus';

export const useAppStatus = () => {
    const snapshot = useSyncExternalStore(
        appStatusStore.subscribe,
        appStatusStore.getSnapshot,
        appStatusStore.getSnapshot
    );

    return {
        status: snapshot.status,
        pendingSyncRetryCount: snapshot.pendingSyncRetryCount,
        clearStatus,
        retryFailedSync
    };
};
