import { useSyncExternalStore } from 'react';
import { appStatusStore, clearStatus } from '../services/appStatus';

export const useAppStatus = () => {
    const status = useSyncExternalStore(
        appStatusStore.subscribe,
        appStatusStore.getSnapshot,
        appStatusStore.getSnapshot
    );

    return {
        status,
        clearStatus
    };
};
