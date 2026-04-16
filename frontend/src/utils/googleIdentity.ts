// input:  [browser `window/document`, GIS global namespace, idle-callback/timeouts, and per-page Google credential callbacks]
// output: [`loadGoogleIdentityScriptWhenIdle()` loader plus singleton GIS initialize/render helpers]
// pos:    [Client-side Google Identity Services bootstrap utility that prevents duplicate initialize calls across auth pages]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

type GoogleIdentityWindow = Window & {
    google?: {
        accounts?: {
            id?: {
                initialize: (options: Record<string, unknown>) => void;
                renderButton: (container: HTMLElement, options: Record<string, unknown>) => void;
                cancel?: () => void;
            };
        };
    };
};

let gsiScriptPromise: Promise<void> | null = null;
let initializedGoogleClientId: string | null = null;
let activeCredentialHandler: ((response: { credential?: string }) => void | Promise<void>) | null = null;

const getGoogleIdentityApi = () => {
    const typedWindow = window as GoogleIdentityWindow;
    return typedWindow.google?.accounts?.id;
};

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
            existing.addEventListener('error', () => {
                gsiScriptPromise = null;
                reject(new Error('Failed to load Google Identity Services script.'));
            }, { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.dataset.googleIdentity = 'true';
        script.onload = () => resolve();
        script.onerror = () => {
            gsiScriptPromise = null;
            reject(new Error('Failed to load Google Identity Services script.'));
        };
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

export const ensureGoogleIdentityInitialized = async (
    clientId: string,
    callback: (response: { credential?: string }) => void | Promise<void>
) => {
    if (!getGoogleIdentityApi()) {
        await loadGoogleIdentityScriptWhenIdle();
    }

    const googleIdentityApi = getGoogleIdentityApi();
    if (!googleIdentityApi) {
        throw new Error('Google Identity Services API is unavailable.');
    }

    activeCredentialHandler = callback;

    if (initializedGoogleClientId !== clientId) {
        googleIdentityApi.initialize({
            client_id: clientId,
            callback: (response: { credential?: string }) => {
                void activeCredentialHandler?.(response);
            },
        });
        initializedGoogleClientId = clientId;
    }

    return googleIdentityApi;
};

export const renderGoogleIdentityButton = async (
    container: HTMLElement,
    clientId: string,
    callback: (response: { credential?: string }) => void | Promise<void>,
    options: Record<string, unknown>
) => {
    const googleIdentityApi = await ensureGoogleIdentityInitialized(clientId, callback);
    container.innerHTML = '';
    googleIdentityApi.renderButton(container, options);
};
