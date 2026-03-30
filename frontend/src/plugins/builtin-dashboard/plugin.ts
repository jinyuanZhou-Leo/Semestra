// input:  [typed plugin manifest helper, dashboard icon, frontend plugin SDK, and lazy runtime loader]
// output: [default-exported descriptor-backed dashboard plugin definition]
// pos:    [single-entry host-shell plugin definition that keeps dashboard metadata inline while deferring runtime loading]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { LayoutDashboard } from 'lucide-react';

import { definePlugin, definePluginManifest } from '../../plugin-sdk/authoring.ts';

export default definePlugin({
  descriptor: definePluginManifest({
    id: 'builtin-dashboard',
    display_name: 'Dashboard',
    author: 'Jinyuan',
    description: 'Render the default workspace overview shell.',
    long_description: 'Dashboard is the host-managed overview surface for semester and course workspaces.',
    icon: LayoutDashboard,
    tabs: [
      {
        type: 'builtin-dashboard',
        title: 'Dashboard',
        description: 'Open the host-managed workspace dashboard.',
        icon: LayoutDashboard,
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
