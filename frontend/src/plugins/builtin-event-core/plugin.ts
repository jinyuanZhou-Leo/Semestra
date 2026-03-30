// input:  [typed plugin manifest/setup helpers, event-core icons, existing setup UI definition, frontend plugin SDK, and lazy runtime loader]
// output: [default-exported descriptor-backed event-core plugin definition with schema-driven setup]
// pos:    [single-entry builtin plugin definition that keeps event-core metadata and setup schema inline]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { CalendarDays, Clock3, ListTodo, NotebookPen } from 'lucide-react';

import { definePlugin, definePluginManifest, definePluginSetupSchema, defineSetup } from '../../plugin-sdk/authoring.ts';
import { validatePluginSetupDefinition } from '../../plugin-system/setup.ts';

import setupDefinition from './setup.tsx';

const setupSchema = definePluginSetupSchema({
  sections: [
    {
      id: 'calendar-default-view',
      title: 'Calendar Setup',
      description: 'Choose the default Calendar view for this Semester.',
      fields: [
        {
          path: 'calendarDefaultView',
          label: 'Calendar default view',
          type: 'select',
          persist: 'both',
          required: true,
          description: 'Choose the initial Calendar view for this Semester.',
          default_value: 'month',
          options: [
            { label: 'Month', value: 'month' },
            { label: 'Week', value: 'week' },
          ],
          summary_labels: {
            month: 'Month',
            week: 'Week',
          },
        },
      ],
    },
    {
      id: 'event-type-setup',
      title: 'Event Types',
      description: 'Configure the default event-type catalog for course scheduling.',
      fields: [
        {
          path: 'eventTypes',
          label: 'Default event types',
          type: 'json',
          persist: 'setupState',
          required: false,
          description: 'Configure the event types that this Semester should start with.',
          default_value: [
            {
              id: 'builtin-lecture',
              code: 'LECTURE',
              abbreviation: 'LEC',
              track_attendance: false,
              color: null,
              icon: null,
            },
            {
              id: 'builtin-practical',
              code: 'PRACTICAL',
              abbreviation: 'PRA',
              track_attendance: false,
              color: null,
              icon: null,
            },
            {
              id: 'builtin-tutorial',
              code: 'TUTORIAL',
              abbreviation: 'TUT',
              track_attendance: false,
              color: null,
              icon: null,
            },
          ],
        },
      ],
    },
  ],
  validation_rules: [
    {
      type: 'json-array-min-length',
      field: 'eventTypes',
      min_length: 1,
      message: 'Add at least one event type before continuing.',
    },
    {
      type: 'json-array-unique-keys',
      field: 'eventTypes',
      keys: ['code', 'abbreviation'],
      message: 'Event type names and abbreviations must be unique.',
    },
  ],
});

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
      defaults: {
        syncLmsCalendar: true,
        calendarDefaultView: 'month',
      },
      fields: [
        {
          path: 'syncLmsCalendar',
          label: 'Sync LMS calendar',
          type: 'boolean',
          scope: 'program-only',
          default: true,
          description: 'Allow Semesters to merge LMS events into Calendar when the Program has LMS configured.',
        },
        {
          path: 'calendarDefaultView',
          label: 'Calendar default view',
          type: 'select',
          scope: 'semester-override',
          default: 'month',
          description: 'Choose the initial Calendar view for this Semester.',
          options: [
            { label: 'Month', value: 'month' },
            { label: 'Week', value: 'week' },
          ],
        },
      ],
      sections: [],
    },
  }),
  loadRuntime: async () => (await import('./index')).default,
  setup: defineSetup({
    schema: setupSchema,
    ui: setupDefinition.ui?.kind === 'custom' ? setupDefinition.ui : undefined,
    validate: async (values) => validatePluginSetupDefinition(setupDefinition, values),
  }),
});
