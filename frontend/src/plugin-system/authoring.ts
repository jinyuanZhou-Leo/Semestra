// input:  [plugin declaration contracts, setup authoring contracts, and setup validation helpers]
// output: [curated plugin authoring exports for metadata, runtime, settings sections, and setup definitions]
// pos:    [Thin plugin authoring surface that groups stable declaration APIs so plugin authors do not import internal loader or registry details]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export type { PluginMetadataDefinition, PluginRuntimeDefinition, PluginSettingsDefinition } from './contracts';
export { definePluginMetadata, definePluginRuntime, definePluginSettings } from './contracts';
export type {
  HeaderActionButtonProps,
  HeaderButton,
  HeaderButtonContext,
  HeaderButtonRenderHelpers,
  HeaderConfirmActionButtonProps,
  MaxInstances,
  PluginManifestItem,
  ResolvedPluginMetadata,
  TabCatalogItem,
  TabContext,
  TabDefinition,
  TabLifecycleContext,
  TabProps,
  TabSettingsProps,
  WidgetCatalogItem,
  WidgetContext,
  WidgetDefinition,
  WidgetLayoutDefinition,
  WidgetLifecycleContext,
  WidgetProps,
  WidgetSettingsProps,
} from './public-types';

export type {
  InferPluginSetupValues,
  PluginSetupCustomUiDefinition,
  PluginSetupDefinition,
  PluginSetupFieldDefinition,
  PluginSetupFieldType,
  PluginSetupPersist,
  PluginSetupRenderDefinition,
  PluginSetupReviewRenderProps,
  PluginSetupReviewSummaryItem,
  PluginSetupReviewSummarySection,
  PluginSetupSectionDefinition,
  PluginSetupUiDefinition,
  PluginSetupValidationContext,
  PluginSetupValidationIssue,
  PluginSetupValidator,
  PluginSetupWizardRenderProps,
} from './setup';
export {
  booleanField,
  dateField,
  definePluginSetup,
  jsonField,
  numberField,
  resolvePluginSetupValues,
  section,
  selectField,
  textField,
  textareaField,
  validatePluginSetupDefinition,
} from './setup';
