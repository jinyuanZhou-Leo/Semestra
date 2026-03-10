# Gradebook UI/UX Refactor Plan

## Goal Description
Simplify the UI/UX of the Gradebook plugin by removing redundant features, unifying the design with Shadcn and Tailwind v4, and adhering to first-principles design for a gradebook. Move configuration-heavy components (Scenarios & Categories management) out of the main tab and into the application's unified Settings Tab via the plugin framework.

## User Review Required
> [!IMPORTANT]
> Please review this plan. The most significant changes include removing the **Focus Rail** (as it duplicates information easily found elsewhere) and moving the **Scenarios and Categories Setup** out of the main tab into the Settings space. Let me know if you agree with this simplified approach.

## Proposed Changes

### 1. Settings Migration (`settings.tsx`)
- **[NEW] `frontend/src/plugins/builtin-gradebook/settings.tsx`**
  - Implement `definePluginSettings`.
  - Move the "Scenarios" and "Categories" management panels from the bottom of [tab.tsx](file:///Users/zhoujinyuan/Documents/Develop/Semestra/frontend/src/plugins/builtin-gradebook/tab.tsx) into two distinct settings sections here.
  - Set `allowedContexts: ['course']` so they only appear in course-level settings.
  - Utilize `PluginSettingsProps` and API calls (`updateCourseGradebookScenario`, etc.) to persist changes.

- **[MODIFY] [frontend/src/plugins/builtin-gradebook/index.ts](file:///Users/zhoujinyuan/Documents/Develop/Semestra/frontend/src/plugins/builtin-gradebook/index.ts)**
  - Adjust exports to potentially include the settings component if required, or let Vite's `import.meta.glob` pick it up based on [PLUGIN_DEVELOPMENT.md](file:///Users/zhoujinyuan/Documents/Develop/Semestra/PLUGIN_DEVELOPMENT.md) behavior (which says `settings.ts(x)` is eagerly loaded). No modifications may be necessary to [index.ts](file:///Users/zhoujinyuan/Documents/Develop/Semestra/frontend/src/plugins/builtin-gradebook/index.ts) if framework auto-discovers `settings.tsx`. However, we should verify framework conventions. (Actually, [metadata.ts](file:///Users/zhoujinyuan/Documents/Develop/Semestra/frontend/src/plugins/builtin-gradebook/metadata.ts) doesn't register settings, they are auto-discovered if `export default definePluginSettings(...)` is present in `settings.tsx`).

### 2. Main Tab Re-design ([tab.tsx](file:///Users/zhoujinyuan/Documents/Develop/Semestra/frontend/src/plugins/builtin-gradebook/tab.tsx))
First-principles design dictates that a student opening a gradebook wants to instantly know:
1. **Where do I stand?** (Current Projection vs Target)
2. **What's next?** (Upcoming deadlines, missing items)
3. **What-if scenarios?** (Toggling forecast modes)

The current UI duplicates this across a huge Stat header, a "Focus Rail", and complex scenarios cards.

- **[MODIFY] [frontend/src/plugins/builtin-gradebook/tab.tsx](file:///Users/zhoujinyuan/Documents/Develop/Semestra/frontend/src/plugins/builtin-gradebook/tab.tsx)**
  - **Remove "Focus Rail" (Summary, Deadlines, Validation)**
    - Deadlines and items missing due dates will simply be identifiable via the main Assessment Table and its filters.
    - Validation issues will be moved to a clean, dismissible or slim `Alert` banner at the top of the Assessment Table if they exist.
  - **Simplify the Hero Banner / Stat Cards**
    - Create a clean row of minimal cards (e.g. `Actual`, `Projected (Active Scenario)`, `Remaining Weight`, `Required Score`).
    - Consolidate the Target Input (`Percentage` / `GPA`) into a sleek inline popover or simple input next to the title, avoiding a massive block taking up vertical space.
    - Change scenario switching to a dropdown/toggle in the header rather than large selectable cards that take up a full row.
  - **Assessment Table Enhancements**
    - Redesign the table toolbar using Shadcn standard patterns (a search input on the left, filter dropdowns for Categorization/Status on the right, and the "Add Assessment" button).
    - Remove the overly bulky customized [Filter](file:///Users/zhoujinyuan/Documents/Develop/Semestra/frontend/src/plugins/builtin-gradebook/shared.ts#29-30) buttons and use Shadcn `DropdownMenu` or `ToggleGroup`.
  - **Remove Setup section**
    - Delete the `Planning Setup` card with the Scenarios/Categories tabs entirely, as they are now in `settings.tsx`.

## Verification Plan

### Automated Tests
- Type checking: `npm run typecheck`
- Existing Unit tests: Run `npm run test` (if applicable)

### Manual Verification
1. **Settings Visibility:** Open the Semestra app and navigate to a Course Settings page. Verify "Scenarios" and "Categories" appear for the Gradebook plugin. Test adding, editing, and deleting a scenario and a category.
2. **Tab Simplification:** Navigate to a Course Gradebook Tab. Verify the Scenarios/Categories setup is gone from the bottom.
3. **Core Functions:** Verify the target can still be updated, and assessments can be searched, sorted, and edited via the drawer.
4. **Scenarios:** Verify toggling the active scenario in the header updates the projection calculations correctly.
5. **UI Fidelity:** Verify the overall aesthetic feels lighter, premium, and utilizes native Shadcn components (e.g. standard Selects, Dropdowns, Cards) with Tailwind v4 standard utility classes.
