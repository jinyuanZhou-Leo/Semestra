<!-- ⚠️ Once this folder changes, update me. -->

`plugin-sdk/` is the single public authoring surface for frontend plugins.
It exposes descriptor-backed plugin definitions plus runtime and host helpers without leaking internal registries.
Plugins should import from this folder instead of `plugin-system/contracts` or `services/*`.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local architecture summary and file map for the plugin SDK. |
| index.ts | Public entrypoint | Exposes `definePlugin`, runtime/setup helpers, and host/runtime hooks for plugin authors. |
| types.ts | Public types | Defines stable descriptor, runtime, settings, and setup authoring types without service-registry imports. |
