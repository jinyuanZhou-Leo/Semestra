import { definePluginRuntime } from '../../plugin-system/contracts';

import { StickyNoteWidgetDefinition } from './widget';

export default definePluginRuntime({
    widgetDefinitions: [StickyNoteWidgetDefinition],
});
