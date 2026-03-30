# Plugin Development Guide

This guide explains the current Semestra plugin model in detail.

It reflects the descriptor-first architecture that is now implemented in the repo:

- public plugin contract lives in checked-in plugin files
- frontend and backend read the same checked-in plugin descriptor data
- ordinary plugins do not require Python-side registry entries
- plugin authors use a single public SDK surface: `@/plugin-sdk`

If you previously worked with `metadata.ts`, generated plugin manifests, or backend-owned ordinary plugin registration, that model is obsolete. This document describes the new one.

## 1. Mental Model

In the current system, a plugin is split into three layers:

1. `plugin descriptor`
2. `plugin runtime`
3. `host policy`

These layers must stay separate.

### 1.1 Plugin descriptor

The descriptor is the plugin-authored static contract.

It answers:

- who the plugin is
- which tabs and widgets it exposes
- where those tabs/widgets may appear
- which host-managed settings fields exist
- which settings-page sections the plugin wants to render
- whether the plugin contributes Semester setup schema

Descriptor files are:

- `plugin.json`
- optional `setup.schema.json`

### 1.2 Plugin runtime

The runtime is the lazily loaded frontend implementation.

It answers:

- what React component renders a tab or widget
- what runtime settings component belongs to a tab or widget
- what default instance settings a tab or widget starts with
- what lifecycle hooks run on create/delete
- what widget header buttons exist

Runtime files are:

- `plugin.ts`
- `index.ts`
- optional `tab.tsx`
- optional `widget.tsx`
- optional `shared.ts`

### 1.3 Host policy

Host policy is not authored by external plugin developers.

It answers host-private questions such as:

- is this plugin builtin
- is this plugin host-shell
- should it be hidden from the public plugin catalog

Host policy lives in:

- `frontend/src/plugins/host-policy.json`

External plugin authors should treat that file as host-owned.

## 2. Current File Structure

Recommended plugin folder layout:

```text
frontend/src/plugins/<plugin-id>/
  plugin.json
  plugin.ts
  index.ts
  tab.tsx
  widget.tsx
  settings.tsx
  setup.schema.json
  shared.ts
```

Not every file is required.

### Required files

- `plugin.json`
- `plugin.ts`
- `index.ts`

### Optional files

- `tab.tsx`
- `widget.tsx`
- `settings.tsx`
- `setup.schema.json`
- `shared.ts`

### What each file owns

| File | Responsibility | Notes |
|------|------|-------------|
| `plugin.json` | Public static descriptor | Identity, tabs/widgets catalog entries, host-managed settings schema, settings-section bindings |
| `plugin.ts` | Single frontend authoring entry | Binds descriptor to lazy runtime loading and optional settings/setup UI |
| `index.ts` | Lazy runtime registration | Registers tabs/widgets through SDK helpers |
| `tab.tsx` | Tab UI | Optional |
| `widget.tsx` | Widget UI | Optional |
| `settings.tsx` | Settings-page sections | Optional; plugin owns persistence |
| `setup.schema.json` | Semester setup schema | Optional; shared by frontend and backend |
| `shared.ts` | Local shared helpers/types | Optional |

## 3. Public Authoring Surface

Plugin code should import from `@/plugin-sdk`.

Do not import authoring helpers from plugin-system internals.

Use these exports:

- `definePlugin`
- `definePluginRuntime`
- `defineTab`
- `defineWidget`
- `definePluginSettings`
- `defineSettingsSection`
- `defineSetup`
- `usePluginHost`
- `usePluginRuntimeInstance`
- `usePluginUiState`
- public descriptor/runtime/settings/setup types

Do not import from:

- `frontend/src/plugin-system/index.ts`
- `frontend/src/plugin-system/public-types.ts`
- `frontend/src/plugin-system/contracts.ts`
- `frontend/src/plugin-system/authoring.ts`
- `frontend/src/services/pluginSettingsRegistry.tsx`
- any internal registry or loader file

## 4. `plugin.json`

`plugin.json` is the public manifest for a plugin.

It is the source of truth for plugin-authored static metadata.

### 4.1 Current shape

```json
{
  "id": "tab-template",
  "display_name": "Tab Template",
  "author": "Jinyuan",
  "description": "Prototype new workspace experiences and interaction patterns.",
  "long_description": "Longer plugin description shown in host UI.",
  "icon": "panels-top-left",
  "tabs": [],
  "widgets": [],
  "settings": {
    "defaults": {},
    "fields": [],
    "sections": []
  }
}
```

### 4.2 Top-level fields

