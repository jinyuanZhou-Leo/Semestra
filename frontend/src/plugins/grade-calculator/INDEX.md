<!-- ⚠️ Once this folder changes, update me. -->

Grade calculator is a course-scoped widget plugin for planning weighted assessments.
It keeps the original compact inline-edit table layout used inside the dashboard widget shell.
The widget keeps totals reactive while letting users sort assessment rows by weight or grade.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local architecture summary and file map for the grade calculator plugin. |
| index.ts | Runtime entry | Registers the widget definition with the plugin runtime loader. |
| metadata.ts | Plugin metadata | Declares catalog name, icon, layout, and course-only availability. |
| widget.tsx | Widget runtime | Renders the compact inline-edit assessment table, GPA projection sync, and sortable weight/grade columns. |
