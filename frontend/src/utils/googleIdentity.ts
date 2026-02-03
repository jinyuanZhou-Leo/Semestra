type GoogleIdentityWindow = Window & {
    google?: {
        accounts?: {
            id?: {
                initialize: (options: Record<string, unknown>) => void;
                renderButton: (container: HTMLElement, options: Record<string, unknown>) => void;
            };
        };
    };
};

let gsiScriptPromise: Promise<void> | null = null;

const loadGoogleIdentityScript = () => {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('Google Identity script can only load in the browser.'));
    }

    const typedWindow = window as GoogleIdentityWindow;
    if (typedWindow.google?.accounts?.id) {
        return Promise.resolve();
    }

    if (gsiScriptPromise) {
        return gsiScriptPromise;
    }

    gsiScriptPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity="true"]');
        if (existing) {
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services script.')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.dataset.googleIdentity = 'true';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Google Identity Services script.'));
        document.head.appendChild(script);
    });

    return gsiScriptPromise;
};

export const loadGoogleIdentityScriptWhenIdle = () => {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('Google Identity script can only load in the browser.'));
    }

    return new Promise<void>((resolve, reject) => {
        const schedule = () => {
            loadGoogleIdentityScript().then(resolve).catch(reject);
        };

        if ('requestIdleCallback' in window) {
            (window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number })
                .requestIdleCallback?.(schedule, { timeout: 1500 });
        } else {
            globalThis.setTimeout(schedule, 250);
        }
    });
};
