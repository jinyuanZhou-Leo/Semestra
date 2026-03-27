// input:  [`CreateSemesterWizardPage`, mocked Semester wizard APIs, React Router memory routes, and QueryClient test wrappers]
// output: [page-level regression tests for Semester basics validation, Program-installed plugin filtering, and draft review blockers inside the Semester creation wizard]
// pos:    [Route test suite guarding the standalone Create Semester wizard host flow against invalid basics input, availability leaks, and invalid finalize states]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
    finalizeSemesterDraft: vi.fn(),
    discardSemesterDraft: vi.fn(),
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
      </Routes>
    </MemoryRouter>,
    { wrapper: Wrapper },
  );
};

describe("CreateSemesterWizardPage", () => {
  beforeEach(() => {
    Object.values(apiMock).forEach((mock) => mock.mockReset());
    reportErrorMock.mockReset();
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

    const pluginSwitches = await screen.findAllByRole("switch");
    expect(pluginSwitches).toHaveLength(2);
    expect(pluginSwitches[0]).not.toBeDisabled();
    expect(pluginSwitches[1]).toBeDisabled();
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

    expect(await screen.findByText("Resolve blockers before finalizing.")).toBeInTheDocument();
    expect(await screen.findByText("Reading week must stay inside the Semester date range.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finalize Semester" })).toBeDisabled();
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
