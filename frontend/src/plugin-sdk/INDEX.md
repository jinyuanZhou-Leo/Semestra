<!-- ⚠️ Once this folder changes, update me. -->

`plugin-sdk/` is the single public authoring surface for frontend plugins.
It separates authoring concerns from plugin-system internals: plugin authors define one `plugin.ts` entry here, while the host and generator both consume the same typed definition.
Plugins should import from this folder instead of internal plugin-system modules or service-layer files.
Within a plugin folder, `settings.tsx` is the home for plugin settings UI, including tab settings and any host-level plugin settings sections; widget instance settings stay in the runtime file that owns the widget contract. Setup authoring now follows the same pattern: `setup.tsx` owns the host-provided setup component tree plus any optional setup/review override components, each setup field declares the generic `settings_key` it configures, and `plugin.ts` just binds that single definition into the descriptor/runtime entry. For `settings.tsx` plugin panels, the SDK now also exposes bound common field templates plus `usePluginSettingsBucket(...)` and `usePluginSettingField(...)` so plugin authors can bind settings without reaching into plugin-system internals.

## Plugin Settings API Layers

### Layer A: Standard bound fields

Use `PluginSettingsTextField`, `PluginSettingsBooleanField`, `PluginSettingsSelectField`, and the other bound field components when the setting maps cleanly to a standard control. These components wire scope-aware persistence automatically.

```tsx
<PluginSettingsTextField
  settingsKey="my-settings"
  fieldPath="title"
  label="Title"
/>
```

### Layer B: Custom controls

Use `usePluginSettingField(...)` when you need custom rendering, then pair it with `PluginSettingsFieldLabelRow` for a consistent label row without reaching into internal helpers.

```tsx
const titleField = usePluginSettingField<string>("my-settings", "title");

<Field>
  <FieldLabel>
    <PluginSettingsFieldLabelRow label="Title" />
  </FieldLabel>
  <MyCustomInput
    value={titleField.value ?? ""}
    onChange={(nextValue) => {
      void titleField.setValue(nextValue);
    }}
  />
</Field>
```

### Layer C: Fully custom settings UIs

Use `usePluginSettingsBucket(...)` when the UI manages a whole settings object and `usePluginSettingsContext()` when the section needs direct access to the host-injected `pluginId`, `scope`, or refresh callback. This is the right fit for CRUD-heavy settings panels that do not map to single-field host controls.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local architecture summary and file map for the plugin SDK. |
| authoring.ts | Authoring entry | Node-safe authoring-only exports used by plugin `plugin.ts` files and the manifest generation script. |
| index.ts | Public entrypoint | Exposes `definePlugin`, runtime/setup helpers, settings-panel field templates and hooks, host/runtime hooks, and host-owned setup form primitives for plugin authors. |
| manifest-authoring.ts | Authoring helpers | Validates typed plugin manifests and optional setup schemas authored inline inside `plugin.ts` files, including required setup-field `settings_key` ownership metadata and host-rendered settings-panel bindings without a parallel settings-schema DSL. |
| manifest-types.ts | Manifest types | Declares shared icon, descriptor, settings-panel, and serialized manifest contracts, including setup-field `settings_key` metadata. |
| types.ts | Public types | Defines stable descriptor, runtime, settings, and setup authoring types, including declarative setup component bindings plus optional setup/review override component contracts, without service-registry imports. |