| Field | Meaning |
|------|------|
| `id` | Stable plugin id |
| `display_name` | Host-facing plugin name |
| `author` | Author label shown by host UI |
| `description` | Short description |
| `long_description` | Long description for detail views |
| `icon` | Plugin-level icon name |
| `tabs` | Catalog declarations for tab surfaces |
| `widgets` | Catalog declarations for widget surfaces |
| `settings` | Host-managed settings defaults, fields, and section bindings |

### 4.3 `tabs`

`tabs` is a static catalog declaration. It is not the runtime implementation.

Each tab entry describes:

- `type`
- `title`
- `description`
- `icon`
- `contexts`

Example:

```json
{
  "type": "course-resources-tab",
  "title": "Course Resources",
  "description": "Browse files and saved links for a course.",
  "icon": "folder-open-dot",
  "contexts": ["course"]
}
```

### 4.4 `widgets`

`widgets` is the widget catalog declaration.

Each widget entry may describe:

- `type`
- `title`
- `description`
- `icon`
- `contexts`
- `layout`
- `max_instances`

Example:

```json
{
  "type": "course-resources-quick-open",
  "title": "Quick Open",
  "description": "Open recent resources from the dashboard.",
  "icon": "panels-top-left",
  "contexts": ["course"],
  "layout": {
    "w": 3,
    "h": 3,
    "minW": 2,
    "minH": 2
  },
  "max_instances": 1
}
```

### 4.5 `icon`

The plugin-level `icon` is for host identity.

Use it for:

- plugin catalog cards
- settings-page plugin headers
- plugin details views

It is not the same thing as `tabs[].icon` or `widgets[].icon`.

- `icon`: plugin identity icon
- `tabs[].icon`: tab catalog icon
- `widgets[].icon`: widget catalog icon

If a plugin has multiple surfaces, the plugin icon may stay constant while different tabs/widgets use different surface icons.

### 4.6 `settings`

`settings` contains three related but distinct pieces:

1. `defaults`
2. `fields`
3. `sections`

#### `settings.defaults`

Static default values for host-managed plugin config.

#### `settings.fields`

The schema for host-managed plugin config fields.

Each field currently supports:

- `path`
- `label`
- `type`
- `scope`
- `default`
- `description`
- `options`

This is the modern replacement for the old `field_definitions` concept.

Use `settings.fields`, not `field_definitions`.

#### `settings.sections`

Bindings that tell the host which plugin-owned settings sections may appear in:

- Program settings
- Semester settings
- Course settings

This is not field schema. It is a binding layer for `settings.tsx` UI sections.

## 5. `plugin.ts`

`plugin.ts` is the single frontend authoring entry.

It is the bridge between:

- static descriptor data
- lazy runtime code
- optional settings sections
- optional custom setup UI

### 5.1 Minimal example

```ts
import { definePlugin, type PluginDescriptor } from '@/plugin-sdk';

import descriptorJson from './plugin.json';

const descriptor = descriptorJson as PluginDescriptor;

export default definePlugin({
  descriptor,
  loadRuntime: async () => (await import('./index')).default,
});
```

### 5.2 What belongs in `plugin.ts`

Use `plugin.ts` when you need to wire in:

- `descriptor`
- `loadRuntime`
- `settingsSections`
- `setup`

### 5.3 What does not belong in `plugin.ts`

Do not place runtime implementation details directly in `plugin.ts` when they belong in:

- `index.ts`
- `tab.tsx`
- `widget.tsx`
- `settings.tsx`

Keep `plugin.ts` as the composition point, not the runtime implementation file.

## 6. `index.ts`

`index.ts` is the lazy runtime registration entry.

It usually looks like this:

```ts
import { definePluginRuntime } from '@/plugin-sdk';

import { TemplateTabDefinition } from './tab';

export default definePluginRuntime({
  tabDefinitions: [TemplateTabDefinition],
});
```

### 6.1 What belongs in runtime definitions

Tab runtime definitions:

- `type`
- `component`
- `defaultSettings`
- `SettingsComponent`
- `onCreate`
- `onDelete`

Widget runtime definitions:

- `type`
- `component`
- `defaultSettings`
- `headerButtons`
- `SettingsComponent`
- `onCreate`
- `onDelete`

### 6.2 What does not belong in runtime definitions

Do not duplicate catalog metadata that already belongs in `plugin.json`, such as:

- display name
- description
- icon
- layout metadata
- allowed contexts

Those are descriptor concerns, not runtime concerns.

## 7. Runtime Components

Runtime UI normally lives in:

- `tab.tsx`
- `widget.tsx`

These files may use:

- `usePluginHost()`
- `usePluginRuntimeInstance()`
- `usePluginUiState()`

### 7.1 `usePluginHost()`

Use `usePluginHost()` when a plugin needs host-owned navigation behavior.

