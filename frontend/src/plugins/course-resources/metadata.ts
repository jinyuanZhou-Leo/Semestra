// input:  [React icon factory, plugin metadata helpers, and course-resources shared constants]
// output: [default-exported course-resources plugin metadata declaration]
// pos:    [plugin catalog entry describing the course-only resources tab and quick-open widget]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { createElement } from 'react';
import { FolderOpenDot, PanelsTopLeft } from 'lucide-react';

import { definePluginMetadata } from '@/plugin-system/contracts';
import type { TabCatalogItem, WidgetCatalogItem } from '@/plugin-system/types';

import {
    COURSE_RESOURCES_PLUGIN_ID,
    COURSE_RESOURCES_TAB_TYPE,
    COURSE_RESOURCES_WIDGET_TYPE,
} from './shared';

const pluginIcon = createElement(FolderOpenDot, { className: 'h-4 w-4' });

const tabCatalog: TabCatalogItem[] = [
    {
        pluginId: COURSE_RESOURCES_PLUGIN_ID,
        type: COURSE_RESOURCES_TAB_TYPE,
        name: 'Course Resources',
        description: 'Manage course files with drag-and-drop upload, quick open, and lightweight file actions.',
        icon: pluginIcon,
        allowedContexts: ['course'],
    },
];

const widgetCatalog: WidgetCatalogItem[] = [
    {
        pluginId: COURSE_RESOURCES_PLUGIN_ID,
        type: COURSE_RESOURCES_WIDGET_TYPE,
        name: 'Course Resources Quick Open',
        description: 'Open one, two, or four pinned course resources from the dashboard.',
        icon: createElement(PanelsTopLeft, { className: 'h-4 w-4' }),
        layout: { w: 3, h: 3, minW: 2, minH: 2, maxW: 4, maxH: 4 },
        maxInstances: 'unlimited',
        allowedContexts: ['course'],
    },
];

export default definePluginMetadata({
    pluginId: COURSE_RESOURCES_PLUGIN_ID,
    displayName: 'Course Resources',
    author: 'Jinyuan',
    description: 'Keep course files and links organized for quick access.',
    longDescription: 'Course Resources gives each course a dedicated place to collect files, links, and frequently used materials. Instead of hunting through LMS pages, browser bookmarks, and scattered downloads, users can keep important content grouped by course and reach it quickly when studying. It is designed for everyday retrieval: lecture slides, reference sheets, assignment links, and anything else that should stay easy to open throughout the term.',
    icon: pluginIcon,
    tabCatalog,
    widgetCatalog,
});
