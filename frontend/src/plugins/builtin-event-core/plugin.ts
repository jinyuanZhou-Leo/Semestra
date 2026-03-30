// input:  [event-core descriptor/setup schema, existing setup UI definition, frontend plugin SDK, and lazy runtime loader]
// output: [default-exported descriptor-backed event-core plugin definition with schema-driven setup]
// pos:    [builtin plugin entry that binds JSON descriptor/setup schema to runtime loading and custom setup UI]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { definePlugin, defineSetup, type PluginDescriptor, type PluginDescriptorSetupSchema } from '@/plugin-sdk';
import { validatePluginSetupDefinition } from '@/plugin-system/setup';

import descriptorJson from './plugin.json';
import setupSchemaJson from './setup.schema.json';
import setupDefinition from './setup';

const descriptor = descriptorJson as PluginDescriptor;
const setupSchema = setupSchemaJson as PluginDescriptorSetupSchema;

export default definePlugin({
  descriptor,
  loadRuntime: async () => (await import('./index')).default,
  setup: defineSetup({
    schema: setupSchema,
    ui: setupDefinition.ui?.kind === 'custom' ? setupDefinition.ui : undefined,
    validate: async (values) => validatePluginSetupDefinition(setupDefinition, values),
  }),
});
