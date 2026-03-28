// input:  [plugin runtime helper and builtin-setting tab definition]
// output: [default-exported builtin-setting runtime definition]
// pos:    [runtime entry that exposes the built-in settings tab to the plugin loader]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { definePluginRuntime } from '../../plugin-system/contracts';

import { BuiltinSettingTabDefinition } from './tab';

export default definePluginRuntime({
    tabDefinitions: [BuiltinSettingTabDefinition],
});
