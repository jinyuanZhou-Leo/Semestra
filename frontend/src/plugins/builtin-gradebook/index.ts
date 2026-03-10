// input:  [builtin-gradebook tab/widget definitions]
// output: [default plugin runtime declaration for builtin-gradebook]
// pos:    [runtime entrypoint that exposes the builtin-gradebook course tab and summary widget]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { definePluginRuntime } from '../../plugin-system/contracts';
import { BuiltinGradebookTabDefinition } from './tab';
import { BuiltinGradebookSummaryWidgetDefinition } from './widget';

export default definePluginRuntime({
    tabDefinitions: [BuiltinGradebookTabDefinition],
    widgetDefinitions: [BuiltinGradebookSummaryWidgetDefinition],
});
