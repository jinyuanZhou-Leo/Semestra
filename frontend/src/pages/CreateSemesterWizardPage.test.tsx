// input:  [`CreateSemesterWizardPage`, mocked Semester wizard APIs, React Router memory routes, and QueryClient test wrappers]
// output: [page-level regression tests for Semester basics validation, setup-aware wizard navigation, compact animated bottom navigation labels, draft-conflict-safe resume behavior, finalize handoff safety, Program-installed plugin filtering, plugin-system-backed setup-step visibility, plugin-system setup rendering, large-step pagination condensation, invalid step guards, and stale-refetch no-clobber behavior inside the Semester creation wizard]
// pos:    [Route test suite guarding the standalone Create Semester wizard host flow against invalid basics input, draft-create conflict regressions, setup-step drift, activation-vs-plugin-system setup visibility mismatches, pagination overflow regressions, bottom-navigation regressions, stale refetch overwrites, finalize teardown regressions, availability leaks, missing plugin-system setup wiring, and invalid finalize states]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClientWrapper } from "@/test/queryClientWrapper";

import { buildPaginationStepTokens, CreateSemesterWizardPage } from "./CreateSemesterWizardPage";

const {
  apiMock,
  reportErrorMock,
  getPluginSetupDefinitionByIdMock,
  validatePluginSetupDefinitionMock,
} = vi.hoisted(() => ({
  apiMock: {
    getProgram: vi.fn(),
    getCurrentSemesterDraft: vi.fn(),
    getSemester: vi.fn(),
    createSemesterDraft: vi.fn(),
    updateSemesterDraft: vi.fn(),
    reviewSemesterDraft: vi.fn(),
    reviewSemesterPluginSystem: vi.fn(),
    finalizeSemesterDraft: vi.fn(),
    discardSemesterDraft: vi.fn(),
    getSemesterPluginSystemSetup: vi.fn(),
    updateSemesterPluginSystemSetup: vi.fn(),
    upsertSemesterPluginActivation: vi.fn(),
    bulkUpdateSemesterPluginActivations: vi.fn(),
    deleteSemesterPluginActivation: vi.fn(),
    createCourse: vi.fn(),
    deleteCourse: vi.fn(),
  },
  reportErrorMock: vi.fn(),
  getPluginSetupDefinitionByIdMock: vi.fn(),
  validatePluginSetupDefinitionMock: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  default: apiMock,
}));

vi.mock("../services/appStatus", () => ({
  reportError: reportErrorMock,
}));

vi.mock("@/plugin-system", () => ({
  getPluginIconById: () => null,
  getPluginSetupDefinitionById: getPluginSetupDefinitionByIdMock,
  resolvePluginSetupValues: (definition: { fields: Record<string, { defaultValue?: unknown }> }, values: Record<string, unknown>) => (
    Object.fromEntries(
      Object.entries(definition.fields).map(([fieldKey, field]) => (
        Object.prototype.hasOwnProperty.call(values, fieldKey)
          ? [fieldKey, values[fieldKey]]
          : [fieldKey, field.defaultValue ?? null]
      )),
    )
  ),
  validatePluginSetupDefinition: validatePluginSetupDefinitionMock,
}));

