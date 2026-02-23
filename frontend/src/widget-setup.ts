// input:  [legacy bootstrap callers that still import widget setup readiness]
// output: [always-resolved `widgetsReady` Promise]
// pos:    [Backward-compatibility shim after moving to lazy widget plugin loading]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

// Compatibility export: widget plugins are loaded on demand.
export const widgetsReady = Promise.resolve();