Typical examples:

- jump to another tab by id
- jump to another tab type
- request a confirmed host action

### 7.2 `usePluginRuntimeInstance()`

Use `usePluginRuntimeInstance()` to understand the current runtime scope:

- widget id
- tab id
- semester id
- course id
- workspace kind

### 7.3 `usePluginUiState()`

Use plugin UI state for transient browser-local state, such as:

- selected local view
- temporary filters
- disclosure state
- non-authoritative drafts

Do not use it for authoritative application data.

## 8. Settings Model

There are three different settings concepts in the system.

Do not mix them.

### 8.1 Host-managed plugin config

Declared in:

- `plugin.json.settings.defaults`
- `plugin.json.settings.fields`

Owned by:

- host backend
- Program/Semester plugin management flows

Use this for:

- Program defaults
- Semester override fields the host explicitly supports
- small host-managed operational values

### 8.2 Host-rendered settings-page sections

Declared in:

- `plugin.json.settings.sections`
- implemented in `settings.tsx`

Owned by:

- plugin UI code
- plugin/domain persistence logic

Use this when the host should render a plugin section inside:

- Program settings
- Semester settings
- Course settings

But the plugin still owns the actual save logic.

### 8.3 Runtime instance settings

These are:

- tab settings
- widget settings

Use them when the value belongs to one tab instance or one widget instance instead of the whole workspace.

## 9. `settings.tsx`

`settings.tsx` is optional.

Use it when the plugin needs host-rendered settings-page sections.

Example:

```ts
import { definePluginSettings, type PluginSettingsSectionDefinition } from '@/plugin-sdk';

export default definePluginSettings({
  pluginSettings: [] satisfies PluginSettingsSectionDefinition[],
});
```

Each settings section is a React component bound to one or more host contexts.

Current contexts:

- `program`
- `semester`
- `course`

### 9.1 Persistence rule

The host renders the section shell.
The plugin owns the data write path.

That means:

- if the value is host-managed config, use the plugin management API path
- if the value is plugin/domain data, use plugin/domain APIs
- if the value belongs to one runtime instance, use tab/widget settings instead

Do not create duplicate persistence paths for the same conceptual setting.

## 10. `setup.schema.json`

If a plugin contributes Create Semester setup, it must declare `setup.schema.json`.

This schema is shared directly with:

- frontend setup rendering
- backend setup validation
- backend setup review summaries

This replaces the old generated setup-manifest pipeline.

### 10.1 What the schema may describe

- sections
- fields
- required state
- default values
- select options
- placeholder text
- summary labels
- persist target
- validation rules

### 10.2 Current field model

Setup fields currently support:

- `path`
- `label`
- `type`
- `persist`
- `required`
- `default_value`
- `description`
- `placeholder`
- `options`
- `summary_labels`

### 10.3 Current validation model

Current built-in validation rules include:

- `json-array-min-length`
- `json-array-unique-keys`

If a plugin needs custom setup or review UI, it may attach that UI through `plugin.ts`, but the underlying data contract must still come from `setup.schema.json`.

## 11. Detailed Boundary Rules

### 11.1 What plugin authors own

Plugin authors own:

- `plugin.json`
- `plugin.ts`
- `index.ts`
- runtime UI
- optional settings-page UI
- optional setup schema

### 11.2 What the host owns

The host owns:

- builtin vs external classification
- host-shell tabs
- hidden vs public visibility
- Program/Semester/Course plugin lifecycle APIs
- runtime payload assembly
- setup review lifecycle

### 11.3 What ordinary plugins must not do

Ordinary plugins must not:

- declare `builtin`
- declare `host-shell`
- declare catalog visibility policy
- inject backend executable logic
- define install defaults in the public descriptor
- rely on host-private review hooks

If a plugin requires host-private backend behavior, it is builtin by definition.

## 12. Host Policy

Host-private plugin policy lives in:

- `frontend/src/plugins/host-policy.json`

This file is not part of the public authoring contract for external plugins.

It controls host-private concepts such as:

- builtin status
- host-shell status
- hidden vs public visibility

External plugin authors should not edit it unless they are intentionally changing host-owned builtin behavior.

## 13. Unassigned Course Behavior

External plugin authors do not maintain a separate `supportsUnassignedCourse` flag anymore.

Instead:

- Course-visible tabs/widgets are declared through `plugin.json` contexts
- the host resolves final Course visibility through registry logic and host policy

If a plugin has no Course-visible surfaces after host resolution:

- it will not appear in the unassigned Course plugin management UI
- it will not appear in unassigned Course runtime payloads

## 14. Removed Concepts

The following are obsolete in the current model:

