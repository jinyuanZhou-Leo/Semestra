# Plugin Development Guide

This guide describes how to create and register new widget and tab plugins for the Semestra application. The plugin system is designed to be modular and easy to extend.

## Overview

Plugins are the top-level extension unit. A single plugin can contribute:
1. **Widget** entries: small, grid-based components inside the Dashboard tab.
2. **Tab** entries: full-size panels that appear as workspace tabs.

Both contribution shapes share a similar registration model but remain subordinate to the plugin.
Plugins live in `frontend/src/plugins/<plugin-name>/` and can implement any mix of tabs, widgets, plugin-global settings, and optional host-rendered setup definitions.

### Runtime Architecture

```mermaid
flowchart LR
    subgraph PluginFolder["frontend/src/plugins/<plugin-name>/"]
        Metadata["metadata.ts
default export definePluginMetadata(...)"]
        Setup["setup.ts
default export definePluginSetup(...)"]
        Runtime["index.ts
default export definePluginRuntime(...)"]
        Settings["settings.ts(x)
default export definePluginSettings(...)"]
        Impl["tab.tsx / widget.tsx / shared.ts"]
        Setup --> Impl
        Runtime --> Impl
        Settings --> Impl
    end

    Metadata -->|"eager import.meta.glob"| PluginSystem["frontend/src/plugin-system/index.ts"]
    Setup -->|"eager import.meta.glob"| PluginSystem
    Runtime -->|"lazy import.meta.glob"| PluginSystem
    Settings -->|"eager import.meta.glob"| PluginSystem

    PluginSystem -->|"register on load"| TabRegistry["TabRegistry"]
    PluginSystem -->|"register on load"| WidgetRegistry["WidgetRegistry"]
    PluginSystem -->|"register eagerly"| SettingsRegistry["PluginSettingsRegistry"]
    PluginSystem -->|"catalog helpers"| AddModals["AddTabModal / AddWidgetModal"]
    PluginSystem -->|"buildPluginSetupManifest()"| Manifest["backend/generated/plugin_setup_manifest.json"]
    PluginSystem -->|"ensure*PluginByTypeLoaded()"| DashboardHooks["useDashboardTabs / useDashboardWidgets / useHomepageBuiltinTabs"]

    TabRegistry --> Pages["SemesterHomepage / CourseHomepage"]
    WidgetRegistry --> Pages
    SettingsRegistry --> Pages
```

The important split is:
- `metadata.ts` drives plugin-local manifest data and tab/widget contribution catalogs before runtime code is loaded.
- `setup.ts` stays eager, pure-data-only, and feeds the generated backend plugin setup manifest.
- `index.ts` stays lazy and registers tab/widget runtime definitions plus instance settings when a type is actually needed.
- `settings.ts` / `settings.tsx` is eager and reserved for plugin-global settings sections that are shared across instances.
- Program-managed install/authorization/default-config state is declared in the host governance contract, and Semester wizard setup is declared as host-rendered setup sections instead of ad hoc plugin-controlled flows.
- Plugin identity (`name`, `description`, `author`) is owned by backend governance, not by the frontend manifest.

### Plugin Folder Structure (Recommended)

```
frontend/src/plugins/<plugin-name>/
  metadata.ts     // REQUIRED: Plugin id, plugin icon, and widget/tab contribution catalog entries
  setup.ts        // OPTIONAL: Default-exports definePluginSetup(...) when the plugin contributes host-rendered Semester setup
  index.ts        // REQUIRED: Default-exports definePluginRuntime(...) (lazy runtime UI entry)
  settings.ts(x)  // OPTIONAL: Default-exports definePluginSettings(...) when plugin exposes plugin-global settings
  widget.tsx      // Optional: widget implementation
  tab.tsx         // Optional: tab implementation
  shared.ts       // Optional: shared types/helpers
```

> **Plugin Identity Split**:
> - Backend governance is the source of truth for plugin identity: `name`, `description`, `author`, install defaults, availability, authorization, Program fields, Semester overrides, and setup sections.
> - Frontend `metadata.ts` is the source of truth only for plugin-local runtime metadata: plugin `icon` plus tab/widget contribution catalogs (`type`, contribution `name`, contribution `description`, `layout`, `maxInstances`, `allowedContexts`).
> - Runtime definitions in `widget.tsx`/`tab.tsx` should only declare runtime-specific fields (`type`, `component`, `SettingsComponent`, `defaultSettings`, `headerButtons`, `onCreate`, `onDelete`). Do not duplicate catalog fields in runtime definitions.

The current loader expects `metadata.ts` to default-export:

```typescript
export default definePluginMetadata({
  pluginId: 'my-plugin',
  icon: createElement(Puzzle, { className: 'h-4 w-4' }),
  widgetCatalog: [],
  tabCatalog: [],
});
```

Likewise, `setup.ts`, `index.ts`, and `settings.ts(x)` should default-export `definePluginSetup(...)`, `definePluginRuntime(...)`, and `definePluginSettings(...)`.

## Governance And Setup Contracts

Program install state, authorization state, default configuration, Semester override scope, and wizard setup sections must be host-readable. Plugins do not own the lifecycle state machine.

Current repository model:
- The authoritative plugin identity and governance registry lives in [`backend/plugin_governance.py`](../backend/plugin_governance.py) because the backend must validate Program settings, Semester overrides, setup payloads, availability, and draft review blockers.
- Frontend runtime/plugin authoring uses `metadata.ts`, optional `setup.ts`, `index.ts`, and optional `settings.ts(x)` for plugin-local manifest data, host-rendered setup DSL, runtime registrations, and plugin-global settings UI.
- If a plugin needs Semester wizard setup, declare it in `frontend/src/plugins/<plugin-id>/setup.ts`, regenerate the backend manifest, and keep any runtime UI aligned with the resolved config returned by the host.

What the host contract controls:
- Plugin identity: `plugin_id`, `display_name`, `description`, and `author`.
- Program layer: install/uninstall, authorization requirement, pinned version display, default settings, and field schema.
- Semester layer: enable/disable from already-installed Program plugins plus edits to fields explicitly marked as `semester-override`.
- Wizard setup: fixed host-owned `Basics -> Courses -> Plugins -> Plugin Setup -> Review` flow where plugins may only contribute declared setup sections/fields and review summaries.
- Runtime reads: plugins consume resolved config from the host instead of merging `defaults + program + semester` locally.

What plugins may not do:
- Inject their own top-level wizard steps.
- Persist arbitrary wizard-time business objects outside Semester draft-owned activation/setup records.
- Treat `program-only` fields as editable in Semester surfaces.
- Recompute availability rules in runtime code independently from the host.

### Field Scope Rules

Governance field scopes are enforced server-side:
- `program-only`: editable only from Program settings, read-only everywhere else.
- `semester-override`: editable from Semester surfaces and the Create Semester wizard, merged on top of Program settings.

Resolved config always follows:

```text
plugin defaults < program settings < semester overrides
```

Plugins should treat the resolved payload as the only runtime source of truth.

### Setup Contributions

Setup contributions are declaration-only and frontend-authored through the setup DSL, then materialized into a backend-owned generated manifest.

Each setup section in `frontend/src/plugins/<plugin-id>/setup.ts` should define:
- Stable section id and title.
- Host-renderable field list with field type, label, description, default, and select options.
- Values that write into `semester_plugin_activations.setup_state` and, when the field is also a Semester override, into `semester_overrides`.

