// input:  [typed plugin manifest helper, gradebook icons, existing settings sections export, frontend plugin SDK, and lazy runtime loader]
// output: [default-exported descriptor-backed gradebook plugin definition]
// pos:    [single-entry builtin plugin definition that keeps gradebook metadata inline and binds Program defaults plus course settings sections]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { BookOpenCheck, NotebookTabs } from 'lucide-react';

import { definePlugin, definePluginManifest } from '../../plugin-sdk/authoring.ts';

import settingsDefinition from './settings.tsx';

export default definePlugin({
  descriptor: definePluginManifest({
    id: 'builtin-gradebook',
    display_name: 'Gradebook',
    author: 'Jinyuan',
    description: 'Track assessments, understand progress, and plan toward targets.',
    long_description:
      'Gradebook gives each course a clear place to record assessments, enter scores, and understand how every result affects the overall picture. It supports ongoing progress checks, target setting, and what-if planning so students can see where they stand before final grades are locked in. The experience is built for day-to-day academic decision making, helping users connect effort, weighting, and expected outcomes with less guesswork.',
    icon: NotebookTabs,
    tabs: [
      {
        type: 'builtin-gradebook',
        title: 'Gradebook',
        description: 'Track assessments and grade projections for this course.',
        icon: NotebookTabs,
        contexts: ['course'],
      },
    ],
    widgets: [
      {
        type: 'builtin-gradebook-summary',
        title: 'Gradebook Summary',
        description: 'See a quick grade summary for this course.',
        icon: BookOpenCheck,
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
    settings: {
      panels: [
        {
          id: 'gradebook-defaults',
          contexts: ['program'],
        },
        {
          id: 'gradebook-forecast-and-categories',
          contexts: ['course'],
        },
      ],
    },
  }),
  loadRuntime: async () => (await import('./index')).default,
  settingsDefinition,
});