- `metadata.ts`
- `@/plugin-system/authoring`
- generated plugin manifests
- backend-owned ordinary plugin registration for public plugins
- public `classification`
- public `install_by_default`
- public `enable_by_default`
- public `supports_unassigned_course`
- `tab_contributions`
- `widget_contributions`
- `field_definitions`

When reading old code or old plans:

- `tab_contributions` maps to `plugin.json.tabs`
- `widget_contributions` maps to `plugin.json.widgets`
- `field_definitions` maps to `plugin.json.settings.fields`

## 15. Complete Minimal Example

### `plugin.json`

```json
{
  "id": "example-plugin",
  "display_name": "Example Plugin",
  "author": "Your Name",
  "description": "Short description.",
  "long_description": "Long description for plugin details.",
  "icon": "panels-top-left",
  "tabs": [
    {
      "type": "example-tab",
      "title": "Example",
      "description": "Example workspace tab.",
      "icon": "panels-top-left",
      "contexts": ["semester", "course"]
    }
  ],
  "widgets": [],
  "settings": {
    "defaults": {
      "showHints": true
    },
    "fields": [
      {
        "path": "showHints",
        "label": "Show hints",
        "type": "boolean",
        "scope": "program-only",
        "default": true,
        "description": "Enable helper copy in the plugin."
      }
    ],
    "sections": [
      {
        "id": "example-program-settings",
        "contexts": ["program"]
      }
    ]
  }
}
```

### `plugin.ts`

```ts
import { definePlugin, type PluginDescriptor } from '@/plugin-sdk';

import descriptorJson from './plugin.json';
import settings from './settings';

const descriptor = descriptorJson as PluginDescriptor;

export default definePlugin({
  descriptor,
  loadRuntime: async () => (await import('./index')).default,
  settingsSections: settings.pluginSettings,
});
```

### `index.ts`

```ts
import { definePluginRuntime } from '@/plugin-sdk';

import { ExampleTabDefinition } from './tab';

export default definePluginRuntime({
  tabDefinitions: [ExampleTabDefinition],
});
```

### `tab.tsx`

```ts
import { defineTab, type PluginTabDefinition, type PluginTabProps } from '@/plugin-sdk';

const ExampleTab = ({ settings }: PluginTabProps<{ greeting?: string }>) => {
  return <div>{settings.greeting ?? 'Hello'}</div>;
};

export const ExampleTabDefinition: PluginTabDefinition = defineTab({
  type: 'example-tab',
  component: ExampleTab,
  defaultSettings: {
    greeting: 'Hello',
  },
});
```

### `settings.tsx`

```ts
import { definePluginSettings, defineSettingsSection, type PluginSettingsSectionProps } from '@/plugin-sdk';

const ExampleProgramSettings = ({ scope }: PluginSettingsSectionProps) => {
  if (scope.kind !== 'program') return null;
  return <div>Example Program settings for {scope.programId}</div>;
};

export default definePluginSettings({
  pluginSettings: [
    defineSettingsSection({
      id: 'example-program-settings',
      component: ExampleProgramSettings,
      allowedContexts: ['program'],
    }),
  ],
});
```

## 16. Decision Guide

When you add a new plugin concern, use this checklist.

### If you are changing plugin identity or catalog entries

Edit:

- `plugin.json`

### If you are changing runtime implementation

Edit:

- `index.ts`
- `tab.tsx`
- `widget.tsx`

### If you are changing settings-page UI

Edit:

- `settings.tsx`
- `plugin.json.settings.sections`

### If you are changing host-managed Program/Semester config fields

Edit:

- `plugin.json.settings.defaults`
- `plugin.json.settings.fields`

### If you are changing Semester setup structure

Edit:

- `setup.schema.json`

### If you are changing builtin/host-shell/private host policy

Edit:

- `frontend/src/plugins/host-policy.json`
- host backend files if the plugin is builtin and requires host-specific logic

## 17. Current Source References

Useful real files in this repo:

- SDK entry: `frontend/src/plugin-sdk/index.ts`
- SDK types: `frontend/src/plugin-sdk/types.ts`
- template plugin entry: `frontend/src/plugins/tab-template/plugin.ts`
- template manifest: `frontend/src/plugins/tab-template/plugin.json`
- template runtime registration: `frontend/src/plugins/tab-template/index.ts`
- template settings bundle: `frontend/src/plugins/tab-template/settings.tsx`
- builtin setup schema example: `frontend/src/plugins/builtin-event-core/setup.schema.json`
- host policy: `frontend/src/plugins/host-policy.json`
- backend registry loader: `backend/plugin_registry.py`
- backend CRUD slice: `backend/crud_plugin_registry.py`