Review summaries shown in the final wizard step must be derivable from the same declared setup fields. The backend currently builds these summaries from the generated manifest in `plugin_governance.build_plugin_setup_summary(...)` so review/finalize behavior stays deterministic.

### Plugin Setup DSL Reference

The setup DSL lives in [`frontend/src/plugin-system/setup.ts`](../frontend/src/plugin-system/setup.ts). It is intentionally pure data: no React components, hooks, async work, or runtime-only imports.

Author a setup file like this:

```typescript
import { definePluginSetup, section, selectField, textField, booleanField } from '@/plugin-system/setup';

export default definePluginSetup({
  fields: {
    calendarDefaultView: selectField({
      label: 'Default view',
      persist: 'both',
      required: true,
      defaultValue: 'month',
      description: 'Choose the starting calendar behavior for this Semester.',
      options: [
        { label: 'Month', value: 'month' },
        { label: 'Week', value: 'week' },
      ],
      summaryLabels: {
        month: 'Month',
        week: 'Week',
      },
    }),
    syncLmsCalendar: booleanField({
      label: 'Sync LMS calendar',
      persist: 'semesterOverride',
      defaultValue: true,
      description: 'Merge LMS events into the Semester calendar when available.',
    }),
    calendarTitle: textField({
      label: 'Calendar title',
      persist: 'setupState',
      placeholder: 'Optional onboarding label',
    }),
  },
  sections: [
    section('calendar-setup', {
      title: 'Calendar Setup',
      description: 'Choose the starting calendar behavior for this Semester.',
      fieldKeys: ['calendarDefaultView', 'syncLmsCalendar', 'calendarTitle'],
    }),
  ],
});
```

`definePluginSetup(...)` accepts:
- `fields`: a keyed map of reusable field declarations. Keys become the persisted payload keys.
- `sections`: ordered host-rendered sections. Each section references existing field keys through `fieldKeys`.

`section(id, { ... })` accepts:
- `id`: stable section id used by the generated manifest.
- `title`: required section title shown by the host.
- `description`: optional helper copy.
- `fieldKeys`: ordered array of field ids declared in `fields`.

Available field helpers:

| Helper | Field type | Value shape | Required extra keys |
|------|------|-------------|---------------------|
| `textField(...)` | `text` | `string` | None |
| `textareaField(...)` | `textarea` | `string` | None |
| `numberField(...)` | `number` | `number` | None |
| `booleanField(...)` | `boolean` | `boolean` | None |
| `selectField(...)` | `select` | `string` | `options: Array<{ label, value }>` |
| `dateField(...)` | `date` | `string` | None |
| `jsonField(...)` | `json` | `unknown` | None |

Shared field properties:

| Property | Required | Meaning |
|------|----------|---------|
| `label` | Yes | Human-readable field label shown by the host. |
| `persist` | Yes | Controls where the saved value is written. |
| `required` | No | Marks the field as required during setup validation. |
| `description` | No | Helper text rendered under the field. |
| `placeholder` | No | Placeholder text for text-like inputs. |
| `defaultValue` | No | Host-side initial value used before the user edits the field. |
| `summaryLabels` | No | Optional display labels used when the Review step summarizes stored values, mainly for select-like values. |

`persist` supports exactly three values:
- `setupState`: write only to `semester_plugin_activations.setup_state`. Use this for onboarding-only values that should not become runtime governance config.
- `semesterOverride`: write only to `semester_plugin_activations.semester_overrides`. Use this only for values that correspond to backend-declared `semester-override` governance fields.
- `both`: write to both `setup_state` and `semester_overrides`. Use this when the wizard should both remember the onboarding answer and apply it as the Semester runtime override.

Practical rules:
- Use `setupState` when the value is only needed for setup progress, review, or future setup revisits.
- Use `semesterOverride` when the field is purely a Semester-level governance value and does not need separate setup memory.
- Use `both` when the same answer should appear in review/setup history and immediately affect resolved runtime config.
- Do not use `semesterOverride` or `both` unless the backend governance contract already declares the same field path as `semester-override`.
- Keep field keys and section ids stable once released; changing them breaks persisted draft/setup continuity.
- Keep `setup.ts` data-only. Import only from the setup DSL or other pure constants.

Generation pipeline:
- `frontend/src/plugins/<plugin-id>/setup.ts` is discovered eagerly by `frontend/src/plugin-system/setupRegistry.ts`.
- `frontend/scripts/generate-plugin-setup-manifest.mjs` loads the setup registry through Vite SSR.
- The script writes [`backend/generated/plugin_setup_manifest.json`](../backend/generated/plugin_setup_manifest.json).
- `backend/plugin_governance.py` validates that generated manifest at import time and uses it for setup APIs, validation, and review summaries.

After editing any plugin `setup.ts`, regenerate the manifest:

```bash
npm --prefix frontend run generate-plugin-setup-manifest
```

If the generated manifest is stale or missing, backend import will fail with an instruction to rerun that command.

### Runtime Consumption

When a runtime component needs governance config:
- Read resolved settings from the Semester/Course payload delivered by the backend.
- Use shared host helpers such as the runtime governance adapter in `frontend/src/plugin-system/runtimeGovernance.ts`.
- Keep runtime preferences separate from governance config. Install/default/override data belongs to governance; tab settings, widget settings, and plugin shared settings remain runtime preference state.

### Built-in Tabs

The application ships several built-in tab plugins from:
- `frontend/src/plugins/builtin-dashboard/`
- `frontend/src/plugins/builtin-settings/`
- `frontend/src/plugins/builtin-event-core/`

Examples include `dashboard`, `settings`, `calendar`, `course-schedule`, and `todo`.
Do not reuse any built-in `type` values in custom plugins.

These tabs are still normal persisted tab instances, not hardcoded shell-only views.
Framework behavior:
- Built-in tabs that should always exist are auto-ensured per homepage context.
- Built-in catalog items generally publish `maxInstances: 0` so the Add Tab modal cannot create duplicates.
- Framework policy controls `is_removable` and `is_draggable` per tab instance.

### Auto Registration

The plugin system scans:
- `metadata.ts` with eager `import.meta.glob` for plugin manifests and contribution catalogs (plugin icon, contribution names, layout).
- `setup.ts` with eager `import.meta.glob` for plugin setup registration and backend-manifest generation (only if the file exists).
- `index.ts` with `import.meta.glob` for lazy runtime registration (tab/widget UI).
- `settings.ts` / `settings.tsx` with eager `import.meta.glob` for plugin-global settings registration (only if the file exists).

If `index.ts` default-exports `definePluginRuntime(...)`, runtime UI remains lazy.
If `settings.ts` / `settings.tsx` default-exports `definePluginSettings(...)`, plugin-global settings panels are available without waiting for runtime UI modules.

**Loading Model**
- Backend governance payloads: fetched by host management/runtime pages when plugin identity, install state, availability, or resolved config is needed.
- Metadata (`metadata.ts`): eagerly loaded — plugin icons plus contribution names, descriptions, layout, context limits, and instance limits are available before runtime modules.
- Setup (`setup.ts`): eagerly loaded and validated — host-rendered setup sections are available for frontend facades and for generating the backend plugin setup manifest.
- Runtime UI (`index.ts` -> `tab.tsx` / `widget.tsx`): lazy-loaded.
- Plugin-global settings UI (`settings.ts` / `settings.tsx`): eagerly loaded (optional).
- This keeps plugin icons, add-modal contribution catalogs, and shared plugin settings available without loading runtime UI bundles.

