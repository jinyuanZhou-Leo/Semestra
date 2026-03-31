<!-- ⚠️ Once this folder changes, update me. -->

shadcn primitive source files live here as local, project-owned UI building blocks.
These files wrap Radix or related low-level libraries behind the app's shared Tailwind v4 styling and slot conventions.
`command.tsx` now keeps its dialog accessibility structure aligned with the current shadcn documentation.

| File | Role | Description |
|------|------|-------------|
| command.tsx | UI primitive | Provides the app's shadcn `Command` wrapper set, with `CommandDialog` keeping `DialogHeader`, `DialogTitle`, and `DialogDescription` inside `DialogContent` to match the documented shadcn structure. |
