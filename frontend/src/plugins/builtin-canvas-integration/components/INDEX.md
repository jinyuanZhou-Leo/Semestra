<!-- ⚠️ Once this folder changes, update me. -->

Extracted presentational components for the Canvas integration tab.
This folder keeps rendering concerns out of the tab controller and groups the rail, loading, CTA prompt, Home/page list-detail, module, quiz, syllabus, and HTML-body views by semantic responsibility.
All files here stay UI-only; queries, cache decisions, and section-state routing remain in the parent tab runtime.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for extracted Canvas integration UI components. |
| index.ts | Barrel export | Re-exports the extracted Canvas tab UI components. |
| CanvasAnnouncementViews.tsx | Announcement views | Renders Canvas announcement list and detail surfaces. |
| CanvasHtmlFragment.tsx | HTML renderer | Renders sanitized Canvas HTML with tuned reading typography, richer table/image treatment, and same-course page links routed internally. |
| CanvasLinkPromptView.tsx | CTA prompt view | Renders open-in-Canvas or external-website prompts for unsupported or external tabs. |
| CanvasModulesView.tsx | Module view | Renders Canvas module sections as memoized collapsible cards that all start open, swap section bodies instantly instead of animating height, use browser offscreen-skipping for long lists, preserve in-app page routing, and underline external-link titles on hover. |
| CanvasPageViews.tsx | Page views | Renders Canvas Home/page detail surfaces plus the Pages list flow, including shadcn alert treatment for locked pages. |
| CanvasQuizzesView.tsx | Quiz view | Renders the Canvas quiz list as a native Semestra view with external open actions. |
| CanvasRailButton.tsx | Rail item | Renders one left-rail Canvas course-menu entry. |
| CanvasShellStates.tsx | Loading states | Provides the full-shell and content-area loading skeletons. |
| CanvasSyllabusView.tsx | Syllabus view | Renders Canvas syllabus HTML with in-app same-course page navigation support. |
