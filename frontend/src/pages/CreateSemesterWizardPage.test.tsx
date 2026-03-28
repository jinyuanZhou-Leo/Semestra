// input:  [`CreateSemesterWizardPage`, mocked Semester wizard APIs, React Router memory routes, and QueryClient test wrappers]
// output: [page-level regression tests for Semester basics validation, setup-aware wizard navigation, draft-conflict-safe resume behavior, finalize handoff safety, Program-installed plugin filtering, Eventcore-excluded plugin-system setup rendering, draft review blockers, invalid step guards, and stale-refetch no-clobber behavior inside the Semester creation wizard]
// pos:    [Route test suite guarding the standalone Create Semester wizard host flow against invalid basics input, draft-create conflict regressions, setup-step drift, stale refetch overwrites, finalize teardown regressions, availability leaks, missing plugin-system setup wiring, Eventcore setup re-entry, and invalid finalize states]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClientWrapper } from "@/test/queryClientWrapper";

import { CreateSemesterWizardPage } from "./CreateSemesterWizardPage";

const { apiMock, reportErrorMock } = vi.hoisted(() => ({
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
    deleteSemesterPluginActivation: vi.fn(),
    createCourse: vi.fn(),
    deleteCourse: vi.fn(),
  },
  reportErrorMock: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  default: apiMock,
}));

vi.mock("../services/appStatus", () => ({
  reportError: reportErrorMock,
}));

vi.mock("@/plugin-system", () => ({
  getPluginIconById: () => null,
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
          default_installed: true,
          default_enabled: true,
          locked: false,
          version: "workspace",
          is_enabled: true,
          auth_state: "not-required",
          auth_message: null,
          requires_authorization: false,
          requires_program_lms_integration: false,
          capabilities: { contexts: ["semester"], available_widget_types: ["course-list"] },
          setup_sections: [],
          program_settings: {},
          resolved_program_settings: { allowCourseCreation: true, badgeStyle: "compact" },
          fields: [],
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
          default_installed: false,
          default_enabled: false,
          locked: false,
          version: "workspace",
          is_enabled: true,
          auth_state: "not-required",
          auth_message: null,
          requires_authorization: false,
          requires_program_lms_integration: true,
          capabilities: { contexts: ["course"], available_tab_types: ["builtin-canvas-integration"] },
          setup_sections: [],
          program_settings: {},
          resolved_program_settings: {},
          fields: [],
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
    expect(screen.getByRole("button", { name: "Continue to Courses" })).toBeDisabled();
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
    expect(screen.getByRole("button", { name: "Continue to Courses" })).toBeInTheDocument();
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
          semester_overrides: {},
          setup_state: {},
          resolved_settings: {},
          fields: [],
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
          semester_overrides: {},
          setup_state: {},
          resolved_settings: {},
          fields: [],
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
                  persist: "both",
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
    fireEvent.click(screen.getByRole("button", { name: "Continue to Courses" }));

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
          semester_overrides: {},
          setup_state: {},
          resolved_settings: {},
          fields: [],
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
                  persist: "both",
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
          default_installed: false,
          default_enabled: false,
          locked: false,
          version: "workspace",
          is_enabled: true,
          auth_state: "not-required",
          auth_message: null,
          requires_authorization: false,
          requires_program_lms_integration: false,
          capabilities: { contexts: ["semester"], available_tab_types: ["mock-setup-plugin"] },
          setup_sections: setupSection,
          program_settings: {},
          resolved_program_settings: {},
          fields: [],
          available: true,
          availability_reason: null,
          installed: true,
        },
      ],
    });
    apiMock.getCurrentSemesterDraft.mockImplementation(async () => draftResponse);
    apiMock.getSemester.mockImplementation(async () => semesterResponse);
    apiMock.getSemesterPluginSystemSetup.mockImplementation(async () => pluginSetupResponse);
    apiMock.upsertSemesterPluginActivation.mockImplementation(async (_draftId: string, _pluginId: string, data: { is_enabled: boolean }) => {
      draftResponse = {
        ...draftResponse,
        plugin_activations: draftResponse.plugin_activations.map((activation) => ({
          ...activation,
          is_enabled: data.is_enabled,
        })),
      };
      semesterResponse = {
        ...semesterResponse,
        plugin_activations: draftResponse.plugin_activations,
      };
      pluginSetupResponse = {
        ...pluginSetupResponse,
        plugins: pluginSetupResponse.plugins.map((plugin) => ({
          ...plugin,
          is_enabled: data.is_enabled,
        })),
      };
      return draftResponse.plugin_activations[0];
    });
    apiMock.updateSemesterDraft.mockImplementation(async (_draftId: string, data: Record<string, unknown>) => {
      draftResponse = {
        ...draftResponse,
        creation_step: String(data.creation_step ?? draftResponse.creation_step),
      };
      semesterResponse = {
        ...semesterResponse,
        creation_step: draftResponse.creation_step,
      };
      return draftResponse;
    });

    renderWizard();

    expect(await screen.findByRole("button", { name: "Continue to Plugin Setup" })).toBeInTheDocument();

    fireEvent.click((await screen.findAllByRole("switch"))[0]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Continue to Review" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Continue to Plugin Setup" })).not.toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole("button", { name: "Back to Program" }));

    expect(await screen.findByText("Leave Semester setup?")).toBeInTheDocument();
    expect(screen.getByText("Choose whether to keep this draft for later or discard it before returning to the Program dashboard.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Keep" }));

    expect(await screen.findByText("Program dashboard")).toBeInTheDocument();
  });
});
