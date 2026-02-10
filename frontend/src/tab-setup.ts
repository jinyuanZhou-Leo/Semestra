import { ensureBuiltinTabPluginsLoaded } from './plugins/runtime';

// Compatibility export: only preload builtin tabs needed for initial navigation.
export const tabsReady = ensureBuiltinTabPluginsLoaded();
