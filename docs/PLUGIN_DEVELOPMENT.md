# Plugin Development Guide

This guide describes the plugin model that is actually implemented in Semestra today.

The current rules are:

- `plugin.ts` is the single plugin authoring entry
- runtime code is still lazy-loaded from `index.ts`
- `setup.tsx` is the single source of truth for Semester setup
- setup writes directly into plugin-owned settings buckets
- settings buckets are keyed by `settings_key`, not by runtime `tab_type`
- `settings.tsx` owns host-rendered Program/Semester/Course settings sections

If an older doc mentions handwritten `plugin.json`, handwritten `setup.schema.json`, `setup_state`, or `tab_type`-owned plugin settings, treat that as obsolete.

## 1. Mental Model

A plugin has four separate concerns:

1. descriptor
2. runtime
3. setup
4. host policy

Keep these separate.

### 1.1 Descriptor

The descriptor is static metadata authored in `plugin.ts`.

It declares:

- plugin identity
- tab catalog entries
- widget catalog entries
- host-rendered settings panel bindings

The descriptor is serialized by the frontend build into:

- `backend/generated/plugin-manifests/*.plugin.json`
- optional `backend/generated/plugin-manifests/*.setup.schema.json`

Plugin authors do not hand-edit those generated files.

### 1.2 Runtime

The runtime is the lazy frontend implementation loaded from `index.ts`.

It declares:

- tab runtime definitions
- widget runtime definitions
- runtime instance defaults
- runtime instance settings components
- lifecycle hooks

### 1.3 Setup

Setup is the Create Semester wizard surface.

It is authored in `setup.tsx`, not in backend code and not in a handwritten JSON schema.

Each setup field declares a `settingsKey`, and the host writes setup values directly into semester-scoped `tab_settings` under that key.

Setup is not a separate persistence model anymore.

### 1.4 Host policy

Host policy remains private and host-owned.

It lives in:

- `frontend/src/plugins/host-policy.json`

It controls host-only concepts such as:

- builtin vs external
- host-shell tabs
- hidden vs public visibility
- install/lock policy

## 2. Recommended File Structure

```text
frontend/src/plugins/<plugin-id>/
  plugin.ts
  index.ts
  tab.tsx
  widget.tsx
  settings.tsx
  setup.tsx
  shared.ts
```

Not every file is required.

### Required files

- `plugin.ts`
- `index.ts`

### Optional files

- `tab.tsx`
- `widget.tsx`
- `settings.tsx`
- `setup.tsx`
- `shared.ts`

### Ownership by file

| File | Responsibility | Notes |
|------|------|-------------|
| `plugin.ts` | Static authoring entry | Descriptor, lazy runtime loader, optional settings-section bindings, optional setup binding |
| `index.ts` | Lazy runtime entry | Registers tabs/widgets with the SDK |
| `tab.tsx` | Tab runtime UI | Optional |
| `widget.tsx` | Widget runtime UI | Optional |
| `settings.tsx` | Host-rendered settings sections | Optional; plugin owns persistence logic |
| `setup.tsx` | Semester setup source of truth | Optional; host renders fields from this definition and backend consumes the generated schema |
| `shared.ts` | Local shared helpers and types | Optional |

## 3. Public Authoring Surface

Import plugin authoring APIs from `@/plugin-sdk` or `@/plugin-sdk/authoring.ts`.

Most plugin runtime code should use:

- `definePlugin`
- `definePluginRuntime`
- `defineTab`
- `defineWidget`
- `definePluginSettings`
- `defineSettingsSection`
- `definePluginSetup`
- `createPluginSetupBinding`
- `usePluginSettingsBucket`
- `usePluginSettingField`
- `usePluginHost`
- `usePluginRuntimeInstance`
- `usePluginUiState`

Do not import internal registries or loader code from `plugin-system` internals.

## 4. `plugin.ts`

`plugin.ts` is the single source of truth for plugin authoring.

It should declare:

- `descriptor`
- `loadRuntime`
- optional `settingsSections`
- optional `setup`

Minimal example:

```ts
import { PanelsTopLeft } from "lucide-react";

import {
  createPluginSetupBinding,
  definePlugin,
  definePluginManifest,
} from "@/plugin-sdk/authoring.ts";

import setupDefinition from "./setup.tsx";

export default definePlugin({
  descriptor: definePluginManifest({
    id: "example-plugin",
    display_name: "Example Plugin",
    author: "Your Name",
    description: "Short description.",
    long_description: "Longer description shown by the host.",
    icon: PanelsTopLeft,
    tabs: [
      {
        type: "example-tab",
        title: "Example",
        description: "Example tab.",
        icon: PanelsTopLeft,
        contexts: ["semester", "course"],
      },
    ],
    widgets: [],
    settings: {
      panels: [
        {
          id: "example-semester-settings",
          contexts: ["semester"],
        },
      ],
    },
  }),
  loadRuntime: async () => (await import("./index")).default,
  setup: createPluginSetupBinding(setupDefinition),
});
```

