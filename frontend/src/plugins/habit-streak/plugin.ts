// input:  [typed plugin manifest helper, habit-streak icons, frontend plugin SDK, and lazy runtime loader]
// output: [default-exported descriptor-backed habit-streak plugin definition]
// pos:    [single-entry external plugin definition for habit-streak widget runtime loading]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { CalendarDays, Flame } from 'lucide-react';

import { definePlugin, definePluginManifest } from '../../plugin-sdk/authoring.ts';

export default definePlugin({
  descriptor: definePluginManifest({
    id: 'habit-streak',
    display_name: 'Habit Streak',
    author: 'Jinyuan',
    description: 'Build consistency with simple daily streak tracking.',
    long_description:
      'Habit Streak helps users stay consistent with routines that matter during the semester, whether that means studying, reviewing notes, exercising, or keeping up with personal goals. It turns daily follow-through into a visible pattern, making momentum easier to notice and easier to protect. The experience is intentionally lightweight so habits feel easy to check, easy to maintain, and easy to fit into everyday academic life.',
    icon: Flame,
    tabs: [],
    widgets: [
      {
        type: 'habit-streak-duolingo',
        title: 'Habit Streak Duolingo',
        description: 'Track your streak with the Duolingo-style week board.',
        icon: CalendarDays,
        contexts: ['semester', 'course'],
        layout: {
          w: 4,
          h: 4,
          minW: 2,
          minH: 2,
          maxW: 6,
          maxH: 6,
        },
        max_instances: 'unlimited',
      },
      {
        type: 'habit-streak-ring',
        title: 'Habit Streak Ring',
        description: 'Track a streak with the classic ring view and encouragement feedback.',
        icon: Flame,
        contexts: ['semester', 'course'],
        layout: {
          w: 4,
          h: 4,
          minW: 2,
          minH: 2,
          maxW: 6,
          maxH: 6,
        },
        max_instances: 'unlimited',
      },
    ],
  }),
  loadRuntime: async () => (await import('./index')).default,
});
