// input:  [`SemesterPluginGovernancePanel`, mocked governance APIs, QueryClient wrapper, and testing-library interactions]
// output: [component regression tests covering Semester-level protected delete rules, reusable plugin info dialogs, Program-enabled off rows, and non-destructive enablement toggles]
// pos:    [UI regression suite for the shared data table used by Semester plugin management, including Program-enabled plugins that are still off at the Semester layer]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClientWrapper } from "@/test/queryClientWrapper";
import { SemesterPluginGovernancePanel } from "../SemesterPluginGovernancePanel";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getProgramPluginCatalog: vi.fn(),
    upsertSemesterPluginActivation: vi.fn(),
    deleteSemesterPluginActivation: vi.fn(),
  },
}));

vi.mock("@/services/api", () => ({
  default: apiMock,
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => true,
}));

describe("SemesterPluginGovernancePanel", () => {
  beforeEach(() => {
    apiMock.getProgramPluginCatalog.mockReset();
    apiMock.upsertSemesterPluginActivation.mockReset();
    apiMock.deleteSemesterPluginActivation.mockReset();
  });

  it("does not expose marketplace actions for Semester plugins", async () => {
    const { Wrapper } = createQueryClientWrapper();
    render(
      <SemesterPluginGovernancePanel
        semesterId="semester-1"
        pluginActivations={[]}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.queryByRole("button", { name: "Add plugin" })).not.toBeInTheDocument();
    expect(apiMock.getProgramPluginCatalog).not.toHaveBeenCalled();
  });

  it("toggles an existing Semester plugin off without deleting it", async () => {
    apiMock.getProgramPluginCatalog.mockResolvedValue([]);
    apiMock.upsertSemesterPluginActivation.mockResolvedValue({});

    const { Wrapper } = createQueryClientWrapper();
    render(
      <SemesterPluginGovernancePanel
        semesterId="semester-1"
        pluginActivations={[
          {
            id: "activation-1",
            semester_id: "semester-1",
            program_plugin_installation_id: "installation-2",
            plugin_id: "builtin-event-core",
            display_name: "Academic Events",
            description: "Calendar, course schedule, todo, and daily event surfaces.",
            author: "Jinyuan",
            locked: false,
            version: "workspace",
            is_enabled: true,
            capabilities: {},
            setup_sections: [],
            semester_overrides: { calendarDefaultView: "week" },
            setup_state: { calendarDefaultView: "week" },
            resolved_settings: { calendarDefaultView: "week" },
            fields: [],
            setup_summary: [],
            review_errors: [],
            available: true,
            availability_reason: null,
          },
        ]}
      />,
      { wrapper: Wrapper },
    );

    const switches = await screen.findAllByRole("switch");
    fireEvent.click(switches[0]);

    await waitFor(() => {
      expect(apiMock.upsertSemesterPluginActivation).toHaveBeenCalledWith("semester-1", "builtin-event-core", {
        is_enabled: false,
      });
    });
    expect(apiMock.deleteSemesterPluginActivation).not.toHaveBeenCalled();
  });

  it("prevents deleting protected built-in Semester plugins", async () => {
    const { Wrapper } = createQueryClientWrapper();
    render(
      <SemesterPluginGovernancePanel
        semesterId="semester-1"
        pluginActivations={[
          {
            id: "activation-2",
            semester_id: "semester-1",
            program_plugin_installation_id: "installation-3",
            plugin_id: "builtin-setting",
            display_name: "Settings",
            description: "Built-in settings tab.",
            author: "Jinyuan",
            locked: true,
            version: "workspace",
            is_enabled: true,
            capabilities: {},
            setup_sections: [],
            semester_overrides: {},
            setup_state: {},
            resolved_settings: {},
            fields: [],
            setup_summary: [],
            review_errors: [],
            available: true,
            availability_reason: null,
          },
        ]}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.queryByRole("button", { name: "Delete Settings" })).not.toBeInTheDocument();
  });

  it("shows Program-enabled plugins without Semester activations as off and non-deletable", async () => {
    const { Wrapper } = createQueryClientWrapper();
    render(
      <SemesterPluginGovernancePanel
        semesterId="semester-1"
        pluginActivations={[
          {
            id: null,
            semester_id: "semester-1",
            program_plugin_installation_id: "installation-9",
            plugin_id: "course-resources",
            display_name: "Course Resources",
            description: "Manage files and links for each course.",
            author: "Jinyuan",
            locked: false,
            version: "workspace",
            is_enabled: false,
            capabilities: {},
            setup_sections: [],
            semester_overrides: {},
            setup_state: {},
            resolved_settings: {},
            fields: [],
            setup_summary: [],
            review_errors: [],
            available: false,
            availability_reason: "Disabled for this Semester.",
          },
        ]}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText("Course Resources")).toBeInTheDocument();
    expect(screen.getByText("Off")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Course Resources" })).not.toBeInTheDocument();
  });

  it("opens plugin info even when Semester deletion is unavailable", async () => {
    const { Wrapper } = createQueryClientWrapper();
    render(
      <SemesterPluginGovernancePanel
        semesterId="semester-1"
        pluginActivations={[
          {
            id: null,
            semester_id: "semester-1",
            program_plugin_installation_id: "installation-9",
            plugin_id: "course-resources",
            display_name: "Course Resources",
            description: "Manage files and links for each course.",
            author: "Jinyuan",
            locked: false,
            version: "workspace",
            is_enabled: false,
            capabilities: { contexts: ["course"], available_tab_types: ["course-resources"] },
            setup_sections: [],
            semester_overrides: {},
            setup_state: {},
            resolved_settings: {},
            fields: [],
            setup_summary: [],
            review_errors: [],
            available: false,
            availability_reason: "Disabled for this Semester.",
          },
        ]}
      />,
      { wrapper: Wrapper },
    );

    fireEvent.pointerDown(await screen.findByRole("button", { name: "Open actions for Course Resources" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Plugin Info" }));

    expect((await screen.findAllByText("Manage files and links for each course.")).length).toBeGreaterThan(0);
  });
});
