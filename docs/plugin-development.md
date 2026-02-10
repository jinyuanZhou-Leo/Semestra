# Plugin Development Guide

## Goals

- Keep plugin metadata available immediately for UI (name, icon, description, limits, contexts).
- Keep plugin runtime code lazy-loaded to reduce startup cost.
- Keep plugin ownership inside each plugin folder for better third-party decoupling.

## Required Plugin Structure

Each plugin should live in its own folder under `frontend/src/plugins/<plugin-name>/`:

- `metadata.ts`: lightweight metadata only, loaded eagerly by framework.
- `index.ts`: runtime entry, loaded lazily by framework.
- `tab.tsx` / `widget.tsx` (or split files): actual plugin implementation.

Example:

```text
frontend/src/plugins/counter/
  metadata.ts
  index.ts
  widget.tsx
```

## metadata.ts Contract

`metadata.ts` must export:

- `pluginId: string`
- `tabCatalog?: TabCatalogItem[]`
- `widgetCatalog?: WidgetCatalogItem[]`

The plugin-system layer uses `import.meta.glob('../plugins/*/metadata.ts', { eager: true })` to collect these values.

Guidelines:

- Keep `metadata.ts` lightweight. Do not import heavy runtime logic.
- Icon references are allowed here (for add/list dialogs and placeholders).
- `tabCatalog` and `widgetCatalog` should only describe discoverability and constraints.

## index.ts Contract

`index.ts` is the lazy runtime entry. It should export one or more of:

- `tabDefinition`
- `tabDefinitions`
- `widgetDefinition`
- `widgetDefinitions`

The runtime loads `index.ts` only when a plugin type is needed and then registers definitions into registries.

## Builtin Plugins vs Third-party Plugins

Builtin and third-party plugins follow the same loading model:

- Both provide local `metadata.ts`.
- Both are lazy-loaded through `index.ts`.
- Product policy differences (for example, builtin cannot be removed by users) should be handled at business/UI layer, not plugin loading layer.

## Compatibility Notes

- Existing runtime APIs (catalog queries, metadata resolution, lazy ensure methods) remain unchanged.
- Optimistic UI and memoization behavior should not depend on eager runtime registration.
- Metadata is now the first source for pre-load display; runtime definition becomes authoritative after lazy load.

## Layout Alignment Rule (Important)

To avoid horizontal misalignment between plugin content and the page header area:

- Do not add extra left/right padding in plugin root containers (for example, avoid `p-*`, `px-*` on the top-level wrapper).
- Rely on the page/layout container to provide horizontal spacing.
- If internal spacing is needed, prefer vertical spacing only on plugin root (`py-*`, `space-y-*`) and add local padding only to inner blocks when required.

This is especially important for loading placeholders/skeletons. A plugin skeleton should not introduce additional horizontal padding, otherwise the skeleton width will not align with the content above it.