### 4.1 Descriptor rules

The descriptor declares public metadata only:

- `id`
- `display_name`
- `author`
- `description`
- `long_description`
- `icon`
- `tabs`
- `widgets`
- optional `settings.panels`

It does not declare runtime React components.

### 4.2 `settings.panels` rule

If a plugin renders a host settings section from `settings.tsx`, every section id must also be declared in `descriptor.settings.panels`.

That declaration is required because the descriptor is what the host validates and exposes before the lazy runtime loads.

If a section exists in `settings.tsx` but is missing from `settings.panels`, plugin validation fails.

## 4.3 Common settings-field templates

`settings.tsx` plugin panels can now use host-provided bound field templates from `@/plugin-sdk` for common field shapes:

- `PluginSettingsTextField`
- `PluginSettingsTextareaField`
- `PluginSettingsNumberField`
- `PluginSettingsBooleanField`
- `PluginSettingsSelectField`
- `PluginSettingsDateField`
- `PluginSettingsJsonField`

These components are frontend-only helpers for host-rendered Program/Semester/Course plugin settings panels.

They:

- bind directly to a `settingsKey` bucket in the current scope
- read the resolved value for one `fieldPath`
- write back through the existing `tab_settings` endpoints
- show inline `Modified in ...` hints
- expose the matching reset action automatically

For custom layouts, plugin authors can drop to:

- `usePluginSettingsBucket(settingsKey)`
- `usePluginSettingField(settingsKey, fieldPath)`

Those hooks expose the same bucket, source, update, and reset behavior without forcing the default inline field layout.

## 5. `index.ts`

`index.ts` is the lazy runtime entry.

Example:

```ts
import { definePluginRuntime } from "@/plugin-sdk";

import { ExampleTabDefinition } from "./tab";

export default definePluginRuntime({
  tabDefinitions: [ExampleTabDefinition],
});
```

Put runtime-only concerns here:

- tab definitions
- widget definitions
- runtime hooks
- runtime defaults
- runtime settings components

Do not duplicate descriptor metadata here.

## 6. Runtime Files

Runtime UI usually lives in:

- `tab.tsx`
- `widget.tsx`

Use:

- `usePluginHost()` for host-controlled jumps or confirmations
- `usePluginRuntimeInstance()` for current slot/scope context
- `usePluginUiState()` for browser-local transient state

Use plugin UI state only for non-authoritative local state such as:

- expanded rows
- local filters
- unsaved view preferences
- temporary drafts that do not need backend persistence

Do not use plugin UI state for domain data or authoritative settings.

## 7. Settings Model

There are two different settings categories in the current plugin model.

### 7.1 Plugin-scoped settings buckets

Persistent plugin configuration is stored in `tab_settings`, but the bucket identity is generic `settings_key`, not runtime `tab_type`.

That means:

- one plugin can own multiple settings buckets
- a plugin can also use one shared bucket across multiple tabs
- the bucket structure is plugin-defined JSON

The host only owns:

- scope storage
- inheritance resolution
- settings metadata
- reset-to-parent/default behavior

The plugin owns the JSON shape inside each bucket.

### 7.2 Runtime instance settings

Tab and widget runtime definitions may still have instance settings such as:

- a specific tab instance's local settings
- a specific widget instance's local settings

Those belong to runtime definitions, not to setup authoring.

## 8. `settings.tsx`

`settings.tsx` is optional.

Use it when the plugin wants the host to render plugin-owned settings sections inside:

- Program settings
- Semester settings
- Course settings

Example:

```ts
import {
  definePluginSettings,
  defineSettingsSection,
  type PluginSettingsSectionProps,
} from "@/plugin-sdk";

const ExampleSemesterSettings = ({ scope }: PluginSettingsSectionProps) => {
  if (scope.kind !== "semester") return null;
  return <div>Semester settings for {scope.semesterId}</div>;
};

export default definePluginSettings({
  pluginSettings: [
    defineSettingsSection({
      id: "example-semester-settings",
      component: ExampleSemesterSettings,
      allowedContexts: ["semester"],
    }),
  ],
});
```

Rules:

- the host renders the shell
- the plugin renders the section body
- the plugin owns persistence logic
- the section id must exist in `descriptor.settings.panels`

## 9. `setup.tsx`

`setup.tsx` is the single source of truth for Semester setup.

It is authored with host-provided field components such as:

