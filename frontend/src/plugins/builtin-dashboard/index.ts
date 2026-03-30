// input:  [plugin runtime helper and builtin-dashboard tab definition]
// output: [default-exported builtin-dashboard runtime definition]
// pos:    [runtime entry that exposes the built-in dashboard tab to the plugin loader]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { definePluginRuntime } from '@/plugin-sdk';

import { BuiltinDashboardTabDefinition } from './tab';

export default definePluginRuntime({
    tabDefinitions: [BuiltinDashboardTabDefinition],
});