> **Note**: `settings.ts` is optional. Plugins without shared plugin settings do not need this file.

### Plugin Manager Facade

Application code should consume the plugin system through `frontend/src/plugin-system/index.ts`, not by stitching registries together manually.

Useful public helpers:
- `getPluginIconById(pluginId)`
- `getTabCatalog(context?)`
- `getWidgetCatalog(context?)`
- `getResolvedTabMetadataByType(type)`
- `getResolvedWidgetMetadataByType(type)`
- `ensureTabPluginByTypeLoaded(type)`
- `ensureWidgetPluginByTypeLoaded(type)`
- `useTabPluginLoadState(type)`
- `useWidgetPluginLoadState(type)`
- `usePluginLoadStateVersion()`
- `getTabSettingsComponentByType(type)`
- `getWidgetSettingsComponentByType(type)`
- `usePluginSettingsRegistry(context?)`

Important behavior:
- Governance surfaces such as Program Settings, Semester Settings, and Create Semester should read plugin `display_name` / `description` / `author` from backend APIs and use `getPluginIconById(pluginId)` only for the local icon.
- `ensure*PluginByTypeLoaded(...)` returns `true` only when runtime registration actually succeeds.
- Failed runtime imports move the plugin into `error` state; consumers should not treat that as an unknown type.
- `usePluginLoadStateVersion()` is useful when a page needs to react to multiple plugin load-state transitions while resolving several tab settings sections at once.
- `TabRegistry`, `WidgetRegistry`, and `PluginSettingsRegistry` still exist internally, but page-level integration should prefer the facade above.

## Runtime Host APIs

Runtime plugins can import host-owned helper hooks from `frontend/src/plugin-system/index.ts`.

### `usePluginHost()`

Use this hook when a plugin needs to jump to another tab that already exists in the current workspace.

```typescript
import { usePluginHost } from '@/plugin-system';

const ExampleTab: React.FC<TabProps> = () => {
    const { jumpToTab } = usePluginHost();

    const handleOpenGradebook = () => {
        void jumpToTab(
            { tabType: 'builtin-gradebook' },
            {
                title: 'Open Gradebook?',
                description: 'Switch to the existing Gradebook tab in this course.',
                confirmText: 'Open',
                cancelText: 'Stay here',
            },
        );
    };

    return <Button onClick={handleOpenGradebook}>Open Gradebook</Button>;
};
```

API shape:

```typescript
const { jumpToTab } = usePluginHost();

const result = await jumpToTab(
  { tabId: 'tab-instance-id' } | { tabType: 'builtin-gradebook' },
  {
    title?: string,
    description?: React.ReactNode,
    confirmText?: string,
    cancelText?: string,
  },
);
```

Return value:

```typescript
type PluginHostJumpResult = {
  status: 'jumped' | 'cancelled' | 'missing' | 'ambiguous';
  tabId?: string;
};
```

Rules:
- Navigation is limited to the current workspace page. It does not perform router-level cross-page navigation.
- The host always shows a confirmation dialog before switching tabs.
- `{ tabId }` succeeds only if that exact visible tab instance already exists.
- `{ tabType }` resolves only against visible tabs in the current workspace.
- If no matching tab exists, the host shows an alert and returns `missing`.
- If multiple tabs share the same `tabType`, the host shows an alert and returns `ambiguous`; the caller must retry with `tabId`.
- The host never auto-adds or auto-creates missing tabs.

## Identity Rules

When adding or changing a plugin, keep these boundaries strict:
- If you are changing plugin `name`, `description`, `author`, install defaults, availability rules, Program fields, Semester overrides, or wizard setup sections, edit [`backend/plugin_governance.py`](../backend/plugin_governance.py).
- If you are changing which tabs/widgets the plugin contributes, their contribution-level labels/descriptions, their icons in add flows, their layouts, or their allowed contexts, edit `frontend/src/plugins/<plugin-name>/metadata.ts`.
- If you are changing runtime rendering or behavior, edit `index.ts`, `tab.tsx`, `widget.tsx`, or shared runtime helpers.

Do not duplicate plugin `name` / `description` / `author` inside `metadata.ts`. That would create a second source of truth and eventually drift from the backend governance payloads.

When to use it:
- Jumping from one plugin tab to another existing plugin tab.
- Replacing custom `window.dispatchEvent(...)` / `addEventListener(...)` handoff hacks.

When not to use it:
- Cross-route navigation.
- Creating or provisioning tabs that do not already exist.

### `usePluginUiState<T>()`

Use this hook for transient frontend-only plugin UI state that should survive remounts in the same browser.
This includes dialog drafts, sorting, filters, toggles, view preferences, and other local UI state that should not be written to backend persistence.

```typescript
import { usePluginUiState } from '@/plugin-system';

interface ResourceDialogDraft {
    activeTab: 'upload' | 'link';
    linkName: string;
    linkUrl: string;
}

const ExampleTab: React.FC<TabProps> = () => {
    const {
        state,
        setState,
        resetState,
    } = usePluginUiState<ResourceDialogDraft>('resource-dialog', () => ({
        activeTab: 'upload',
        linkName: '',
        linkUrl: '',
    }));

    return (
        <Input
            value={state.linkUrl}
            onChange={(event) => {
                setState((current) => ({ ...current, linkUrl: event.target.value }));
            }}
        />
    );
};
```

API shape:

```typescript
const {
  state,
  setState,
  resetState,
} = usePluginUiState<T>(stateKey, initialState);
```

Behavior:
- Storage is frontend-only and browser-local.
- Keys are automatically scoped by workspace kind, workspace id, slot kind, slot id, and your `stateKey`.
- Backing storage uses `localStorage` when available and falls back to in-memory storage when browser storage is unavailable.
- The `initialState` argument is a seed/reset baseline. It is used only when no cached value exists and when `resetState()` runs.
- State values must be JSON-serializable plain data.
- Bad or invalid cached JSON is discarded and falls back to `initialState`.
- `resetState()` removes the cached entry and resets the hook to its initial state.

Use it for:
- Dialog drafts.
- Search/filter input that should survive tab switches.
- Toggle state such as edit mode or plan mode.
- Sorting, view preferences, and other local-only UI controls.
- Temporary What If scores or similar client-only projections.

Do not use it for:
- Business data that belongs in backend persistence.
- Shared plugin configuration that all instances should read.
- Large binary objects such as `File`.
- Secrets or security-sensitive data.

Decision rule:
- Use `updateSettings(...)` when the state is real persisted configuration or domain data.
- Use plugin-global `settings.ts(x)` shared settings when the state is shared across all instances in the same context.
- Use `usePluginUiState(...)` when the state is tab/widget-instance-local transient UI state that should survive remounts.

## Structure

### WidgetDefinition

Runtime modules expose `WidgetDefinition` values through `definePluginRuntime(...)`:

