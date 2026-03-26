<!-- ⚠️ Once this folder changes, update me. -->

Extracted presentational components for the Canvas integration tab.
This folder keeps rendering concerns out of the tab controller and groups the rail, loading, CTA prompt, assignment/grade, Home/page list-detail, module, quiz, syllabus, and HTML-body views by semantic responsibility.
Most files here stay UI-only; the module view now owns its viewport-windowing math and reads inline module item summaries from the parent modules payload while section routing remains in the parent tab runtime.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for extracted Canvas integration UI components. |
| index.ts | Barrel export | Re-exports the extracted Canvas tab UI components. |
| CanvasAnnouncementViews.tsx | Announcement views | Renders Canvas announcement list and detail surfaces. |
| CanvasAssignmentsAndGradesView.tsx | Assignment/grade views | Renders native Canvas Assignments rows, a Canvas-backed Grades panel sourced from the Canvas Enrollments API chain, and a standalone restrained Gradebook recommendation card. |
| CanvasHtmlFragment.tsx | HTML renderer | Renders sanitized Canvas HTML with tuned reading typography, richer table/image treatment, same-course page links routed internally, and shrink-safe content inside the plugin shell. |
| CanvasLinkPromptView.tsx | CTA prompt view | Renders open-in-Canvas or external-website prompts for unsupported or external tabs. |
| CanvasModulesView.tsx | Module view | Renders Canvas module sections as expanded-by-default collapsible cards that window offscreen sections, consume inline item summaries from the modules payload instead of issuing one list request per module, keep supported module items in-app with native detail drill-down plus locally cached native blob-backed file rendering, and only open External or Discussion items in Canvas. |
| CanvasPageViews.tsx | Page views | Renders Canvas Home/page detail surfaces plus the Pages list flow, including shadcn alert treatment for locked pages. |
| CanvasQuizzesView.tsx | Quiz view | Renders the Canvas quiz list as a native Semestra view with external open actions. |
| CanvasRailButton.tsx | Rail item | Renders one left-rail Canvas course-menu entry. |
| CanvasShellStates.tsx | Loading states | Provides the full-shell and content-area loading skeletons. |
| CanvasSyllabusView.tsx | Syllabus view | Renders Canvas syllabus HTML with in-app same-course page navigation support. |
