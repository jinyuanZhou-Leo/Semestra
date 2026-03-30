<!-- ⚠️ Once this folder changes, update me. -->

`plugin-sdk/` is the single public authoring surface for frontend plugins.
It separates authoring concerns from plugin-system internals: plugin authors define one `plugin.ts` entry here, while the host and generator both consume the same typed definition.
Plugins should import from this folder instead of internal plugin-system modules or service-layer files.
Within a plugin folder, `settings.tsx` is the home for plugin settings UI, including tab settings and any host-level plugin settings sections; widget instance settings stay in the runtime file that owns the widget contract.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local architecture summary and file map for the plugin SDK. |
| authoring.ts | Authoring entry | Node-safe authoring-only exports used by plugin `plugin.ts` files and the manifest generation script. |
| index.ts | Public entrypoint | Exposes `definePlugin`, runtime/setup helpers, and host/runtime hooks for plugin authors. |
| manifest-authoring.ts | Authoring helpers | Validates typed plugin manifests and optional setup schemas authored inline inside `plugin.ts` files. |
| manifest-types.ts | Manifest types | Declares shared icon, descriptor, settings, and serialized manifest contracts. |
| types.ts | Public types | Defines stable descriptor, runtime, settings, and setup authoring types without service-registry imports. |
