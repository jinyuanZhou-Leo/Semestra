// input:  [typed plugin manifest helper, course-resources lucide icons, frontend plugin SDK, and lazy runtime loader]
// output: [default-exported descriptor-backed course-resources plugin definition]
// pos:    [single-entry external plugin definition for course resources runtime loading]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { FolderOpenDot, PanelsTopLeft } from 'lucide-react';

import { definePlugin, definePluginManifest } from '../../plugin-sdk/authoring.ts';

export default definePlugin({
  descriptor: definePluginManifest({
    id: 'builtin-course-resources',
    display_name: 'Course Resources',
    author: 'Jinyuan',
    description: 'Keep course files and links organized for quick access.',
    long_description:
      'Course Resources gives each course a dedicated place to collect files, links, and frequently used materials. Instead of hunting through LMS pages, browser bookmarks, and scattered downloads, users can keep important content grouped by course and reach it quickly when studying. It is designed for everyday retrieval: lecture slides, reference sheets, assignment links, and anything else that should stay easy to open throughout the term.',
    icon: FolderOpenDot,
    tabs: [
      {
        type: 'builtin-course-resources',
        title: 'Course Resources',
        description: 'Manage course files with drag-and-drop upload, quick open, and lightweight file actions.',
        icon: FolderOpenDot,
        contexts: ['semester', 'course'],
      },
    ],
    widgets: [
      {
        type: 'builtin-course-resources-quick-open',
        title: 'Course Resources Quick Open',
        description: 'Open one, two, or four pinned course resources from the dashboard.',
        icon: PanelsTopLeft,
        contexts: ['course'],
        layout: {
          w: 3,
          h: 3,
          minW: 2,
          minH: 2,
          maxW: 4,
          maxH: 4,
        },
        max_instances: 'unlimited',
      },
    ],
  }),
  loadRuntime: async () => (await import('./index')).default,
});
