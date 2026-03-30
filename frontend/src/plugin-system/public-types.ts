// input:  [tab/widget runtime registry type contracts, plugin manifest/catalog types, and max-instance utility types]
// output: [stable public plugin-system type exports for plugin authoring and runtime implementation]
// pos:    [Public type surface that lets plugin authors consume runtime, catalog, and settings contracts from `@/plugin-system` instead of service-registry internals]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export type {
  TabContext,
  TabDefinition,
  TabLifecycleContext,
  TabProps,
  TabSettingsProps,
} from '../services/tabRegistry';
export type {
  HeaderActionButtonProps,
  HeaderButton,
  HeaderButtonContext,
  HeaderButtonRenderHelpers,
  HeaderConfirmActionButtonProps,
  WidgetContext,
  WidgetDefinition,
  WidgetLifecycleContext,
  WidgetProps,
  WidgetSettingsProps,
} from '../services/widgetRegistry';
export type { MaxInstances } from './utils';
export type {
  PluginManifestItem,
  ResolvedPluginMetadata,
  TabCatalogItem,
  WidgetCatalogItem,
  WidgetLayoutDefinition,
} from './types';
