// input:  [builtin-canvas-integration tab definition]
// output: [default plugin runtime declaration for builtin-canvas-integration]
// pos:    [runtime entrypoint that exposes the Canvas pages course tab]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { definePluginRuntime } from '@/plugin-system/contracts';

import { BuiltinCanvasIntegrationTabDefinition } from './tab';

export default definePluginRuntime({
    tabDefinitions: [BuiltinCanvasIntegrationTabDefinition],
});
