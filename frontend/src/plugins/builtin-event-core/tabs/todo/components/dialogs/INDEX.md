<!-- ⚠️ Once this folder changes, update me. -->

`dialogs/` contains the remaining modal surfaces used by the Todo tab.
Quick edits now happen inline, so this folder is only responsible for explicit full-detail task editing.
It stays small on purpose to keep the inline-first interaction model easy to reason about.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for todo dialog components. |
| TodoTaskDialog.tsx | Full-detail task dialog | Secondary editor for task note, section assignment, and structured task fields when inline editing is not enough. |
