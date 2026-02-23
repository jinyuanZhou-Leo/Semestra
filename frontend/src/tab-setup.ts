// input:  [legacy bootstrap callers that still import tab setup readiness]
// output: [always-resolved `tabsReady` Promise]
// pos:    [Backward-compatibility shim after moving to lazy tab plugin loading]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

// Compatibility export: tab plugins are loaded on demand.
export const tabsReady = Promise.resolve();
