// input:  [typed plugin manifest helper, pomodoro icon, frontend plugin SDK, and lazy runtime loader]
// output: [default-exported descriptor-backed pomodoro plugin definition]
// pos:    [single-entry external plugin definition for pomodoro runtime loading]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { Timer } from 'lucide-react';

import { definePlugin, definePluginManifest } from '../../plugin-sdk/authoring.ts';

export default definePlugin({
  descriptor: definePluginManifest({
    id: 'pomodoro',
    display_name: 'Pomodoro',
    author: 'Jinyuan',
    description: 'Stay focused with structured work and break sessions.',
    long_description:
      'Pomodoro supports focused study sessions with a simple rhythm of work periods and breaks. It is meant for people who want help starting deep work, maintaining concentration, and avoiding burnout during longer blocks of study. By keeping timing close to the rest of the workspace, it becomes easier to move from planning into action without switching tools or losing momentum.',
    icon: Timer,
    tabs: [],
    widgets: [
      {
        type: 'pomodoro',
        title: 'Pomodoro Timer',
        description: 'Focus timer with auto-switch between focus and break sessions.',
        icon: Timer,
        contexts: ['semester', 'course'],
        layout: {
          w: 4,
          h: 4,
          minW: 3,
          minH: 3,
          maxW: 6,
          maxH: 8,
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
