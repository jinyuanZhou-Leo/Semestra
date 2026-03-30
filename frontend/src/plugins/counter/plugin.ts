// input:  [typed plugin manifest helper, counter icon, frontend plugin SDK, and lazy runtime loader]
// output: [default-exported descriptor-backed counter plugin definition]
// pos:    [single-entry external plugin definition for the counter widget runtime]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { Hash } from 'lucide-react';

import { definePlugin, definePluginManifest } from '../../plugin-sdk/authoring.ts';

export default definePlugin({
  descriptor: definePluginManifest({
    id: 'counter',
    display_name: 'Counter',
    author: 'Jinyuan',
    description: 'Track simple counts with fast manual updates.',
    long_description:
      'Counter is a minimal tool for keeping track of values that change over time and do not need a full spreadsheet or database. It can be used for repetitions, reading progress, task counts, attendance, or any other quick-running total. Its strength is speed: a clear number, quick controls, and almost no overhead between noticing a change and recording it.',
    icon: Hash,
    tabs: [],
    widgets: [
      {
        type: 'counter',
        title: 'Counter',
        description: 'Track simple counts with fast manual updates.',
        icon: Hash,
        contexts: ['semester', 'course'],
        layout: {
          w: 2,
          h: 2,
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
      schema: [],
      panels: [],
    },
  }),
  loadRuntime: async () => (await import('./index')).default,
});
