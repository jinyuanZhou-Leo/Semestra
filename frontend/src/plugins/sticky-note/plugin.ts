// input:  [typed plugin manifest helper, sticky-note icon, frontend plugin SDK, and lazy runtime loader]
// output: [default-exported descriptor-backed sticky-note plugin definition]
// pos:    [single-entry external plugin definition for sticky-note runtime loading]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { StickyNote } from 'lucide-react';

import { definePlugin, definePluginManifest } from '../../plugin-sdk/authoring.ts';

export default definePlugin({
  descriptor: definePluginManifest({
    id: 'sticky-note',
    display_name: 'Sticky Note',
    author: 'Jinyuan',
    description: 'Capture quick ideas, reminders, and scratch notes instantly.',
    long_description:
      'Sticky Note is a lightweight place for thoughts that are useful now but do not need full structure. It works well for reminders, rough plans, short checklists, temporary references, or anything that should remain visible while studying. The goal is immediacy: open it, write something down, and keep moving without turning a small thought into a larger workflow.',
    icon: StickyNote,
    tabs: [],
    widgets: [
      {
        type: 'sticky-note',
        title: 'Sticky Note',
        description: 'Quickly capture short notes directly on your dashboard.',
        icon: StickyNote,
        contexts: ['semester', 'course'],
        layout: {
          w: 2,
          h: 2,
          minW: 1,
          minH: 1,
          maxW: 5,
          maxH: 5,
        },
        max_instances: 'unlimited',
      },
    ],
    settings: {
      defaults: {},
      schema: [],
      panels: [],
    },
  }),
  loadRuntime: async () => (await import('./index')).default,
});
