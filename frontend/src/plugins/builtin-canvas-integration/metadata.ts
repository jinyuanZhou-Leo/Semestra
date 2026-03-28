// input:  [React icon factory, plugin metadata helpers, and Canvas brand asset]
// output: [default-exported builtin-canvas-integration plugin metadata declaration]
// pos:    [plugin catalog entry describing the Canvas-only course navigation tab]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { createElement } from 'react';

import canvasIcon from '@/assets/canvas-icon.png';
import { definePluginMetadata } from '@/plugin-system/contracts';
import type { TabCatalogItem } from '@/plugin-system/types';

import { BUILTIN_CANVAS_INTEGRATION_PLUGIN_ID, BUILTIN_CANVAS_PAGES_TAB_TYPE } from './shared';

const pluginIcon = createElement('img', {
    src: canvasIcon,
    alt: 'Canvas',
    className: 'h-4 w-4 rounded-sm object-cover',
});

const tabCatalog: TabCatalogItem[] = [
    {
        pluginId: BUILTIN_CANVAS_INTEGRATION_PLUGIN_ID,
        type: BUILTIN_CANVAS_PAGES_TAB_TYPE,
        name: 'Canvas Pages',
        description: 'Browse Canvas course navigation and open same-course page links inside Semestra.',
        icon: pluginIcon,
        allowedContexts: ['course'],
    },
];

export default definePluginMetadata({
    pluginId: BUILTIN_CANVAS_INTEGRATION_PLUGIN_ID,
    displayName: 'Canvas Integration',
    author: 'Jinyuan',
    description: 'Browse Canvas course content without leaving the workspace.',
    longDescription: 'Canvas Integration brings supported Canvas course content into Semestra so students can stay in one workflow while reviewing materials, checking course pages, and following the structure of a class. It keeps familiar Canvas navigation close at hand, opens linked content in context, and reduces the friction of bouncing between systems during study sessions. The goal is straightforward: make course content easier to reach, easier to browse, and easier to follow while working inside Semestra.',
    icon: pluginIcon,
    tabCatalog,
});
