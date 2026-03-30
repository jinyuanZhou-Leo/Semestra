import { definePluginRuntime } from '@/plugin-sdk';

import { StickyNoteWidgetDefinition } from './widget';

export default definePluginRuntime({
    widgetDefinitions: [StickyNoteWidgetDefinition],
});
