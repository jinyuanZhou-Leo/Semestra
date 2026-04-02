// input:  [typed plugin manifest helper, course-list icon, frontend plugin SDK, and lazy runtime loader]
// output: [default-exported descriptor-backed course-list plugin definition]
// pos:    [single-entry external plugin definition for the semester course-list widget]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { BookOpenText } from 'lucide-react';

import { definePlugin, definePluginManifest } from '../../plugin-sdk/authoring.ts';

export default definePlugin({
  descriptor: definePluginManifest({
    id: 'course-list',
    display_name: 'Course List',
    author: 'Jinyuan',
    description: 'See every course in a semester and manage the overall roster.',
    long_description:
      'Course List is the central overview for the courses that belong to a semester. It helps users scan what they are taking, keep the roster organized, and manage the overall structure of the term from one place. It is especially useful at the start of a semester, when plans are still changing, and later as a stable overview of the academic load that ties the rest of the workspace together.',
    icon: BookOpenText,
    tabs: [],
    widgets: [
      {
        type: 'course-list',
        title: 'Course List',
        description: 'Review and manage semester courses.',
        icon: BookOpenText,
        contexts: ['semester'],
        layout: {
          w: 3,
          h: 3,
          minW: 2,
          minH: 2,
          maxW: 6,
          maxH: 6,
        },
        max_instances: 1,
      },
    ],
  }),
  loadRuntime: async () => (await import('./index')).default,
});
