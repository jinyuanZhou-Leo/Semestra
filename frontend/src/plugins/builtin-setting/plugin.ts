// input:  [typed plugin manifest helper, settings icon, frontend plugin SDK, and lazy runtime loader]
// output: [default-exported descriptor-backed settings plugin definition]
// pos:    [single-entry host-shell plugin definition that keeps settings metadata inline while deferring runtime loading]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { Settings2 } from 'lucide-react';

import { definePlugin, definePluginManifest } from '../../plugin-sdk/authoring.ts';

export default definePlugin({
  descriptor: definePluginManifest({
    id: 'builtin-setting',
    display_name: 'Settings',
    author: 'Jinyuan',
    description: 'Render the default workspace settings shell.',
    long_description: 'Settings is the host-managed shell tab for workspace configuration.',
    icon: Settings2,
    tabs: [
      {
        type: 'builtin-setting',
        title: 'Settings',
        description: 'Open the host-managed workspace settings surface.',
        icon: Settings2,
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
});
