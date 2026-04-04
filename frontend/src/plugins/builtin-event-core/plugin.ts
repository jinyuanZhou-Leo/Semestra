// input:  [typed plugin manifest/setup helpers, event-core icons, existing setup/settings UI definitions, frontend plugin SDK, and lazy runtime loader]
// output: [default-exported descriptor-backed event-core plugin definition with schema-driven setup plus Program- and Semester-level plugin settings panels]
// pos:    [single-entry builtin plugin definition that keeps event-core metadata aligned to the plugin-owned setup.tsx and settings.tsx sources of truth]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { CalendarDays, Clock3, ListTodo, NotebookPen } from 'lucide-react';

import { createPluginSetupBinding, definePlugin, definePluginManifest } from '../../plugin-sdk/authoring.ts';

import settingsDefinition from './settings.tsx';
import setupDefinition from './setup.tsx';

export default definePlugin({
  descriptor: definePluginManifest({
    id: 'builtin-event-core',
    display_name: 'Builtin Event Core',
    author: 'Jinyuan',
    description: 'Plan schedules, deadlines, and daily workload across courses.',
    long_description:
      'Academic Events brings the core planning experience of Semestra into one place. It helps users organize class schedules, review calendars, manage upcoming work, and keep track of what needs attention today across both semester and course workflows. Instead of splitting time management across separate tools, it keeps the moving pieces of academic life connected so planning, scheduling, and daily follow-through feel like part of the same system.',
    icon: CalendarDays,
    tabs: [
      {
        type: 'builtin-academic-calendar',
        title: 'Calendar',
        description: 'Review semester events and deadlines on a calendar.',
        icon: CalendarDays,
        contexts: ['semester'],
      },
      {
        type: 'builtin-course-schedule',
        title: 'Course Schedule',
        description: 'Manage course schedule details.',
        icon: NotebookPen,
        contexts: ['course'],
      },
      {
        type: 'builtin-todo',
        title: 'Todo',
        description: 'Track upcoming work across the workspace.',
        icon: ListTodo,
        contexts: ['semester', 'course'],
      },
    ],
    widgets: [
      {
        type: 'builtin-today-events',
        title: 'Today Events',
        description: "See today's schedule and upcoming event summary.",
        icon: Clock3,
        contexts: ['semester', 'course'],
        layout: {
          w: 4,
          h: 4,
          minW: 2,
          minH: 2,
          maxW: 6,
          maxH: 6,
        },
        max_instances: 1,
      },
    ],
    settings: {
      panels: [
        {
          id: 'semester-calendar',
          contexts: ['semester'],
        },
        {
          id: 'todo-defaults',
          contexts: ['program', 'semester', 'course'],
        },
        {
          id: 'semester-event-types',
          contexts: ['semester', 'course'],
        },
      ],
    },
  }),
  loadRuntime: async () => (await import('./index')).default,
  settingsDefinition,
  setup: createPluginSetupBinding(setupDefinition),
});
