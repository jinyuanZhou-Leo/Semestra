// input:  [typed plugin manifest helper, world-clock icon, frontend plugin SDK, and lazy runtime loader]
// output: [default-exported descriptor-backed world-clock plugin definition]
// pos:    [single-entry external plugin definition for the world-clock widget runtime]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { Clock3 } from 'lucide-react';

import { definePlugin, definePluginManifest } from '../../plugin-sdk/authoring.ts';

export default definePlugin({
  descriptor: definePluginManifest({
    id: 'world-clock',
    display_name: 'World Clock',
    author: 'Jinyuan',
    description: 'Track time across cities and time zones at a glance.',
    long_description:
      'World Clock makes it easy to stay aware of multiple time zones while studying, collaborating, or planning across regions. It is useful for international students, remote teammates, and anyone balancing classes or meetings across different locations. The experience focuses on fast recognition, so users can check the time they need without extra setup, extra context switching, or mental math.',
    icon: Clock3,
    tabs: [],
    widgets: [
      {
        type: 'world-clock',
        title: 'World Clock',
        description: 'Displays current time in a specific timezone.',
        icon: Clock3,
        contexts: ['semester', 'course'],
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
    settings: {
      defaults: {},
      fields: [],
      sections: [],
    },
  }),
  loadRuntime: async () => (await import('./index')).default,
});
