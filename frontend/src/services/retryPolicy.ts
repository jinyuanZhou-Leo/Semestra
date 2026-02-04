import axios from 'axios';

export const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1000, 3000, 10000];

export const isRetryableError = (error: unknown) => {
    if (axios.isAxiosError(error)) {
        if (!error.response) return true;
        const status = error.response.status;
        return status >= 500 || status === 408 || status === 429;
    }
    return false;
};

export const getRetryDelayMs = (attempt: number) => {
    const index = Math.min(Math.max(attempt - 1, 0), RETRY_DELAYS_MS.length - 1);
    const base = RETRY_DELAYS_MS[index];
    const jitter = Math.floor(Math.random() * 250);
    return base + jitter;
};
