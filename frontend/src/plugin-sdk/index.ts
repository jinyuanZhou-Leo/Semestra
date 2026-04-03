// input:  [typed plugin authoring helpers, host/runtime helper modules, and host-owned setup form primitives]
// output: [single public plugin SDK entrypoint that re-exports shared authoring helpers plus host/runtime utilities]
// pos:    [Stable frontend plugin SDK facade that keeps plugin authors on one import surface while delegating helper implementations to authoring.ts]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export type * from './types';
export {
  createPluginSetupBinding,
  definePlugin,
  definePluginSetup,
  definePluginManifest,
  definePluginRuntime,
  definePluginSettings,
  definePluginSetupSchema,
  defineSettingsSection,
  defineSetup,
  defineTab,
  defineWidget,
  PluginSetupBooleanField,
  PluginSetupDateField,
  PluginSetupJsonField,
  PluginSetupNumberField,
  PluginSetupSection,
  PluginSetupSelectField,
  PluginSetupTextField,
  PluginSetupTextareaField,
} from './authoring.ts';
export type { MaxInstances } from './manifest-types.ts';

export {
  PluginSetupFormField,
  PluginSetupFormReviewItem,
  PluginSetupFormSection,
  PluginSetupFormSurface,
} from "@/components/PluginSetupForm";
export {
  PluginSettingsBooleanField,
  PluginSettingsDateField,
  PluginSettingsFieldLabelRow,
  PluginSettingsJsonField,
  PluginSettingsNumberField,
  PluginSettingsSelectField,
  PluginSettingsTextField,
  PluginSettingsTextareaField,
  PluginSettingsBucketSourceBanner,
  usePluginSettingField,
  usePluginSettingsBucket,
} from "@/plugin-system/pluginSettingsFields";
export type { PluginSettingsFieldLabelRowProps } from "@/plugin-system/pluginSettingsFields";
export { usePluginSettingsContext } from "@/plugin-system/pluginSettingsPanelContext";
export { PluginHostProvider, usePluginHost } from '@/plugin-system/PluginHostContext';
export type {
  PluginHostJumpOptions,
  PluginHostJumpResult,
  PluginHostJumpTarget,
  PluginHostTabLike,
} from '@/plugin-system/PluginHostContext';
export {
  PluginRuntimeInstanceProvider,
  buildPluginUiStateStorageKey,
  usePluginRuntimeInstanceContext as usePluginRuntimeInstance,
} from '@/plugin-system/PluginRuntimeInstanceContext';
export type {
  PluginRuntimeInstanceValue,
  PluginRuntimeSlotKind,
  PluginRuntimeWorkspaceKind,
} from '@/plugin-system/PluginRuntimeInstanceContext';
export {
  PluginContentFadeIn,
  PluginTabSkeleton,
  PluginWidgetSkeleton,
} from '@/plugin-system/PluginLoadSkeleton';
export { resetPluginUiStateCacheForTests, usePluginUiState } from '@/plugin-system/PluginUiState';
