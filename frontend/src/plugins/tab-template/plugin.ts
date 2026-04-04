// input:  [typed plugin manifest/setup helpers, tab-template icon, plugin-owned setup definition, frontend plugin SDK, and lazy runtime loader]
// output: [default-exported descriptor-backed tab-template plugin definition with setup flow]
// pos:    [single-entry external plugin definition for the template tab runtime and wizard setup integration sourced directly from setup.tsx]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { PanelsTopLeft } from 'lucide-react';

import { createPluginSetupBinding, definePlugin, definePluginManifest } from '../../plugin-sdk/authoring.ts';

import settingsDefinition from './settings.tsx';
import setupDefinition from './setup.tsx';

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
      panels: [
        {
          id: 'template-settings',
          contexts: ['program', 'semester', 'course'],
        },
      ],
    },
  }),
  loadRuntime: async () => (await import('./index')).default,
  settingsDefinition,
  setup: createPluginSetupBinding(setupDefinition),
});
