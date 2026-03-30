// input:  [plugin host navigation context, runtime instance scope context, plugin-local UI-state helpers, and lazy-load skeleton components]
// output: [curated host API exports for plugin runtime navigation, instance scope, UI-state caching, and loading shells]
// pos:    [Thin host-facing public surface that exposes stable runtime APIs without leaking plugin loader implementation details]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export { PluginHostProvider, usePluginHost } from './PluginHostContext';
export type {
  PluginHostJumpOptions,
  PluginHostJumpResult,
  PluginHostJumpTarget,
  PluginHostTabLike,
} from './PluginHostContext';

export { PluginRuntimeInstanceProvider, usePluginRuntimeInstanceContext } from './PluginRuntimeInstanceContext';
export type {
  PluginRuntimeInstanceValue,
  PluginRuntimeSlotKind,
  PluginRuntimeWorkspaceKind,
} from './PluginRuntimeInstanceContext';
export { buildPluginUiStateStorageKey } from './PluginRuntimeInstanceContext';

export { resetPluginUiStateCacheForTests, usePluginUiState } from './PluginUiState';
export { PluginContentFadeIn, PluginTabSkeleton, PluginWidgetSkeleton } from './PluginLoadSkeleton';
