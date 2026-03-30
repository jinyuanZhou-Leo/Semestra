// input:  [course-resources descriptor, frontend plugin SDK, and lazy runtime loader]
// output: [default-exported descriptor-backed course-resources plugin definition]
// pos:    [descriptor-backed external plugin entry for course resources runtime loading]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { definePlugin, type PluginDescriptor } from '@/plugin-sdk';

import descriptorJson from './plugin.json';

const descriptor = descriptorJson as PluginDescriptor;

export default definePlugin({
  descriptor,
  loadRuntime: async () => (await import('./index')).default,
});