```typescript
export interface WidgetDefinition {
    type: string;          // Unique identifier for the widget type
    component: React.FC<WidgetProps>; // The React component
    defaultSettings?: any; // Default values for settings
    headerButtons?: HeaderButton[]; // Optional custom action buttons in widget header
    SettingsComponent?: React.FC<WidgetSettingsProps>; // Optional per-instance settings fields (rendered inside framework modal)
    // Lifecycle hooks
    onCreate?: (ctx: WidgetLifecycleContext) => Promise<void> | void;
    onDelete?: (ctx: WidgetLifecycleContext) => Promise<void> | void;
}
```

> `name`, `description`, `icon`, `layout`, `maxInstances`, and `allowedContexts` belong in `metadata.ts` only. The runtime definition should focus on `type`, `component`, `SettingsComponent`, `defaultSettings`, `headerButtons`, and lifecycle hooks.

export interface HeaderButton {
    id: string;            // Unique identifier for this button
    render: (context: HeaderButtonContext, helpers: HeaderButtonRenderHelpers) => React.ReactNode;
}

export interface HeaderButtonContext {
    widgetId: string;      // The unique ID of this widget instance
    settings: any;         // Current widget settings
    semesterId?: string;   // Semester context (if applicable)
    courseId?: string;     // Course context (if applicable)
    updateSettings: (newSettings: any) => void; // Update widget settings
}

export interface HeaderActionButtonProps {
    title: string;
    icon: React.ReactNode;
    onClick: () => void | Promise<void>;
    variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
}

export interface HeaderConfirmActionButtonProps extends HeaderActionButtonProps {
    dialogTitle: string;
    dialogDescription?: string;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
}

export interface HeaderButtonRenderHelpers {
    ActionButton: React.FC<HeaderActionButtonProps>;
    ConfirmActionButton: React.FC<HeaderConfirmActionButtonProps>;
}

export interface WidgetLifecycleContext {
    widgetId: string;      // The ID of the widget instance
    semesterId?: string;   // Semester context (if applicable)
    courseId?: string;     // Course context (if applicable)
    settings: any;         // Widget settings at the time of the event
}

// Per-instance settings (shown in modal when clicking gear icon on widget)
// Generic type S allows type-safe settings access (defaults to any)
export interface WidgetSettingsProps<S = any> {
    settings: S;
    onSettingsChange: (newSettings: S) => void;
}

// Plugin-level shared settings (shown in Settings tab)
export interface PluginSettingsProps<S = any> {
    settings: S;                               // Framework-managed shared settings for this plugin + context
    updateSettings: (newSettings: S) => void | Promise<void>; // Debounced/max-wait sync, just like tab/widget settings
    saveState: 'idle' | 'saving' | 'success'; // Current framework save state for the shared settings record
    hasPendingChanges: boolean;                // Whether unsaved shared-settings edits are queued
    isLoading: boolean;                        // Whether the shared settings record is still loading
    semesterId?: string;                       // Semester context (if applicable)
    courseId?: string;                         // Course context (if applicable)
    onRefresh: () => void;                     // Escape hatch for refreshing host-owned data after custom mutations
}
```

Plugin-level settings are registered in `settings.ts` / `settings.tsx`, not through the runtime definition. The framework-supported shared settings path is the `pluginSettings` array returned from `definePluginSettings(...)`.

For regular plugins, prefer storing plugin-level configuration in `settings` and updating it with `updateSettings(...)`. The framework persists one shared JSON record per plugin per active context (`pluginId + semesterId` or `pluginId + courseId`) using the same debounce/max-wait autosave pattern as tab and widget settings.

Builtin or host-coupled plugins can still ignore `settings` / `updateSettings` and call private APIs directly when they need richer operations than a shared JSON payload.

`WidgetDefinition.globalSettingsComponent` is not part of the supported API. If you need a Settings-page section, register it through `definePluginSettings(...)`.

**Header Buttons**: Widgets can define custom action buttons that appear in the widget header (alongside drag handle, edit, and remove buttons). These buttons only appear when the widget controls are visible (on hover for desktop, on tap for touch devices).

**Example - Reset Button**:
```typescript
export const MyWidgetDefinition: WidgetDefinition = {
    type: 'my-widget',
    component: MyWidget,
    headerButtons: [
        {
            id: 'reset',
            render: ({ settings, updateSettings }, { ActionButton }) => (
                <ActionButton
                    title="Reset to default"
                    icon={<RotateCcw className="h-4 w-4" />}
                    onClick={() => {
                        const normalized = normalizeSettings(settings);
                        updateSettings({ ...normalized, value: 0 });
                    }}
                />
            )
        }
    ]
};
```

**Example - Destructive Button With Confirm Dialog**:
```typescript
headerButtons: [
  {
    id: 'clear',
    render: ({ settings, updateSettings }, { ConfirmActionButton }) => (
      <ConfirmActionButton
        title="Clear note"
        icon={<Trash2 className="h-4 w-4" />}
        dialogTitle="Clear this note?"
        dialogDescription="This will remove all note content."
        confirmText="Clear"
        confirmVariant="destructive"
        onClick={() => updateSettings({ ...settings, content: '' })}
      />
    )
  }
]
```

**Icon rendering:** Icons are displayed inside a circular badge in the UI. If `icon` is omitted, a placeholder badge with the first letter of the plugin name is shown. For image icons, place the asset in the plugin folder and import it (Vite will provide a URL string).

### Widget Settings Modal Ownership

For widget `SettingsComponent`, the framework owns the dialog shell and actions:

- Framework provides: dialog layout, footer actions, `Cancel`, and `Save Settings` button.
- Plugin provides: only settings fields UI.
- Plugin **must not** implement its own save/cancel buttons for `SettingsComponent`.

When fields change, call `onSettingsChange(...)` to update draft settings. The framework handles submit and persistence.

**Example - Widget SettingsComponent (fields only)**:

```typescript
import type { WidgetSettingsProps } from '../../services/widgetRegistry';
import { Label } from '../../components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select';

