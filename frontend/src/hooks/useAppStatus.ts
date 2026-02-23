// input:  [React `useSyncExternalStore`, `appStatusStore`, and retry helper actions]
// output: [`useAppStatus()` hook exposing status, retry count, and control actions]
// pos:    [Thin adapter from service-layer status store to React components]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

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
