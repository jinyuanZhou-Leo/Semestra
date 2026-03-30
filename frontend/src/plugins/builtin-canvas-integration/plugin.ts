// input:  [typed plugin manifest helper, Canvas asset path, frontend plugin SDK, and lazy runtime loader]
// output: [default-exported descriptor-backed canvas integration plugin definition]
// pos:    [single-entry builtin plugin definition that keeps Canvas metadata inline while deferring runtime loading]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { definePlugin, definePluginManifest } from '../../plugin-sdk/authoring.ts';

export default definePlugin({
  descriptor: definePluginManifest({
    id: 'builtin-canvas-integration',
    display_name: 'Canvas Integration',
    author: 'Jinyuan',
    description: 'Browse Canvas course content without leaving the workspace.',
    long_description:
      'Canvas Integration brings supported Canvas course content into Semestra so students can stay in one workflow while reviewing materials, checking course pages, and following the structure of a class. It keeps familiar Canvas navigation close at hand, opens linked content in context, and reduces the friction of bouncing between systems during study sessions. The goal is straightforward: make course content easier to reach, easier to browse, and easier to follow while working inside Semestra.',
    icon: '@/assets/canvas-icon.png',
    tabs: [
      {
        type: 'builtin-canvas-integration',
        title: 'Canvas',
        description: 'Browse Canvas course content in-app.',
        icon: '@/assets/canvas-icon.png',
        contexts: ['course'],
      },
    ],
    widgets: [],
    settings: {
      defaults: {},
      schema: [],
      panels: [],
    },
  }),
  loadRuntime: async () => (await import('./index')).default,
});
