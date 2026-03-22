<!-- ⚠️ Once this folder changes, update me. -->

Canvas navigation tab plugin for Canvas-linked courses.
The tab browser now mirrors Canvas web app semantics with a sticky course-menu rail on the left and right-side content for every visible Canvas tab.
Home follows Canvas `default_view`, keeps `assignments` and `grades` as first-class Canvas tab ids with Semestra-native views, still hides `files`/discussion tab ids, routes unknown internal tabs to a fallback open-in-Canvas prompt, shows external tabs as in-pane launch prompts instead of confirmation dialogs, and aligns plugin-level unavailable states with the shared host empty-state sizing.
Assignments and Grades now render their own native views, with a standalone restrained recommendation card that hands users off to the Gradebook plugin while leaving the main section content aligned with other Canvas tabs. The Grades panel now reads real Canvas grade objects through the backend `lms/grades` endpoint backed by the Canvas Enrollments API instead of local Gradebook data, while Modules keep their memoized all-open instant-collapse behavior for long lists. Locked Canvas pages use a native shadcn alert treatment instead of bespoke callout chrome, Canvas rich-text bodies now use a stronger Semestra typography layer for headings, prose, lists, tables, and images, and the left rail measures the workspace sticky header so it does not slide under the Course Homepage title bar.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for the Canvas integration plugin files. |
| components/ | UI subdirectory | Extracted semantic Canvas tab UI components grouped by rail, loading, assignment/grade, HTML, CTA prompt, page, announcement, module, quiz, and syllabus responsibilities. |
| index.ts | Runtime entry | Registers the Canvas pages tab runtime through `definePluginRuntime(...)`. |
| metadata.ts | Plugin metadata | Declares the course-only Canvas pages tab catalog entry. |
| shared.ts | Shared helpers | Stores plugin constants plus LMS URL resolution, page-link parsing, and timestamp formatting helpers. |
| tab-helpers.ts | Runtime helpers | Holds query defaults, hidden-tab filtering, navigation-entry mapping, Home fallback resolution, LMS URL helpers, and other non-visual runtime utilities shared by the extracted tab files. |
| tab.test.tsx | Test file | Verifies Canvas-link prompting, host-aligned unavailable-state sizing, assignment/grade rail visibility, Home fallback routing, sticky-rail offset behavior, all-open collapsible module interactions, Gradebook CTA handoff, locked-page alerts, external/unknown CTA rendering, and native quizzes/syllabus views. |
| tab.tsx | Tab runtime | Owns selected-tab state, filtered navigation composition, Home fallback routing, query orchestration for assignment/grade/page/announcement/module/quiz/syllabus reads, framework-aligned unavailable-state rendering, host-aware sticky rail offset measurement, standalone Gradebook handoff-card composition, and composition of the extracted Canvas tab UI components. |
