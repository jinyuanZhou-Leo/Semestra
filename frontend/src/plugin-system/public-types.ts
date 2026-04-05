// input:  [plugin SDK public types plus internal runtime catalog types]
// output: [stable public plugin-system type exports for app/runtime consumers]
// pos:    [Compatibility type surface for app code that consumes plugin runtime metadata without importing plugin SDK directly]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export type {
  PluginHeaderActionButtonProps as HeaderActionButtonProps,
  PluginHeaderButton as HeaderButton,
  PluginHeaderButtonContext as HeaderButtonContext,
  PluginHeaderButtonRenderHelpers as HeaderButtonRenderHelpers,
  PluginHeaderConfirmActionButtonProps as HeaderConfirmActionButtonProps,
  PluginTabDefinition as TabDefinition,
  PluginTabLifecycleContext as TabLifecycleContext,
  PluginTabProps as TabProps,
  PluginWidgetDefinition as WidgetDefinition,
  PluginWidgetLifecycleContext as WidgetLifecycleContext,
  PluginWidgetProps as WidgetProps,
  PluginWidgetSettingsProps as WidgetSettingsProps,
  PluginWorkspaceContext as TabContext,
  PluginWorkspaceContext as WidgetContext,
  MaxInstances,
} from '@/plugin-sdk';
export type {
  PluginManifestItem,
  ResolvedPluginMetadata,
  TabCatalogItem,
  WidgetCatalogItem,
  WidgetLayoutDefinition,
} from './types';