- `PluginSetupSection`
- `PluginSetupTextField`
- `PluginSetupTextareaField`
- `PluginSetupNumberField`
- `PluginSetupBooleanField`
- `PluginSetupSelectField`
- `PluginSetupDateField`
- `PluginSetupJsonField`

Example:

```tsx
import {
  definePluginSetup,
  PluginSetupSection,
  PluginSetupTextField,
  PluginSetupBooleanField,
} from "@/plugin-sdk";

export default definePluginSetup({
  content: (
    <PluginSetupSection
      id="example-setup"
      title="Example Setup"
      description="Collect the initial plugin settings for this Semester."
    >
      <PluginSetupTextField
        path="title"
        settingsKey="example-plugin"
        label="Initial title"
        required
        defaultValue="Example"
      />
      <PluginSetupBooleanField
        path="showHints"
        settingsKey="example-plugin"
        label="Show hints"
        defaultValue
      />
    </PluginSetupSection>
  ),
});
```

### 9.1 `settingsKey` rule

Every setup field must declare `settingsKey`.

That key decides which semester settings bucket receives the value.

Use this when:

- a plugin has one shared settings bucket
- a plugin needs multiple independent settings buckets
- a setup screen edits settings for more than one tab in one place

The setup screen may span multiple tabs. It is not constrained to a single runtime tab.

### 9.2 Validation rule

Setup validation is frontend-owned.

Use:

- field-level `validate`
- definition-level `validate`

Validation controls wizard interaction and review presentation, but plugin authors should treat `setup.tsx` as the place where setup semantics are defined.

### 9.3 Persistence rule

Setup does not persist to a dedicated `setup_state` model.

Instead:

1. the plugin declares setup fields in `setup.tsx`
2. the frontend serializes the schema for backend consumption
3. the wizard saves raw values
4. the backend groups those values by `settings_key`
5. the backend writes them into semester-scoped `tab_settings`
6. review reads back the same resolved settings chain

So if a setup field is really just an initial plugin setting, it should write to the same settings bucket the runtime/settings page uses.

## 10. Generated Backend Artifacts

Plugin authors edit TypeScript authoring files.

The generated backend files are outputs, not sources:

- `backend/generated/plugin-manifests/*.plugin.json`
- `backend/generated/plugin-manifests/*.setup.schema.json`

These are generated from frontend `plugin.ts` plus `setup.tsx` authoring data.

Do not hand-edit them.

## 11. Boundary Rules

### 11.1 Plugin authors own

- `plugin.ts`
- `index.ts`
- runtime React code
- `settings.tsx`
- `setup.tsx`
- plugin-defined settings bucket structure

### 11.2 The host owns

- plugin install/enable lifecycle
- builtin vs external classification
- host-shell policy
- visibility policy
- runtime payload assembly
- scope inheritance for persisted settings
- generated backend manifest ingestion

### 11.3 Ordinary plugins must not do

Ordinary plugins must not:

- encode host-private visibility policy
- assume host-shell status
- rely on a separate backend registration file
- create duplicate persistence paths for the same setting
- model setup as a parallel config system when it is really runtime settings

## 12. Decision Guide

If you are changing plugin identity, tabs, widgets, or settings panel exposure:

- edit `plugin.ts`

If you are changing runtime rendering or runtime hooks:

- edit `index.ts`, `tab.tsx`, or `widget.tsx`

If you are changing host-rendered Program/Semester/Course settings UI:

- edit `settings.tsx`
- keep `descriptor.settings.panels` in `plugin.ts` aligned

If you are changing Semester setup fields or setup validation:

- edit `setup.tsx`

If you are changing builtin/host-only policy:

- edit `frontend/src/plugins/host-policy.json`
- and host code if required

## 13. Good Examples In This Repo

Useful reference files:

- `frontend/src/plugins/tab-template/plugin.ts`
- `frontend/src/plugins/tab-template/setup.tsx`
- `frontend/src/plugins/tab-template/tab.tsx`
- `frontend/src/plugins/builtin-event-core/plugin.ts`
- `frontend/src/plugins/builtin-event-core/setup.tsx`
- `frontend/src/plugins/builtin-event-core/settings.tsx`
- `frontend/src/plugin-sdk/index.ts`
- `frontend/src/plugin-sdk/authoring.ts`
- `frontend/src/plugin-system/setup.ts`
- `backend/plugin_registry.py`
- `backend/crud_plugin_registry.py`

## 14. One-Line Summary

Author plugins in `plugin.ts`; put runtime in `index.ts`; put host-rendered settings in `settings.tsx`; put Semester setup in `setup.tsx`; and treat setup as an editor for plugin-owned `settings_key` buckets, not as a separate storage system.
