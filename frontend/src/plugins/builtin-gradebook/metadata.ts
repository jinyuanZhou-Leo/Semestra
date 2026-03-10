// input:  [React icon factory, plugin metadata helpers, and builtin-gradebook shared constants]
// output: [default-exported builtin-gradebook plugin metadata declaration]
// pos:    [plugin catalog entry describing the builtin-gradebook course tab and summary widget]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { createElement } from 'react';
import { BookOpenCheck, NotebookTabs } from 'lucide-react';
import { definePluginMetadata } from '../../plugin-system/contracts';
import type { TabCatalogItem, WidgetCatalogItem } from '../../plugin-system/types';
import {
    BUILTIN_GRADEBOOK_PLUGIN_ID,
    BUILTIN_GRADEBOOK_SUMMARY_WIDGET_TYPE,
    BUILTIN_GRADEBOOK_TAB_TYPE,
} from './shared';

const tabCatalog: TabCatalogItem[] = [
    {
        pluginId: BUILTIN_GRADEBOOK_PLUGIN_ID,
        type: BUILTIN_GRADEBOOK_TAB_TYPE,
        name: 'Gradebook',
        description: 'Track assessments, prediction scenarios, and required scores for a course.',
        icon: createElement(NotebookTabs, { className: 'h-4 w-4' }),
        maxInstances: 0,
        allowedContexts: ['course'],
    },
];

const widgetCatalog: WidgetCatalogItem[] = [
    {
        pluginId: BUILTIN_GRADEBOOK_PLUGIN_ID,
        type: BUILTIN_GRADEBOOK_SUMMARY_WIDGET_TYPE,
        name: 'Gradebook Summary',
        description: 'Compact gradebook projection, feasibility, and upcoming due items.',
        icon: createElement(BookOpenCheck, { className: 'h-4 w-4' }),
        layout: { w: 4, h: 3, minW: 3, minH: 3, maxW: 6, maxH: 6 },
        maxInstances: 1,
        allowedContexts: ['course'],
    },
];

export default definePluginMetadata({
    pluginId: BUILTIN_GRADEBOOK_PLUGIN_ID,
    tabCatalog,
    widgetCatalog,
});