vi.mock("../components/Layout", () => ({
  Layout: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("../components/CourseManagerModal", () => ({
  CourseManagerModal: () => null,
}));

const createMatchMedia = () => ({
  matches: false,
  media: "",
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation(createMatchMedia),
});

const renderWizard = () => {
  const { Wrapper } = createQueryClientWrapper();

  return render(
    <MemoryRouter initialEntries={["/programs/program-1/semesters/create"]}>
      <Routes>
        <Route path="/programs/:id/semesters/create" element={<CreateSemesterWizardPage />} />
        <Route path="/programs/:id" element={<div>Program dashboard</div>} />
        <Route path="/semesters/:id" element={<div>Semester homepage</div>} />
      </Routes>
    </MemoryRouter>,
    { wrapper: Wrapper },
  );
};

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("CreateSemesterWizardPage", () => {
  beforeEach(() => {
    Object.values(apiMock).forEach((mock) => mock.mockReset());
    reportErrorMock.mockReset();
    getPluginSetupDefinitionByIdMock.mockReset();
    validatePluginSetupDefinitionMock.mockReset();
    getPluginSetupDefinitionByIdMock.mockReturnValue(undefined);
    validatePluginSetupDefinitionMock.mockResolvedValue([]);
    apiMock.updateSemesterDraft.mockImplementation(async (_draftId: string, data: Record<string, unknown>) => ({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: String(data.creation_step ?? "basics"),
      draft_updated_at: "2026-03-27T10:00:00Z",
      review_ready: false,
      review_errors: [],
      plugin_activations: [],
    }));
    apiMock.getSemesterPluginSystemSetup.mockResolvedValue({
      semester_id: "draft-1",
      step: "plugin-setup",
      plugins: [],
    });
    apiMock.reviewSemesterPluginSystem.mockResolvedValue({
      semester_id: "draft-1",
      plugins: [],
      has_errors: false,
    });
  });

  it("shows unavailable Program-installed plugins as non-selectable in the Plugins step", async () => {
    apiMock.getProgram.mockResolvedValue({
      id: "program-1",
      name: "Engineering",
      plugin_installations: [
        {
          id: "installation-1",
          plugin_id: "course-list",
          display_name: "Course List",
          description: "Semester course list widget and course-management defaults.",
          author: "Jinyuan",
          default_version: "workspace",
          locked: false,
          version: "workspace",
          is_enabled: true,
          auth_state: "not-required",
          auth_message: null,
          capabilities: { contexts: ["semester"], available_widget_types: ["course-list"] },
          setup_sections: [],
          available: true,
          availability_reason: null,
          installed: true,
        },
        {
          id: "installation-2",
          plugin_id: "builtin-canvas-integration",
          display_name: "Canvas Integration",
          description: "Canvas course navigation and content browsing plugin.",
          author: "Jinyuan",
          default_version: "workspace",
          locked: false,
          version: "workspace",
          is_enabled: true,
          auth_state: "not-required",
          auth_message: null,
          capabilities: { contexts: ["course"], available_tab_types: ["builtin-canvas-integration"] },
          setup_sections: [],
          available: false,
          availability_reason: "Program LMS integration is required.",
          installed: true,
        },
      ],
    });
    apiMock.getCurrentSemesterDraft.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "plugins",
      draft_updated_at: "2026-03-27T10:00:00Z",
      review_ready: false,
      review_errors: [],
      plugin_activations: [],
    });
    apiMock.getSemester.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "plugins",
      review_ready: false,
      courses: [],
      plugin_activations: [],
    });

    renderWizard();

    expect(await screen.findByText("Plugins")).toBeInTheDocument();
    expect(await screen.findByText("Canvas Integration")).toBeInTheDocument();
    expect(screen.getByText("Program LMS integration is required.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Basics$/ })).not.toBeInTheDocument();

    expect(screen.getByRole("switch", { name: "Toggle all editable plugins" })).not.toBeDisabled();
    expect(screen.getByRole("switch", { name: "Course List enabled" })).not.toBeDisabled();
    expect(screen.getByRole("switch", { name: "Canvas Integration enabled" })).toBeDisabled();
  });

  it("reuses Semester date-picker validation in the Basics step before navigation", async () => {
    apiMock.getProgram.mockResolvedValue({
      id: "program-1",
      name: "Engineering",
      plugin_installations: [],
    });
    apiMock.getCurrentSemesterDraft.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: "2026-02-16",
      reading_week_end: "2026-02-20",
      lifecycle_state: "draft",
      creation_step: "basics",
      draft_updated_at: "2026-03-27T10:00:00Z",
      review_ready: false,
      review_errors: [],
      plugin_activations: [],
    });
    apiMock.getSemester.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: "2026-02-16",
      reading_week_end: "2026-02-20",
      lifecycle_state: "draft",
      creation_step: "basics",
      review_ready: false,
      courses: [],
      plugin_activations: [],
    });

    renderWizard();

    expect(await screen.findByDisplayValue("Winter 2026")).toBeInTheDocument();
    expect(screen.getByText("Jan 5, 2026 - Apr 10, 2026")).toBeInTheDocument();
    expect(screen.getByText("Feb 16, 2026 - Feb 20, 2026")).toBeInTheDocument();
    expect(screen.getByText("Reading Week must span exactly one Monday-to-Sunday week.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Courses" })).toBeDisabled();
  });

  it("falls back safely when the server returns an unknown draft step", async () => {
    apiMock.getProgram.mockResolvedValue({
      id: "program-1",
      name: "Engineering",
      plugin_installations: [],
    });
    apiMock.getCurrentSemesterDraft.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "unexpected-step",
      draft_updated_at: "2026-03-27T10:00:00Z",
      review_ready: false,
      review_errors: [],
      plugin_activations: [],
    });
    apiMock.getSemester.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "review",
      review_ready: false,
      courses: [],
      plugin_activations: [],
    });

    renderWizard();

    expect(await screen.findByRole("heading", { name: "Basics" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Courses" })).toBeInTheDocument();
  });

  it("keeps newer local basics edits when an older draft refetch lands after autosave", async () => {
    let resolveSave: (() => void) | null = null;
    let currentDraftResponse = {
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "basics",
      draft_updated_at: "2026-03-27T10:00:00Z",
      review_ready: true,
      review_errors: [],
      plugin_activations: [],
    };
    apiMock.getProgram.mockResolvedValue({
      id: "program-1",
      name: "Engineering",
      plugin_installations: [],
    });
    apiMock.getCurrentSemesterDraft.mockImplementation(async () => currentDraftResponse);
    apiMock.getSemester.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "basics",
      review_ready: true,
      courses: [],
      plugin_activations: [],
    });
    apiMock.updateSemesterDraft.mockImplementation(async (_draftId: string, data: Record<string, unknown>) => {
      currentDraftResponse = {
        ...currentDraftResponse,
        name: String(data.name ?? currentDraftResponse.name),
        creation_step: String(data.creation_step ?? currentDraftResponse.creation_step),
      };
      await new Promise<void>((resolve) => {
        resolveSave = resolve;
      });
      return currentDraftResponse;
    });

    renderWizard();

    const nameInput = await screen.findByDisplayValue("Winter 2026");
    fireEvent.change(nameInput, { target: { value: "Winter 2026 saved" } });

    await waitFor(() => {
      expect(apiMock.updateSemesterDraft).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(nameInput, { target: { value: "Winter 2026 newest" } });

    await act(async () => {
      resolveSave?.();
      await flushMicrotasks();
    });

    await waitFor(() => {
      expect(apiMock.getCurrentSemesterDraft).toHaveBeenCalledTimes(2);
    });

    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("Winter 2026 newest");
  });

  it("renders review blockers and keeps finalize disabled when review is not ready", async () => {
    apiMock.getProgram.mockResolvedValue({
      id: "program-1",
      name: "Engineering",
      plugin_installations: [],
    });
    apiMock.getCurrentSemesterDraft.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: "2026-02-16",
      reading_week_end: "2026-02-20",
      lifecycle_state: "draft",
      creation_step: "review",
      draft_updated_at: "2026-03-27T10:00:00Z",
      review_ready: false,
      review_errors: [
        {
          code: "INVALID_READING_WEEK_SPAN",
          message: "Reading week must stay inside the Semester date range.",
          step: "basics",
          plugin_id: null,
          field_path: "reading_week_start",
        },
      ],
      plugin_activations: [],
    });
    apiMock.getSemester.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: "2026-02-16",
      reading_week_end: "2026-02-20",
      lifecycle_state: "draft",
      creation_step: "review",
      review_ready: false,
      courses: [],
      plugin_activations: [],
    });

    renderWizard();

    expect(await screen.findByText("Reading week must stay inside the Semester date range.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Semester" })).toBeDisabled();
  });

  it("renders plugin setup fields from the plugin-system setup endpoint", async () => {
    apiMock.getProgram.mockResolvedValue({
      id: "program-1",
      name: "Engineering",
      plugin_installations: [],
    });
    apiMock.getCurrentSemesterDraft.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "plugin-setup",
      draft_updated_at: "2026-03-27T10:00:00Z",
      review_ready: false,
      review_errors: [],
      plugin_activations: [
        {
          semester_id: "draft-1",
          program_plugin_installation_id: "installation-1",
          plugin_id: "mock-setup-plugin",
          display_name: "Mock Setup Plugin",
          description: "Mock setup contribution for wizard coverage.",
          author: "Jinyuan",
          version: "workspace",
          is_enabled: true,
          auth_state: "not-required",
          capabilities: {},
          setup_sections: [
            {
              id: "mock-setup",
              title: "Mock Setup",
              description: "Configure the mock plugin before activation.",
              fields: [],
            },
          ],
          setup_values: {},
          setup_summary: [],
          review_errors: [],
          available: true,
          availability_reason: null,
        },
      ],
    });
    apiMock.getSemester.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "plugin-setup",
      review_ready: false,
      courses: [],
      plugin_activations: [
        {
          semester_id: "draft-1",
          program_plugin_installation_id: "installation-1",
          plugin_id: "mock-setup-plugin",
          display_name: "Mock Setup Plugin",
          description: "Mock setup contribution for wizard coverage.",
          author: "Jinyuan",
          version: "workspace",
          is_enabled: true,
          auth_state: "not-required",
          capabilities: {},
          setup_sections: [
            {
              id: "mock-setup",
              title: "Mock Setup",
              description: "Configure the mock plugin before activation.",
              fields: [],
            },
          ],
          setup_values: {},
          setup_summary: [],
          review_errors: [],
          available: true,
          availability_reason: null,
        },
      ],
    });
    apiMock.getSemesterPluginSystemSetup.mockResolvedValue({
      semester_id: "draft-1",
      step: "plugin-setup",
      plugins: [
        {
          plugin_id: "mock-setup-plugin",
          display_name: "Mock Setup Plugin",
          description: "Mock setup contribution for wizard coverage.",
          author: "Jinyuan",
          is_enabled: true,
          available: true,
          availability_reason: null,
          setup_values: { mockSetting: "enabled" },
          setup_summary: [],
          review_errors: [],
          setup_sections: [
            {
              id: "mock-setup",
              title: "Mock Setup",
              description: "Configure the mock plugin before activation.",
              fields: [
                {
                  path: "mockSetting",
                  label: "Mock setting",
                  type: "select",
                  required: true,
                  default_value: "enabled",
                  description: "Configure the mock plugin before activation.",
                  placeholder: "",
                  options: [
                    { label: "Enabled", value: "enabled" },
                    { label: "Disabled", value: "disabled" },
                  ],
                  summary_labels: {
                    enabled: "Enabled",
                    disabled: "Disabled",
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    renderWizard();

    expect(await screen.findByText("Mock Setup")).toBeInTheDocument();
    expect(screen.getByText("Mock setting")).toBeInTheDocument();
  });

  it("treats each enabled plugin setup as its own wizard step", async () => {
    apiMock.getProgram.mockResolvedValue({
      id: "program-1",
      name: "Engineering",
      plugin_installations: [],
    });
    apiMock.getCurrentSemesterDraft.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "plugin-setup",
      draft_updated_at: "2026-03-27T10:00:00Z",
      review_ready: false,
      review_errors: [],
      plugin_activations: [
        {
          semester_id: "draft-1",
          program_plugin_installation_id: "installation-1",
          plugin_id: "first-plugin",
          display_name: "First Plugin",
          description: "First setup step.",
          author: "Jinyuan",
          version: "workspace",
          is_enabled: true,
          auth_state: "not-required",
          capabilities: {},
          setup_sections: [{ id: "first", title: "First", description: "", fields: [] }],
          setup_values: {},
          setup_summary: [],
          review_errors: [],
          available: true,
          availability_reason: null,
        },
        {
          semester_id: "draft-1",
          program_plugin_installation_id: "installation-2",
          plugin_id: "second-plugin",
          display_name: "Second Plugin",
          description: "Second setup step.",
          author: "Jinyuan",
          version: "workspace",
          is_enabled: true,
          auth_state: "not-required",
          capabilities: {},
          setup_sections: [{ id: "second", title: "Second", description: "", fields: [] }],
          setup_values: {},
          setup_summary: [],
          review_errors: [],
          available: true,
          availability_reason: null,
        },
      ],
    });
    apiMock.getSemester.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "plugin-setup",
      review_ready: false,
      courses: [],
      plugin_activations: [
        {
          semester_id: "draft-1",
          program_plugin_installation_id: "installation-1",
          plugin_id: "first-plugin",
          display_name: "First Plugin",
          description: "First setup step.",
          author: "Jinyuan",
          version: "workspace",
          is_enabled: true,
          auth_state: "not-required",
          capabilities: {},
          setup_sections: [{ id: "first", title: "First", description: "", fields: [] }],
          setup_values: {},
          setup_summary: [],
          review_errors: [],
          available: true,
          availability_reason: null,
        },
        {
          semester_id: "draft-1",
          program_plugin_installation_id: "installation-2",
          plugin_id: "second-plugin",
          display_name: "Second Plugin",
          description: "Second setup step.",
          author: "Jinyuan",
          version: "workspace",
          is_enabled: true,
          auth_state: "not-required",
          capabilities: {},
          setup_sections: [{ id: "second", title: "Second", description: "", fields: [] }],
          setup_values: {},
          setup_summary: [],
          review_errors: [],
          available: true,
          availability_reason: null,
        },
      ],
    });
    apiMock.updateSemesterDraft.mockImplementation(async (_draftId: string, data: Record<string, unknown>) => ({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: String(data.creation_step ?? "plugin-setup"),
      draft_updated_at: "2026-03-27T10:00:00Z",
      review_ready: false,
      review_errors: [],
      plugin_activations: [],
    }));
    apiMock.getSemesterPluginSystemSetup.mockResolvedValue({
      semester_id: "draft-1",
      step: "plugin-setup",
      plugins: [
        {
          plugin_id: "first-plugin",
          display_name: "First Plugin",
          description: "First setup step.",
          author: "Jinyuan",
          is_enabled: true,
          available: true,
          availability_reason: null,
          setup_values: {},
          setup_summary: [],
          review_errors: [],
          setup_sections: [{ id: "first", title: "First", description: "", fields: [] }],
        },
        {
          plugin_id: "second-plugin",
          display_name: "Second Plugin",
          description: "Second setup step.",
          author: "Jinyuan",
          is_enabled: true,
          available: true,
          availability_reason: null,
          setup_values: {},
          setup_summary: [],
          review_errors: [],
          setup_sections: [{ id: "second", title: "Second", description: "", fields: [] }],
        },
      ],
    });

    renderWizard();

    expect((await screen.findAllByRole("heading", { name: "First Plugin" })).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Second Plugin" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Second Plugin" }));

    expect((await screen.findAllByRole("heading", { name: "Second Plugin" })).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Review" })).toBeInTheDocument();
  });

  it("shows a newly enabled plugin setup step immediately from the Plugins step", async () => {
    const setupSection = [
      {
        id: "template-setup",
        title: "Template setup",
        description: "Configure the template before activation.",
      },
    ];

    apiMock.getProgram.mockResolvedValue({
      id: "program-1",
      name: "Engineering",
      plugin_installations: [
        {
          id: "installation-1",
          plugin_id: "tab-template",
          display_name: "Tab Template",
          description: "Template plugin for setup coverage.",
          long_description: "Template plugin for setup coverage.",
          author: "Jinyuan",
          default_version: "workspace",
          locked: false,
          version: "workspace",
          is_enabled: true,
          auth_state: "not-required",
          auth_message: null,
          capabilities: { contexts: ["semester"], available_tab_types: ["tab-template"] },
          setup_sections: setupSection,
          available: true,
          availability_reason: null,
          installed: true,
        },
      ],
    });
    apiMock.getCurrentSemesterDraft.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "plugins",
      draft_updated_at: "2026-03-27T10:00:00Z",
      review_ready: false,
      review_errors: [],
      plugin_activations: [],
    });
    apiMock.getSemester.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "plugins",
      review_ready: false,
      courses: [],
      plugin_activations: [],
    });
    apiMock.getSemesterPluginSystemSetup.mockResolvedValue({
      semester_id: "draft-1",
      step: "plugin-setup",
      plugins: [],
    });
    apiMock.upsertSemesterPluginActivation.mockResolvedValue({
      id: "activation-1",
      semester_id: "draft-1",
      program_plugin_installation_id: "installation-1",
      plugin_id: "tab-template",
      display_name: "Tab Template",
      description: "Template plugin for setup coverage.",
      author: "Jinyuan",
      version: "workspace",
      is_enabled: true,
      auth_state: "not-required",
      capabilities: { contexts: ["semester"], available_tab_types: ["tab-template"] },
      setup_sections: setupSection,
      setup_values: {},
      setup_summary: [],
      review_errors: [],
      available: true,
      availability_reason: null,
    });

    renderWizard();

    expect(await screen.findByText("Tab Template")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: "Tab Template enabled" }));

    await waitFor(() => {
      expect(apiMock.upsertSemesterPluginActivation).toHaveBeenCalledWith("draft-1", "tab-template", {
        is_enabled: true,
      });
    });
  });

  it("keeps the same number of visible page buttons when many steps are present", () => {
    const steps = Array.from({ length: 12 }, (_, index) => ({
      id: `step-${index + 1}` as const,
      label: `Step ${index + 1}`,
      icon: () => null,
      detail: "",
      persistedStep: "plugin-setup" as const,
    }));

    const startTokens = buildPaginationStepTokens(steps, 0);
    const middleTokens = buildPaginationStepTokens(steps, 5);
    const endTokens = buildPaginationStepTokens(steps, 11);

    expect(startTokens.filter((token) => token.type === "step")).toHaveLength(5);
    expect(middleTokens.filter((token) => token.type === "step")).toHaveLength(5);
    expect(endTokens.filter((token) => token.type === "step")).toHaveLength(5);
    expect(startTokens.filter((token) => token.type === "ellipsis").length).toBeGreaterThan(0);
    expect(middleTokens.filter((token) => token.type === "ellipsis")).toHaveLength(2);
    expect(endTokens.filter((token) => token.type === "ellipsis").length).toBeGreaterThan(0);
  });

  it("runs plugin-defined setup validation before moving to the next step", async () => {
    getPluginSetupDefinitionByIdMock.mockReturnValue({
      fields: {
        mockSetting: {
          type: "text",
          label: "Mock setting",
          required: true,
        },
      },
      sections: [
        {
          id: "mock-setup",
          title: "Mock Setup",
          fieldKeys: ["mockSetting"],
        },
      ],
    });
    validatePluginSetupDefinitionMock.mockResolvedValue([
      {
        fieldPath: "mockSetting",
        message: "Mock setting must be configured before continuing.",
      },
    ]);
    apiMock.getProgram.mockResolvedValue({
      id: "program-1",
      name: "Engineering",
      plugin_installations: [],
    });
    apiMock.getCurrentSemesterDraft.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "plugin-setup",
      draft_updated_at: "2026-03-27T10:00:00Z",
      review_ready: false,
      review_errors: [],
      plugin_activations: [
        {
          semester_id: "draft-1",
          program_plugin_installation_id: "installation-1",
          plugin_id: "mock-setup-plugin",
          display_name: "Mock Setup Plugin",
          description: "Mock setup contribution for wizard coverage.",
          author: "Jinyuan",
          version: "workspace",
          is_enabled: true,
          auth_state: "not-required",
          capabilities: {},
          setup_sections: [
            {
              id: "mock-setup",
              title: "Mock Setup",
              description: "Configure the mock plugin before activation.",
              fields: [],
            },
          ],
          setup_values: {},
          setup_summary: [],
          review_errors: [],
          available: true,
          availability_reason: null,
        },
      ],
    });
    apiMock.getSemester.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "plugin-setup",
      review_ready: false,
      courses: [],
      plugin_activations: [
        {
          semester_id: "draft-1",
          program_plugin_installation_id: "installation-1",
          plugin_id: "mock-setup-plugin",
          display_name: "Mock Setup Plugin",
          description: "Mock setup contribution for wizard coverage.",
          author: "Jinyuan",
          version: "workspace",
          is_enabled: true,
          auth_state: "not-required",
          capabilities: {},
          setup_sections: [
            {
              id: "mock-setup",
              title: "Mock Setup",
              description: "Configure the mock plugin before activation.",
              fields: [],
            },
          ],
          setup_values: {},
          setup_summary: [],
          review_errors: [],
          available: true,
          availability_reason: null,
        },
      ],
    });
    apiMock.getSemesterPluginSystemSetup.mockResolvedValue({
      semester_id: "draft-1",
      step: "plugin-setup",
      plugins: [
        {
          plugin_id: "mock-setup-plugin",
          display_name: "Mock Setup Plugin",
          description: "Mock setup contribution for wizard coverage.",
          author: "Jinyuan",
          is_enabled: true,
          available: true,
          availability_reason: null,
          setup_values: { mockSetting: "" },
          setup_summary: [],
          review_errors: [],
          setup_sections: [
            {
              id: "mock-setup",
              title: "Mock Setup",
              description: "Configure the mock plugin before activation.",
              fields: [
                {
                  path: "mockSetting",
                  label: "Mock setting",
                  type: "text",
                  required: true,
                  default_value: "",
                  description: "Provide the setup value.",
                  placeholder: "Enabled",
                  options: [],
                  summary_labels: {},
                },
              ],
            },
          ],
        },
      ],
    });

    renderWizard();

    expect(await screen.findByText("Mock setting")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    expect(await screen.findByText("Mock setting must be configured before continuing.")).toBeInTheDocument();
    expect(reportErrorMock).toHaveBeenCalledWith("Resolve the highlighted plugin setup issues before continuing.");
    expect(apiMock.reviewSemesterDraft).not.toHaveBeenCalled();
  });

  it("uses the plugin custom review UI when the setup definition opts into it", async () => {
    getPluginSetupDefinitionByIdMock.mockReturnValue({
      fields: {
        mockSetting: {
          type: "text",
          label: "Mock setting",
        },
      },
      sections: [
        {
          id: "mock-setup",
          title: "Mock Setup",
          fieldKeys: ["mockSetting"],
        },
      ],
      ui: {
        setupComponent: () => <div>Custom setup</div>,
        reviewComponent: ({ values }: { values: Record<string, unknown> }) => <div>Custom review value: {String(values.mockSetting ?? "")}</div>,
      },
    });
    apiMock.getProgram.mockResolvedValue({
      id: "program-1",
      name: "Engineering",
      plugin_installations: [],
    });
    apiMock.getCurrentSemesterDraft.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "review",
      draft_updated_at: "2026-03-27T10:00:00Z",
      review_ready: true,
      review_errors: [],
      plugin_activations: [
        {
          semester_id: "draft-1",
          program_plugin_installation_id: "installation-1",
          plugin_id: "mock-setup-plugin",
          display_name: "Mock Setup Plugin",
          description: "Mock setup contribution for wizard coverage.",
          author: "Jinyuan",
          version: "workspace",
          is_enabled: true,
          auth_state: "not-required",
          capabilities: {},
          setup_sections: [
            {
              id: "mock-setup",
              title: "Mock Setup",
              description: "Configure the mock plugin before activation.",
              fields: [],
            },
          ],
          setup_values: { mockSetting: "enabled" },
          setup_summary: [],
          review_errors: [],
          available: true,
          availability_reason: null,
        },
      ],
    });
    apiMock.getSemester.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "review",
      review_ready: true,
      courses: [],
      plugin_activations: [
        {
          semester_id: "draft-1",
          program_plugin_installation_id: "installation-1",
          plugin_id: "mock-setup-plugin",
          display_name: "Mock Setup Plugin",
          description: "Mock setup contribution for wizard coverage.",
          author: "Jinyuan",
          version: "workspace",
          is_enabled: true,
          auth_state: "not-required",
          capabilities: {},
          setup_sections: [
            {
              id: "mock-setup",
              title: "Mock Setup",
              description: "Configure the mock plugin before activation.",
              fields: [],
            },
          ],
          setup_values: { mockSetting: "enabled" },
          setup_summary: [],
          review_errors: [],
          available: true,
          availability_reason: null,
        },
      ],
    });

    renderWizard();

    const reviewSummarySection = (await screen.findByText("Plugin setup summary")).parentElement;
    expect(reviewSummarySection).not.toBeNull();
    const reviewTrigger = reviewSummarySection!.querySelector<HTMLButtonElement>('[data-slot="accordion-trigger"]');
    expect(reviewTrigger).not.toBeNull();
    fireEvent.click(reviewTrigger!);

    await waitFor(() => {
      expect(document.body.textContent).toContain("Custom review value: enabled");
    });
  });

  it("recovers from draft-create conflicts by resuming the existing draft and updating it", async () => {
    const existingDraft = {
      id: "draft-1",
      program_id: "program-1",
      name: "Recovered Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "basics",
      draft_updated_at: "2026-03-27T10:00:00Z",
      review_ready: false,
      review_errors: [],
      plugin_activations: [],
    };

    apiMock.getProgram.mockResolvedValue({
      id: "program-1",
      name: "Engineering",
      plugin_installations: [],
    });
    apiMock.getCurrentSemesterDraft
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingDraft);
    apiMock.createSemesterDraft.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          detail: {
            code: "SEMESTER_DRAFT_EXISTS",
            message: "A Semester draft is already in progress for this Program.",
          },
        },
      },
    });
    apiMock.updateSemesterDraft.mockImplementation(async (_draftId: string, data: Record<string, unknown>) => ({
      ...existingDraft,
      name: String(data.name ?? existingDraft.name),
      creation_step: String(data.creation_step ?? "courses"),
    }));

    renderWizard();

    const nameInput = await screen.findByRole("textbox");
    fireEvent.change(nameInput, { target: { value: "Winter 2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Courses" }));

    await waitFor(() => {
      expect(apiMock.createSemesterDraft).toHaveBeenCalledTimes(1);
      expect(apiMock.updateSemesterDraft).toHaveBeenCalledWith("draft-1", {
        name: "Winter 2026",
        start_date: expect.any(String),
        end_date: expect.any(String),
        reading_week_start: null,
        reading_week_end: null,
        creation_step: "courses",
      });
    });
    expect(reportErrorMock).not.toHaveBeenCalled();
  });

  it("normalizes an invalid persisted plugin setup step to review when no enabled plugin still requires setup", async () => {
    apiMock.getProgram.mockResolvedValue({
      id: "program-1",
      name: "Engineering",
      plugin_installations: [],
    });
    apiMock.getCurrentSemesterDraft.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "plugin-setup",
      draft_updated_at: "2026-03-27T10:00:00Z",
      review_ready: false,
      review_errors: [],
      plugin_activations: [],
    });
    apiMock.getSemester.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "plugin-setup",
      review_ready: false,
      courses: [],
      plugin_activations: [],
    });
    apiMock.updateSemesterDraft.mockImplementation(async (_draftId: string, data: Record<string, unknown>) => ({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: String(data.creation_step ?? "review"),
      draft_updated_at: "2026-03-27T10:00:00Z",
      review_ready: false,
      review_errors: [],
      plugin_activations: [],
    }));

    renderWizard();

    expect(await screen.findByRole("button", { name: "Create Semester" })).toBeInTheDocument();
    await waitFor(() => {
      expect(apiMock.updateSemesterDraft).toHaveBeenCalledWith("draft-1", { creation_step: "review" });
    });
    expect(screen.queryByText("No enabled plugins require setup.")).not.toBeInTheDocument();
  });

  it("skips plugin setup immediately after disabling the last enabled plugin that contributes setup", async () => {
    const setupSection = [
      {
        id: "mock-setup",
        title: "Mock Setup",
        description: "Configure the mock plugin before activation.",
        fields: [],
      },
    ];
    let draftResponse = {
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "plugins",
      draft_updated_at: "2026-03-27T10:00:00Z",
      review_ready: false,
      review_errors: [],
      plugin_activations: [
        {
          semester_id: "draft-1",
          program_plugin_installation_id: "installation-1",
          plugin_id: "mock-setup-plugin",
          display_name: "Mock Setup Plugin",
          description: "Mock setup contribution for wizard coverage.",
          author: "Jinyuan",
          version: "workspace",
          is_enabled: true,
          auth_state: "not-required",
          capabilities: {},
          setup_sections: setupSection,
          setup_values: {},
          setup_summary: [],
          review_errors: [],
          available: true,
          availability_reason: null,
        },
      ],
    };
    let semesterResponse = {
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "plugins",
      review_ready: false,
      courses: [],
      plugin_activations: draftResponse.plugin_activations,
    };
    let pluginSetupResponse = {
      semester_id: "draft-1",
      step: "plugin-setup",
      plugins: [
        {
          plugin_id: "mock-setup-plugin",
          display_name: "Mock Setup Plugin",
          description: "Mock setup contribution for wizard coverage.",
          author: "Jinyuan",
          is_enabled: true,
          available: true,
          availability_reason: null,
          setup_values: { mockSetting: "enabled" },
          setup_summary: [],
          review_errors: [],
          setup_sections: [
            {
              id: "mock-setup",
              title: "Mock Setup",
              description: "Configure the mock plugin before activation.",
              fields: [
                {
                  path: "mockSetting",
                  label: "Mock setting",
                  type: "select",
                  required: true,
                  default_value: "enabled",
                  description: "Configure the mock plugin before activation.",
                  placeholder: "",
                  options: [
                    { label: "Enabled", value: "enabled" },
                    { label: "Disabled", value: "disabled" },
                  ],
                  summary_labels: {
                    enabled: "Enabled",
                    disabled: "Disabled",
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    apiMock.getProgram.mockResolvedValue({
      id: "program-1",
      name: "Engineering",
      plugin_installations: [
        {
          id: "installation-1",
          plugin_id: "mock-setup-plugin",
          display_name: "Mock Setup Plugin",
          description: "Mock setup contribution for wizard coverage.",
          author: "Jinyuan",
          default_version: "workspace",
          locked: false,
          version: "workspace",
          is_enabled: true,
          auth_state: "not-required",
          auth_message: null,
          capabilities: { contexts: ["semester"], available_tab_types: ["mock-setup-plugin"] },
          setup_sections: setupSection,
          available: true,
          availability_reason: null,
          installed: true,
        },
      ],
    });
    apiMock.getCurrentSemesterDraft.mockImplementation(async () => draftResponse);
    apiMock.getSemester.mockImplementation(async () => semesterResponse);
    apiMock.getSemesterPluginSystemSetup.mockImplementation(async () => pluginSetupResponse);
    apiMock.bulkUpdateSemesterPluginActivations.mockImplementation(async (_draftId: string, data: { plugin_ids: string[]; is_enabled: boolean }) => {
      draftResponse = {
        ...draftResponse,
        plugin_activations: draftResponse.plugin_activations.map((activation) => ({
          ...activation,
          is_enabled: data.plugin_ids.includes(String(activation.plugin_id)) ? data.is_enabled : activation.is_enabled,
        })),
        creation_step: "plugins",
      };
      semesterResponse = {
        ...semesterResponse,
        plugin_activations: draftResponse.plugin_activations,
        creation_step: "plugins",
      };
      pluginSetupResponse = {
        ...pluginSetupResponse,
        plugins: pluginSetupResponse.plugins.map((plugin) => ({
          ...plugin,
          is_enabled: data.plugin_ids.includes(String(plugin.plugin_id)) ? data.is_enabled : plugin.is_enabled,
        })),
      };
      return draftResponse;
    });

    renderWizard();

    expect(await screen.findByRole("button", { name: "Mock Setup Plugin" })).toBeInTheDocument();

    fireEvent.click((await screen.findAllByRole("switch"))[0]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Review" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Mock Setup Plugin" })).not.toBeInTheDocument();
  });

  it("shows a plugin setup step when the plugin-system payload has setup sections even if the activation payload is stale", async () => {
    apiMock.getProgram.mockResolvedValue({
      id: "program-1",
      name: "Engineering",
      plugin_installations: [
        {
          id: "installation-1",
          plugin_id: "mock-setup-plugin",
          display_name: "Mock Setup Plugin",
          description: "Mock setup contribution for wizard coverage.",
          author: "Jinyuan",
          default_version: "workspace",
          locked: false,
          version: "workspace",
          is_enabled: true,
          auth_state: "not-required",
          auth_message: null,
          capabilities: { contexts: ["semester"], available_tab_types: ["mock-setup-plugin"] },
          setup_sections: [],
          available: true,
          availability_reason: null,
          installed: true,
        },
      ],
    });
    apiMock.getCurrentSemesterDraft.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "plugins",
      draft_updated_at: "2026-03-27T10:00:00Z",
      review_ready: false,
      review_errors: [],
      plugin_activations: [
        {
          semester_id: "draft-1",
          program_plugin_installation_id: "installation-1",
          plugin_id: "mock-setup-plugin",
          display_name: "Mock Setup Plugin",
          description: "Mock setup contribution for wizard coverage.",
          author: "Jinyuan",
          version: "workspace",
          is_enabled: true,
          auth_state: "not-required",
          capabilities: {},
          setup_sections: [],
          setup_values: {},
          setup_summary: [],
          review_errors: [],
          available: true,
          availability_reason: null,
        },
      ],
    });
    apiMock.getSemester.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "plugins",
      review_ready: false,
      courses: [],
      plugin_activations: [
        {
          semester_id: "draft-1",
          program_plugin_installation_id: "installation-1",
          plugin_id: "mock-setup-plugin",
          display_name: "Mock Setup Plugin",
          description: "Mock setup contribution for wizard coverage.",
          author: "Jinyuan",
          version: "workspace",
          is_enabled: true,
          auth_state: "not-required",
          capabilities: {},
          setup_sections: [],
          setup_values: {},
          setup_summary: [],
          review_errors: [],
          available: true,
          availability_reason: null,
        },
      ],
    });
    apiMock.getSemesterPluginSystemSetup.mockResolvedValue({
      semester_id: "draft-1",
      step: "plugin-setup",
      plugins: [
        {
          plugin_id: "mock-setup-plugin",
          display_name: "Mock Setup Plugin",
          description: "Mock setup contribution for wizard coverage.",
          author: "Jinyuan",
          is_enabled: true,
          available: true,
          availability_reason: null,
          setup_values: {},
          setup_summary: [],
          review_errors: [],
          setup_sections: [
            {
              id: "mock-setup",
              title: "Mock Setup",
              description: "Configure the mock plugin before activation.",
              fields: [
                {
                  path: "mockSetting",
                  label: "Mock setting",
                  type: "text",
                  required: false,
                  default_value: "",
                  description: "",
                  placeholder: "",
                  options: [],
                  summary_labels: {},
                },
              ],
            },
          ],
        },
      ],
    });

    renderWizard();

    expect(await screen.findByRole("button", { name: "Mock Setup Plugin" })).toBeInTheDocument();
  });

  it("finalizes the draft without refetching draft-only plugin setup endpoints after activation", async () => {
    let pluginSetupCallCount = 0;
    let currentDraftResponse: Record<string, unknown> | null = {
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "review",
      draft_updated_at: "2026-03-27T10:00:00Z",
      review_ready: true,
      review_errors: [],
      plugin_activations: [],
    };
    apiMock.getProgram.mockResolvedValue({
      id: "program-1",
      name: "Engineering",
      plugin_installations: [],
    });
    apiMock.getCurrentSemesterDraft.mockImplementation(async () => currentDraftResponse);
    apiMock.getSemester.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "review",
      review_ready: true,
      courses: [],
      plugin_activations: [],
    });
    apiMock.getSemesterPluginSystemSetup.mockImplementation(async () => {
      pluginSetupCallCount += 1;
      if (pluginSetupCallCount > 1) {
        throw new Error("draft-only plugin setup endpoint was refetched after finalize");
      }
      return {
        semester_id: "draft-1",
        step: "review",
        plugins: [],
      };
    });
    apiMock.reviewSemesterPluginSystem.mockResolvedValue({
      semester_id: "draft-1",
      plugins: [],
      has_errors: false,
    });
    apiMock.reviewSemesterDraft.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "review",
      draft_updated_at: "2026-03-27T10:00:00Z",
      review_ready: true,
      review_errors: [],
      plugin_activations: [],
    });
    apiMock.finalizeSemesterDraft.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "active",
      creation_step: "review",
      draft_updated_at: "2026-03-27T10:00:00Z",
      review_ready: true,
      review_errors: [],
      plugin_activations: [],
    });
    apiMock.finalizeSemesterDraft.mockImplementation(async () => {
      currentDraftResponse = null;
      return {
        id: "draft-1",
        program_id: "program-1",
        name: "Winter 2026",
        start_date: "2026-01-05",
        end_date: "2026-04-10",
        reading_week_start: null,
        reading_week_end: null,
        lifecycle_state: "active",
        creation_step: "review",
        draft_updated_at: "2026-03-27T10:00:00Z",
        review_ready: true,
        review_errors: [],
        plugin_activations: [],
      };
    });

    renderWizard();

    await screen.findByRole("button", { name: "Create Semester" });
    const setupCallCountBeforeFinalize = pluginSetupCallCount;

    fireEvent.click(screen.getByRole("button", { name: "Create Semester" }));

    expect(await screen.findByText("Semester homepage")).toBeInTheDocument();
    expect(reportErrorMock).not.toHaveBeenCalled();
    expect(pluginSetupCallCount).toBe(setupCallCountBeforeFinalize);
  });

  it("asks for confirmation before leaving the wizard from the back button", async () => {
    apiMock.getProgram.mockResolvedValue({
      id: "program-1",
      name: "Engineering",
      plugin_installations: [],
    });
    apiMock.getCurrentSemesterDraft.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "basics",
      draft_updated_at: "2026-03-27T10:00:00Z",
      review_ready: false,
      review_errors: [],
      plugin_activations: [],
    });
    apiMock.getSemester.mockResolvedValue({
      id: "draft-1",
      program_id: "program-1",
      name: "Winter 2026",
      start_date: "2026-01-05",
      end_date: "2026-04-10",
      reading_week_start: null,
      reading_week_end: null,
      lifecycle_state: "draft",
      creation_step: "basics",
      review_ready: false,
      courses: [],
      plugin_activations: [],
    });

    renderWizard();

    const exitButton = await screen.findByRole("button", { name: "Program" });
    expect(exitButton).toHaveAttribute("data-variant", "destructive");
    fireEvent.click(exitButton);

    expect(await screen.findByText("Leave Semester setup?")).toBeInTheDocument();
    expect(screen.getByText("Choose whether to keep this draft for later or discard it before returning to the Program dashboard.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Keep" }));

    expect(await screen.findByText("Program dashboard")).toBeInTheDocument();
  });
});
