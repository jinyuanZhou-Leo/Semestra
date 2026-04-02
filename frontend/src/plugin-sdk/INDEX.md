<!-- ⚠️ Once this folder changes, update me. -->

`plugin-sdk/` is the single public authoring surface for frontend plugins.
It separates authoring concerns from plugin-system internals: plugin authors define one `plugin.ts` entry here, while the host and generator both consume the same typed definition.
Plugins should import from this folder instead of internal plugin-system modules or service-layer files.
Within a plugin folder, `settings.tsx` is the home for plugin settings UI, including tab settings and any host-level plugin settings sections; widget instance settings stay in the runtime file that owns the widget contract. Setup authoring now follows the same pattern: `setup.tsx` owns the host-provided setup component tree plus any optional setup/review override components, while `plugin.ts` just binds that single definition into the descriptor/runtime entry.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local architecture summary and file map for the plugin SDK. |
| authoring.ts | Authoring entry | Node-safe authoring-only exports used by plugin `plugin.ts` files and the manifest generation script. |
| index.ts | Public entrypoint | Exposes `definePlugin`, runtime/setup helpers, host/runtime hooks, and host-owned setup form primitives for plugin authors. |
| manifest-authoring.ts | Authoring helpers | Validates typed plugin manifests and optional setup schemas authored inline inside `plugin.ts` files, including host-rendered settings-panel bindings without a parallel settings-schema DSL. |
| manifest-types.ts | Manifest types | Declares shared icon, descriptor, settings-panel, and serialized manifest contracts. |
| types.ts | Public types | Defines stable descriptor, runtime, settings, and setup authoring types, including declarative setup component bindings plus optional setup/review override component contracts, without service-registry imports. |
