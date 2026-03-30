// input:  [typed plugin manifest/setup helpers, tab-template icon, custom setup definition, frontend plugin SDK, and lazy runtime loader]
// output: [default-exported descriptor-backed tab-template plugin definition with setup flow]
// pos:    [single-entry external plugin definition for the template tab runtime and wizard setup integration]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { PanelsTopLeft } from 'lucide-react';

import { definePlugin, definePluginManifest, definePluginSetupSchema, defineSetup } from '../../plugin-sdk/authoring.ts';
import { validatePluginSetupDefinition } from '../../plugin-system/setup.ts';

import setupDefinition from './setup.tsx';

const setupSchema = definePluginSetupSchema({
  sections: [
    {
      id: 'template-setup',
      title: 'Content',
      description: 'Set up the core content and cadence for this template workspace.',
      fields: [
        {
          path: 'initialTitle',
          label: 'Initial title',
          type: 'text',
          persist: 'setupState',
          required: true,
          default_value: 'Tab Template',
          description: 'Choose the title shown when the template tab first opens.',
          placeholder: 'Prototype workspace title',
        },
        {
          path: 'initialNote',
          label: 'Starter note',
          type: 'textarea',
          persist: 'setupState',
          required: false,
          default_value: '',
          description: 'Seed the persistent note area with starter content for this Semester.',
          placeholder: 'Add a short note that explains what this prototype is for.',
        },
        {
          path: 'focusMinutes',
          label: 'Default focus session (minutes)',
          type: 'number',
          persist: 'both',
          required: true,
          default_value: 45,
          description: 'Pick the default focus block length suggested by this template.',
          placeholder: '45',
        },
        {
          path: 'kickoffDate',
          label: 'Kickoff date',
          type: 'date',
          persist: 'semesterOverride',
          required: true,
          default_value: '2026-01-12',
          description: 'Set the first day this prototype should be considered active in the Semester.',
        },
      ],
    },
    {
      id: 'template-behavior',
      title: 'Behavior',
      description: 'Choose how the template behaves when users first open it.',
      fields: [
        {
          path: 'showChecklist',
          label: 'Show starter checklist',
          type: 'boolean',
          persist: 'setupState',
          required: false,
          default_value: true,
          description: 'Keep the onboarding checklist visible when the tab is first used.',
        },
        {
          path: 'defaultView',
          label: 'Default opening surface',
          type: 'select',
          persist: 'both',
          required: true,
          default_value: 'notes',
          description: 'Choose which part of the template should be emphasized first.',
          options: [
            { label: 'Notes', value: 'notes' },
            { label: 'Checklist', value: 'checklist' },
            { label: 'Timeline', value: 'timeline' },
          ],
          summary_labels: {
            notes: 'Notes',
            checklist: 'Checklist',
            timeline: 'Timeline',
          },
        },
      ],
    },
    {
      id: 'template-blocks',
      title: 'Starter Blocks',
      description: 'Seed a few starter blocks to demonstrate the JSON field workflow.',
      fields: [
        {
          path: 'starterBlocks',
          label: 'Starter blocks',
          type: 'json',
          persist: 'setupState',
          required: true,
          default_value: [
            {
              id: 'overview',
              label: 'Overview',
              kind: 'notes',
            },
            {
              id: 'tasks',
              label: 'Tasks',
              kind: 'checklist',
            },
          ],
          description: 'Configure the starter blocks that should seed this tab when it is first used.',
          placeholder: '[\n  {\n    "id": "overview",\n    "label": "Overview",\n    "kind": "notes"\n  }\n]',
        },
      ],
    },
  ],
  validation_rules: [
    {
      type: 'json-array-min-length',
      field: 'starterBlocks',
      min_length: 1,
      message: 'Add at least one starter block before continuing.',
    },
    {
      type: 'json-array-unique-keys',
      field: 'starterBlocks',
      keys: ['id', 'label'],
      message: 'Starter block ids and labels must be unique.',
    },
  ],
});

export default definePlugin({
  descriptor: definePluginManifest({
    id: 'tab-template',
    display_name: 'Tab Template',
    author: 'Jinyuan',
    description: 'Prototype new workspace experiences and interaction patterns.',
    long_description:
      'Tab Template is a development-oriented starting point for building new workspace experiences inside Semestra. It gives plugin authors a clean reference for structure, settings flow, and host integration so ideas can move from experiment to implementation quickly. It is most useful when exploring new product directions or validating a concept before investing in a more complete build.',
    icon: PanelsTopLeft,
    tabs: [
      {
        type: 'tab-template',
        title: 'Tab Template',
        description: 'Starter tab with editable settings and layout scaffolding.',
        icon: PanelsTopLeft,
        contexts: ['semester', 'course'],
      },
    ],
    widgets: [],
    settings: {
      defaults: {},
      fields: [],
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
