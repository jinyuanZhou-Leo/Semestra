// input:  [React external-store subscription API and browser idle/timer primitives]
// output: [plugin load-state store factory plus idle-task scheduling helpers]
// pos:    [Internal plugin-system load-state utility that centralizes plugin load subscriptions, version tracking, and browser-idle scheduling]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export type PluginLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface PluginLoadState {
  status: PluginLoadStatus;
  error: Error | null;
}

export interface PluginLoadableEntry {
  loadState: PluginLoadState;
}

type Listener = () => void;

export type BrowserTimerHandle = ReturnType<typeof globalThis.setTimeout>;
export type IdleTaskHandle = number | BrowserTimerHandle;

type BrowserIdleWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export const IDLE_LOAD_STATE: PluginLoadState = { status: 'idle', error: null };

export const createPluginLoadStateStore = () => {
  const listeners = new Set<Listener>();
  let loadStateVersion = 0;

  const notify = () => {
    loadStateVersion += 1;
    listeners.forEach((listener) => listener());
  };

  return {
    notify,
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getVersion: () => loadStateVersion,
  };
};

export const scheduleBrowserIdleTask = (callback: () => void, timeout = 1500): IdleTaskHandle => {
  if (typeof window === 'undefined') {
    return globalThis.setTimeout(callback, 0);
  }

  const browserWindow = window as BrowserIdleWindow;
  if (typeof browserWindow.requestIdleCallback === 'function') {
    return browserWindow.requestIdleCallback(() => callback(), { timeout });
  }

  return globalThis.setTimeout(callback, 250);
};

export const cancelBrowserIdleTask = (handle: IdleTaskHandle) => {
  if (typeof window === 'undefined') {
    globalThis.clearTimeout(handle);
    return;
  }

  const browserWindow = window as BrowserIdleWindow;
  if (typeof browserWindow.cancelIdleCallback === 'function' && typeof handle === 'number') {
    browserWindow.cancelIdleCallback(handle);
    return;
  }

  globalThis.clearTimeout(handle);
};