const MyWidgetSettings: React.FC<WidgetSettingsProps> = ({ settings, onSettingsChange }) => {
    return (
        <div className="grid gap-2">
            <Label htmlFor="my-widget-timezone">Timezone</Label>
            <Select
                value={settings?.timezone || 'UTC'}
                onValueChange={(timezone) => onSettingsChange({ ...settings, timezone })}
            >
                <SelectTrigger id="my-widget-timezone">
                    <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">New York</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
};
```

### Plugin-Level Global Settings

Plugins can provide plugin-level settings panels that are rendered in the Settings tab.
Unlike `SettingsComponent` (which is per-instance and shown in a modal), plugin-level settings are shown once in the Settings tab regardless of how many tab/widget instances exist.
Register these panels in `settings.ts` / `settings.tsx`.

Use cases:

- Plugin-wide configuration that applies to all instances
- Management functions (e.g., adding/removing items)
- Settings that don't belong to any specific widget instance
- Shared JSON settings that all tabs/widgets in the same plugin/context can read

**Example - Course List Plugin (`settings.ts`)**:
```typescript
import { definePluginSettings } from '../../plugin-system/contracts';
import type { PluginSettingsProps, PluginSettingsSectionDefinition } from '../../services/pluginSettingsRegistry';

interface CourseListSharedSettings {
    sortBy?: 'name' | 'grade';
}

const CourseListGlobalSettings: React.FC<PluginSettingsProps<CourseListSharedSettings>> = ({
    settings,
    updateSettings,
    saveState,
    semesterId,
    onRefresh,
}) => {
    const nextSettings = {
        sortBy: settings?.sortBy ?? 'name',
    };

    return (
        <SettingsSection title="Courses" description="Manage courses">
            <Select
                value={nextSettings.sortBy}
                onValueChange={(sortBy: 'name' | 'grade') => {
                    void Promise.resolve(updateSettings({ ...nextSettings, sortBy }));
                }}
            >
                <SelectTrigger>
                    <SelectValue placeholder="Sort courses by" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="grade">Grade</SelectItem>
                </SelectContent>
            </Select>

            <p className="text-xs text-muted-foreground">
                Shared settings save automatically ({saveState}).
            </p>
        </SettingsSection>
    );
};

export default definePluginSettings({
  pluginSettings: [
    {
      id: 'course-list-management',
      component: CourseListGlobalSettings,
      allowedContexts: ['semester'],
    },
  ] satisfies PluginSettingsSectionDefinition[],
});
```

**Note**: Context visibility for plugin-global settings is declared by `allowedContexts` on each `pluginSettings` section.


### WidgetProps

Your widget component will receive the following props:

```typescript
// Generic type S allows type-safe settings access (defaults to any)
export interface WidgetProps<S = any> {
    widgetId: string;      // The unique ID of this widget instance
    settings: S;           // The current settings for this widget (already parsed)
    semesterId?: string;   // Context: Semester ID (if applicable)
    courseId?: string;     // Context: Course ID (if applicable)
    
    // Framework-provided functions
    updateSettings: (newSettings: S) => void;  // Update settings (auto-debounced)
    updateCourse?: (updates: any) => void; // Update course data (if applicable)
}
```

### Multi-size Widget Best Practice

For resizable dashboard widgets, prefer a single responsive component over multiple size-specific `.tsx` files.

- Use one widget entry component and drive adaptation with CSS (`clamp()`, container queries, breakpoints, CSS variables).
- Avoid duplicating business/state logic across separate files for `small/medium/large`.
- Split into internal subviews only when layout structure is fundamentally different (for example `CompactView` vs `FullView`), still under one widget component.
- Define size tokens for spacing, typography, controls, and visual elements so scaling is consistent.
- Validate at minimum, medium, and maximum widget sizes to prevent overflow regressions.
This keeps behavior consistent, reduces maintenance cost, and avoids state divergence between size variants.

### TabDefinition

```typescript
export interface TabDefinition {
    type: string;          // Unique identifier for the tab type
    component: React.FC<TabProps>; // The main tab content component
    SettingsComponent?: React.FC<TabSettingsProps>; // Optional per-instance settings UI for this tab
    defaultSettings?: any; // Default settings for new tabs
    onCreate?: (ctx: TabLifecycleContext) => Promise<void> | void;
    onDelete?: (ctx: TabLifecycleContext) => Promise<void> | void;
}
```

> Same as `WidgetDefinition`: metadata fields belong in `metadata.ts` only.

Tab instance settings belong on `TabDefinition.SettingsComponent`.
The Settings page preloads visible tab runtimes so inactive tabs can still expose their instance settings.

### Tab Instance Flags (Persistence Layer)

`TabDefinition` describes plugin behavior, while tab instance mutability/reorderability is stored per record:

- `is_removable: boolean` controls whether the tab can be deleted.
- `is_draggable: boolean` controls whether the tab can be reordered.

The homepage tab bar uses `is_draggable` (not `is_removable`) to decide drag/reorder eligibility.

Context visibility is determined by plugin `allowedContexts`.

```typescript
// Generic type S allows type-safe settings access (defaults to any)
export interface TabProps<S = any> {
    tabId: string;
    settings: S;
    semesterId?: string;
    courseId?: string;
    updateSettings: (newSettings: S) => void; // Debounced by framework
}
```

```typescript
// Generic type S allows type-safe settings access (defaults to any)
export interface TabSettingsProps<S = any> {
    tabId: string;
    settings: S;
    semesterId?: string;
    courseId?: string;
    updateSettings: (newSettings: S) => void; // Debounced by framework
}
```

```typescript
export interface TabLifecycleContext {
    tabId: string;
    semesterId?: string;
    courseId?: string;
    settings: any;
}
```

## Creating a New Plugin

Follow these steps to create a new widget or tab.

### 1. Create the Plugin Files

Create a new folder in `frontend/src/plugins/`, for example `my-new-plugin/`.

`frontend/src/plugins/my-new-plugin/widget.tsx`

```typescript
import React from 'react';
import type { WidgetDefinition, WidgetProps } from '../../services/widgetRegistry';

export const MyNew: React.FC<WidgetProps> = ({ settings, updateSettings }) => {
    // 1. Access settings directly - framework handles parsing
    const title = settings?.title || 'Default Title';

    // 2. Update settings - framework handles debouncing and API sync
    const handleTitleChange = useCallback((newTitle: string) => {
        // Just call updateSettings - framework does the rest:
        // - Updates UI immediately (Optimistic UI)
        // - Debounces API calls (300ms)
        // - Syncs to backend automatically
        updateSettings({ ...settings, title: newTitle });
    }, [settings, updateSettings]);

    return (
        <div className="h-full p-4">
            <input
                value={title}
                onChange={e => handleTitleChange(e.target.value)}
            />
        </div>
    );
};

// 3. Define the widget — only runtime-specific fields
//    (name, icon, layout, etc. are defined in metadata.ts)
export const MyNewDefinition: WidgetDefinition = {
    type: 'my-new-widget',
    component: MyNew,
    defaultSettings: { title: 'Default Title' },
};
```

### Tab Example

`frontend/src/plugins/my-new-plugin/tab.tsx`

```typescript
import React, { useCallback } from 'react';
import type { TabDefinition, TabProps } from '../../services/tabRegistry';

const NotesTab: React.FC<TabProps> = ({ settings, updateSettings }) => {
    const value = settings?.value || '';

    const handleChange = useCallback((next: string) => {
        updateSettings({ ...settings, value: next });
    }, [settings, updateSettings]);

    return (
        <div className="p-4">
            <textarea
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                style={{ width: '100%', height: '60vh' }}
            />
        </div>
    );
};

// Only runtime-specific fields — metadata is in metadata.ts
export const NotesTabDefinition: TabDefinition = {
    type: 'notes-tab',
    component: NotesTab,
    defaultSettings: { value: '' },
};
```

### 2. Register the Plugin

Plugins are auto-registered via Vite's `import.meta.glob`.
- Metadata registration reads `metadata.ts` (eagerly).
- Runtime UI registration reads `index.ts` (lazily).
- Settings registration reads `settings.ts` / `settings.tsx` (eagerly, optional).

`frontend/src/plugins/my-new-plugin/metadata.ts`

```typescript
import { createElement } from 'react';
import { Calculator } from 'lucide-react';
import { definePluginMetadata } from '../../plugin-system/contracts';
import type { TabCatalogItem, WidgetCatalogItem } from '../../plugin-system/types';

const pluginId = 'my-new-plugin';

const widgetCatalog: WidgetCatalogItem[] = [
    {
        pluginId,
        type: 'my-new-widget',
        name: 'My New Widget',
        description: 'A description of what this widget does.',
        icon: createElement(Calculator, { className: 'h-4 w-4' }),
        layout: { w: 3, h: 2, minW: 2, minH: 2 },
        maxInstances: 'unlimited',
        allowedContexts: ['semester', 'course'],
    },
];

const tabCatalog: TabCatalogItem[] = [];

export default definePluginMetadata({
    pluginId,
    widgetCatalog,
    tabCatalog,
});
```

`frontend/src/plugins/my-new-plugin/index.ts`

```typescript
import { definePluginRuntime } from '../../plugin-system/contracts';
import { MyNewDefinition } from './widget';
import { NotesTabDefinition } from './tab';

export default definePluginRuntime({
    widgetDefinitions: [MyNewDefinition],
    tabDefinitions: [NotesTabDefinition],
});
```

`frontend/src/plugins/my-new-plugin/settings.ts` **(optional — only needed if you expose plugin-global settings)**

```typescript
import { definePluginSettings } from '../../plugin-system/contracts';
import type { PluginSettingsProps, PluginSettingsSectionDefinition } from '../../services/pluginSettingsRegistry';

interface NotesSharedSettings {
    defaultTemplate: string;
    autoPinImportant: boolean;
}

const normalizeNotesSharedSettings = (settings: unknown): NotesSharedSettings => {
    if (!settings || typeof settings !== 'object') {
        return { defaultTemplate: '', autoPinImportant: false };
    }
    const value = settings as Partial<NotesSharedSettings>;
    return {
        defaultTemplate: typeof value.defaultTemplate === 'string' ? value.defaultTemplate : '',
        autoPinImportant: Boolean(value.autoPinImportant),
    };
};

const NotesPluginSettings: React.FC<PluginSettingsProps<NotesSharedSettings>> = ({
    settings,
    updateSettings,
    saveState,
    hasPendingChanges,
}) => {
    const resolved = normalizeNotesSharedSettings(settings);

    return (
        <SettingsSection title="Defaults" description="Shared settings for every Notes tab in this course.">
            <Input
                value={resolved.defaultTemplate}
                onChange={(event) => {
                    void Promise.resolve(updateSettings({ ...resolved, defaultTemplate: event.target.value }));
                }}
            />
            <Checkbox
                checked={resolved.autoPinImportant}
                onCheckedChange={(checked) => {
                    void Promise.resolve(updateSettings({ ...resolved, autoPinImportant: checked === true }));
                }}
            />
            <p>{hasPendingChanges ? 'Saving…' : `Saved state: ${saveState}`}</p>
        </SettingsSection>
    );
};

export default definePluginSettings({
    pluginSettings: [
        { id: 'notes-plugin-settings', component: NotesPluginSettings, allowedContexts: ['course'] },
    ] satisfies PluginSettingsSectionDefinition[],
});
```

### Validation Rules

The plugin manager validates declarations at startup and runtime:
- `pluginId` must be unique.
- Tab `type` values must be unique across all plugins.
- Widget `type` values must be unique across all plugins.
- Each `pluginSettings` section `id` must be non-empty and unique within the plugin.
- `index.ts` runtime definitions must exactly match the types declared in `metadata.ts`.

Development behavior:
- Invalid declarations throw immediately.
- Metadata/settings edits trigger plugin-system invalidation and a full rebuild of plugin snapshots.
- Runtime edits hot-reload the affected plugin directory and re-register its runtime definitions.

## Framework-Level Performance Optimizations

The plugin framework provides automatic performance optimizations. **Plugin developers do not need to implement these manually.**

### Optimistic UI + Debounced API Sync

When you call `updateSettings(newSettings)`:

1. **Immediate UI update**: Local state updates instantly for responsive user experience
2. **Debounced API call**: Multiple rapid updates are batched into a single API call (300ms debounce)
3. **Automatic cleanup**: Pending updates are synced when component unmounts

```typescript
// ✅ CORRECT: Just call updateSettings, framework handles everything
const handleChange = (value: string) => {
    updateSettings({ ...settings, myField: value });
};

// ❌ WRONG: Don't call API directly for settings updates
const handleChange = async (value: string) => {
    await api.updateWidget(widgetId, { settings: JSON.stringify(...) });
};
```

The same rule now applies to `PluginSettingsProps.updateSettings(...)` for regular plugin-global shared settings. Call the framework hook and let the platform batch and persist the JSON payload. Only builtin or host-coupled plugins should bypass this and call private APIs directly.

### React.memo Optimization

Both Widget and Tab components are automatically wrapped with `React.memo` at the framework level. The framework uses custom comparison functions that only trigger re-renders when:
- Widget/Tab instance ID changes
- Parsed settings object changes (deep comparison via `jsonDeepEqual` from `plugin-system/utils`)
- Context (`semesterId` / `courseId`) changes

**Important**: Do not manually wrap the exported root widget or tab component with `React.memo`; the framework already does that through `WidgetRegistry` and `TabRegistry`. Internal heavy child components can still be memoized if profiling shows they need it.

## Lifecycle Hooks

Lifecycle hooks apply to both widgets and tabs.

### onCreate

Called **after** the widget/tab is successfully created in the database. If this function throws an error, the widget/tab will be automatically rolled back (deleted).

```typescript
onCreate: async (ctx) => {
    console.log(`Widget ${ctx.widgetId} created`);
    // Initialize external resources, setup subscriptions, etc.
    // Throw an error to cancel widget creation
}
```

### onDelete

Called **after** the widget/tab is successfully deleted from the database. Errors in this function are logged but do not affect the deletion.

```typescript
onDelete: async (ctx) => {
    console.log(`Widget ${ctx.widgetId} deleted`);
    // Clean up external resources, cancel subscriptions, etc.
}
```

### Example with Lifecycle Hooks

```typescript
export const MyDefinition: WidgetDefinition = {
    type: 'my-widget',
    component: My,
    defaultSettings: {},
    
    onCreate: async (ctx) => {
        // Example: register with an external service
        await externalService.register(ctx.widgetId);
    },
    
    onDelete: async (ctx) => {
        // Example: unregister from external service
        await externalService.unregister(ctx.widgetId);
    }
};
```

## Best Practices

### Settings Normalization

Always implement a **normalize function** for your settings to handle missing, corrupted, or legacy data defensively:

```typescript
interface MyWidgetSettings {
    title: string;
    count: number;
    showBorder: boolean;
}

const normalizeSettings = (settings: unknown): MyWidgetSettings => {
    if (!settings || typeof settings !== 'object') {
        return { title: '', count: 0, showBorder: true };
    }
    const s = settings as Partial<MyWidgetSettings>;
    return {
        title: typeof s.title === 'string' ? s.title : '',
        count: Number.isFinite(s.count) ? s.count as number : 0,
        showBorder: typeof s.showBorder === 'boolean' ? s.showBorder : true,
    };
};

// Use in component:
const MyWidget: React.FC<WidgetProps> = ({ settings, updateSettings }) => {
    const { title, count, showBorder } = normalizeSettings(settings);
    // ...
};

// Use in settings component:
const MySettings: React.FC<WidgetSettingsProps> = ({ settings, onSettingsChange }) => {
    const normalized = normalizeSettings(settings);
    // Always spread from normalized, not raw settings:
    onSettingsChange({ ...normalized, title: 'new' });
};
```

**Why**: Avoid unsafe `as` casts. Settings come from the database and may be missing fields (schema evolution), have wrong types (data corruption), or contain legacy fields (migration). A normalizer ensures runtime safety.

### State Management

- **Use `settings` prop directly**: The framework handles parsing and provides an object
- **Use `updateSettings` for persistence**: Don't call `api.updateWidget` directly for settings
- **Trust the Optimistic UI**: UI updates are immediate, no need for local state in most cases
- **Use normalizer functions**: Never cast `settings as MySettings` — use a normalizer instead

### Shared Settings (Tab + Widget)

When a plugin provides both a tab and a widget, keep settings in a single JSON object
but split into namespaces to avoid conflicts:

```json
{
  "shared": { "timezone": "UTC" },
  "widget": { "sizeMode": "compact" },
  "tab": { "layout": "timeline" }
}
```

- Put business data in `shared`
- Put view-only configuration in `widget` or `tab`

### When to Use Local State

Only use local state (`useState`) when:
- You need temporary UI state that shouldn't be persisted (e.g., hover state, dropdown open)
- You're managing derived/computed values

```typescript
// ❌ WRONG: Duplicating settings into local state
const [value, setValue] = useState(settings.value);
// Problem: May get out of sync with settings prop

// ✅ CORRECT: Use settings directly
const value = settings.value;
const handleChange = (newValue) => {
    updateSettings({ ...settings, value: newValue });
};
```

### Styling with Tailwind CSS and shadcn/ui

Semestra uses **Tailwind CSS** and **shadcn/ui** for all UI components. Plugin developers should follow these conventions:

#### Tailwind CSS Utilities

- **Spacing**: Use Tailwind spacing utilities (`p-4`, `mb-2`, `gap-4`) instead of custom CSS
- **Colors**: Use Tailwind color tokens that adapt to theme:
  - Text: `text-foreground`, `text-muted-foreground`, `text-primary`
  - Backgrounds: `bg-background`, `bg-card`, `bg-muted`
  - Borders: `border-border`, `border-input`
- **Responsive Design**: Use responsive modifiers (`sm:`, `md:`, `lg:`)
- **Dark Mode**: Classes automatically adapt via `dark:` variant

#### shadcn/ui Components

Use shadcn/ui components for consistent UI. Common components:

- **Forms**: `Input`, `Label`, `Checkbox`, `Select`, `RadioGroup`
- **Feedback**: `Button`, `Badge`, `Progress`, `Skeleton`
- **Layout**: `Card`, `Separator`, `Tabs`, `Dialog`
- **Data**: `Table`, `Avatar`

**Example usage**:
```typescript
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';

const MyWidget: React.FC<WidgetProps> = ({ settings, updateSettings }) => {
    return (
        <div className="h-full flex flex-col gap-4 p-4">
            <Input 
                value={settings.title} 
                onChange={(e) => updateSettings({ ...settings, title: e.target.value })}
                className="w-full"
            />
            <Button onClick={handleAction}>Save</Button>
        </div>
    );
};
```

#### CSS Variables for Theme Consistency

When custom CSS is needed, use CSS variables:
- `var(--foreground)` - Primary text color
- `var(--muted-foreground)` - Secondary text color
- `var(--background)` - Primary background
- `var(--card)` - Card background
- `var(--border)` - Border color
- `var(--radius-md)` - Border radius

#### Layout Guidelines

- **Widgets**: Framework container provides border and base surface, but does **not** provide content padding. Plugin root should fill available space with `h-full` and define its own spacing (`p-3`, `p-4`, etc.).
- **Tabs**: Optimize for large layouts, avoid fixed heights
- **Responsive**: Test on different screen sizes and grid dimensions

### Example: Builtin Gradebook

See `frontend/src/plugins/builtin-gradebook/tab.tsx` for a complete example demonstrating:
- Metadata-first registration with a lazy runtime entry in `index.ts`
- Keeping transient plan-mode and What If view state in plugin UI state while persisting domain data through backend APIs
- Pairing a course-only builtin tab with an optional read-only summary widget

## Widget UI Design Guidelines

### Core Principles

1. **No Duplicate Titles**: Avoid adding titles at the top; the container already provides them
2. **Responsive Design**: Adapt to all declared sizes using responsive Tailwind utilities
3. **Dark Mode Support**: Use Tailwind classes that automatically adapt to theme
4. **Plugin Owns Inner Spacing**: Add root spacing inside the widget (`p-3` / `p-4`) based on your design
5. **Efficient Space Usage**: Minimize unnecessary whitespace, maximize content density
6. **No Extra Borders (MUST)**: Widget framework already provides the outer border. Do not add root-level borders in plugin UI. Avoid nested border stacks (for example, parent `border` + child `border`/`border-b`) unless there is a clear data-table requirement.
7. **No Layered Shadows (MUST)**: Avoid stacking multiple shadow layers across nested containers. Use at most one subtle depth cue per visual block.

### Tailwind CSS Best Practices

**Border Rule (MUST)**:
- Keep at most one visible border container in normal widget layouts.
- Prefer spacing, background contrast, and typography hierarchy over stacked borders.
- If section separation is needed, prefer subtle `bg-*` contrast or divider lines only where strictly necessary.

**Shadow Rule (MUST)**:
- Do not stack shadows on parent + child + grandchild at the same time.
- Use one lightweight shadow only when it improves hierarchy, otherwise prefer contrast and spacing.

**Layout & Spacing**:
```tsx
// ✅ Good: Use Tailwind utilities
<div className="h-full flex flex-col gap-4 p-4">

// ❌ Bad: Custom inline styles
<div style={{ height: '100%', display: 'flex', padding: '1rem' }}>
```

**Colors & Theming**:
```tsx
// ✅ Good: Use semantic color tokens
<span className="text-foreground">Main text</span>
<span className="text-muted-foreground">Secondary text</span>
<div className="bg-card border border-border rounded-md">

// ❌ Bad: Hard-coded colors
<span style={{ color: '#000' }}>Text</span>
```

**Responsive Design**:
```tsx
// ✅ Good: Adapt to widget size
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">

// Support different widget dimensions
const isCompact = widgetWidth < 4; // Adjust layout based on grid units
```

**Interactive Elements**:
```tsx
// Add user-select-none to prevent text selection during drag
<button className="select-none hover:bg-accent transition-colors">
```

### shadcn/ui Component Usage

**Buttons & Actions**:
```tsx
import { Button } from '../../components/ui/button';

<Button variant="default" size="sm">Action</Button>
<Button variant="outline" size="sm">Secondary</Button>
<Button variant="ghost" size="icon">🔄</Button>
```

**Forms**:
```tsx
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';

<div className="space-y-2">
    <Label htmlFor="title">Title</Label>
    <Input id="title" value={value} onChange={handleChange} />
</div>
```

**Data Display**:
```tsx
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';

<Badge variant="default">{status}</Badge>
<Progress value={percentage} className="w-full" />
```

### Accessibility Requirements

1. **Keyboard Navigation**: Ensure all interactive elements are keyboard accessible
2. **ARIA Labels**: Add `aria-label` for icon-only buttons
3. **Focus Indicators**: Use Tailwind's `focus:ring-2 focus:ring-primary`
4. **Semantic HTML**: Use proper elements (`<button>`, `<input>`, etc.)

### Performance Optimization

1. **Avoid Inline Styles**: Use Tailwind classes for better performance
2. **Minimize Re-renders**: Memoize expensive internal child components only when needed; exported root tab/widget components are already memoized by the framework
3. **Lazy Load**: Use dynamic imports for large components
4. **Optimize Images**: Use appropriate formats and sizes

### CSS Variables (Legacy Support)

For custom styling when Tailwind doesn't suffice:
- `var(--foreground)` - Primary text color
- `var(--muted-foreground)` - Secondary text
- `var(--background)` - Primary background
- `var(--card)` - Card background
- `var(--border)` - Border color

## Tab UI Design Guidelines

### Core Principles

1. **No Duplicate Titles**: Avoid displaying titles; the tab bar already shows the name
2. **Maximize Content Space**: Leave vertical space for content, avoid unnecessary padding
3. **Dark Mode Support**: Use Tailwind theme-aware classes
4. **Responsive Design**: Adapt to different screen sizes

### Layout Structure

**Full-Height Content**:
```tsx
const MyTab: React.FC<TabProps> = ({ settings, updateSettings }) => {
    return (
        <div className="h-full flex flex-col">
            {/* Optional toolbar */}
            <div className="border-b border-border p-4">
                <Button>Action</Button>
            </div>
            
            {/* Main content area - grows to fill space */}
            <div className="flex-1 overflow-y-auto p-6">
                {/* Tab content */}
            </div>
        </div>
    );
};
```

### Tailwind Best Practices for Tabs

**Container Layout**:
```tsx
// ✅ Use flexbox for vertical layout
<div className="h-full flex flex-col">

// ✅ Make content scrollable
<div className="flex-1 overflow-y-auto">

// ✅ Add consistent padding
<div className="p-6 space-y-6">
```

**Responsive Grid**:
```tsx
// Adapt to screen size
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
```

### shadcn/ui Components for Tabs

**Sub-navigation**:
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';

<Tabs defaultValue="overview">
    <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
    </TabsList>
    <TabsContent value="overview">{/* Content */}</TabsContent>
</Tabs>
```

**Cards for Content Sections**:
```tsx
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';

<Card>
    <CardHeader>
        <CardTitle>Section Title</CardTitle>
    </CardHeader>
    <CardContent>{/* Content */}</CardContent>
</Card>
```

**Tables for Data**:
```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';

<Table>
    <TableHeader>
        <TableRow>
            <TableHead>Column 1</TableHead>
        </TableRow>
    </TableHeader>
    <TableBody>
        <TableRow>
            <TableCell>Data</TableCell>
        </TableRow>
    </TableBody>
</Table>
```

## Plugin Settings UI 设计规范

插件在 Settings 页面中的设置 UI 需要遵循以下规范：

### Settings 页面结构

Settings 页面采用以下层次结构：

```
Settings Page
├── Semester/Course Setting (小标题)
│   └── General (SettingsSection 卡片)
│       └── 基本设置表单
│
├── [Plugin] Plugin Name (胶囊 + 小标题)
│   ├── Global Settings (SettingsSection 卡片)
│   └── Other Category (SettingsSection 卡片, 如有)
│
├── [Plugin] Another Plugin (胶囊 + 小标题)
│   └── Display (SettingsSection 卡片)
...
```

### settings.ts(x)（插件设置入口）

插件共享设置必须在 `settings.ts` / `settings.tsx` 中通过 `definePluginSettings(...)` 注册；Tab / Widget 实例设置则挂在各自的 `SettingsComponent` 上。

```typescript
import { definePluginSettings } from '../../plugin-system/contracts';
import type { PluginSettingsProps, PluginSettingsSectionDefinition } from '../../services/pluginSettingsRegistry';
import type { TabSettingsProps } from '../../services/tabRegistry';

const MyTabSettings: React.FC<TabSettingsProps> = ({ settings, updateSettings }) => {
  return <SettingsSection title="Display">{/* tab instance settings */}</SettingsSection>;
};

interface MyPluginSharedSettings {
  accentColor: string;
}

const MyPluginSettings: React.FC<PluginSettingsProps<MyPluginSharedSettings>> = ({
  settings,
  updateSettings,
  isLoading,
}) => {
  const resolved = {
    accentColor: typeof settings?.accentColor === 'string' ? settings.accentColor : '#2563eb',
  };

  return (
    <SettingsSection title="Courses">
      <Input
        value={resolved.accentColor}
        disabled={isLoading}
        onChange={(event) => {
          void Promise.resolve(updateSettings({ ...resolved, accentColor: event.target.value }));
        }}
      />
    </SettingsSection>
  );
};

export const MyTabDefinition: TabDefinition = {
  type: 'my-tab-type',
  component: MyTab,
  SettingsComponent: MyTabSettings,
};

export default definePluginSettings({
  pluginSettings: [
    { id: 'courses', component: MyPluginSettings, allowedContexts: ['semester'] },
  ] satisfies PluginSettingsSectionDefinition[],
});
```

**设计要求：**
- 必须使用 `SettingsSection` 包装设置内容
- 可以返回多个 `SettingsSection`，每个代表一个设置分类
- 框架已经提供插件标题，不要在组件内部重复插件名
- `pluginSettings` 里的 `id` 必须非空，且在同一个插件内唯一
- 常规插件应优先使用 `PluginSettingsProps.settings` + `updateSettings(...)` 读写共享配置
- 只有 builtin / host-coupled 插件才应该跳过框架存储，直接调用私有 API

### SettingsSection 组件

`SettingsSection` 是一个卡片容器，用于组织设置项：

```typescript
interface SettingsSectionProps {
    title?: string;          // 分类标题（小写大写字母）
    description?: string;    // 分类描述
    children: React.ReactNode;
    headerAction?: React.ReactNode;  // 可选的标题区操作按钮
    center?: boolean;        // 是否垂直居中对齐
}
```

**布局结构：**
- 左侧：标题 + 描述 + 可选操作按钮（固定宽度 220px）
- 右侧：设置内容（弹性宽度）

### 设置 UI 最佳实践

1. **使用 SettingsSection 分组**
   - 每个逻辑分类使用一个 `SettingsSection`
   - 标题使用简洁的分类名称（如 "Display", "Courses", "Import/Export"）
   - 描述简要说明该分类的用途

2. **表单布局**
   - 使用 `display: flex; flex-direction: column; gap: 1rem;` 排列表单项
   - 使用项目提供的 `Input`, `Checkbox`, `Select` 等组件保持一致性

3. **避免冗余**
   - 不要在组件内重复插件名称或标题
   - 框架已经渲染了 "Plugin + 插件名" 的标题

4. **响应式设计**
   - `SettingsSection` 内置响应式布局
   - 在窄屏幕上，左侧标题区和右侧内容区会垂直堆叠

5. **Theme Compatibility**
   - Use Tailwind color tokens (e.g., `bg-card`, `text-foreground`)
   - Use shadcn/ui components instead of native HTML elements
   - Test in both light and dark modes

6. **Tailwind Conventions**
   - Prefer utility classes over custom CSS
   - Use `className` with Tailwind utilities
   - Use `cn()` utility from `lib/utils` to merge class names conditionally:
     ```tsx
     import { cn } from '../../lib/utils';
     
     <div className={cn(
         "base-classes",
         condition && "conditional-classes",
         variant === 'compact' ? "compact-classes" : "default-classes"
     )} />
     ```
