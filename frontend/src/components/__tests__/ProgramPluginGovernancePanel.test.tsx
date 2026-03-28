// input:  [`ProgramPluginGovernancePanel`, mocked governance APIs, QueryClient wrapper, viewport-state hooks, and testing-library interactions]
// output: [component regression tests covering Program-level plugin install, reusable plugin info dialogs, marketplace detail navigation, enablement toggles, and downstream cache invalidation]
// pos:    [UI regression suite for the shared data table and responsive marketplace used by Program plugin management]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClientWrapper } from "@/test/queryClientWrapper";
import { ProgramPluginGovernancePanel } from "../ProgramPluginGovernancePanel";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getProgramPluginCatalog: vi.fn(),
    upsertProgramPluginInstallation: vi.fn(),
    deleteProgramPluginInstallation: vi.fn(),
  },
}));

vi.mock("@/services/api", () => ({
  default: apiMock,
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => true,
}));

describe("ProgramPluginGovernancePanel", () => {
  beforeEach(() => {
    apiMock.getProgramPluginCatalog.mockReset();
    apiMock.upsertProgramPluginInstallation.mockReset();
    apiMock.deleteProgramPluginInstallation.mockReset();
  });

  it("installs a plugin from the marketplace as enabled", async () => {
    apiMock.getProgramPluginCatalog.mockResolvedValue([
      {
        id: null,
        plugin_id: "world-clock",
        display_name: "World Clock",
        description: "Dashboard widget showing selected time zones.",
        author: "Jinyuan",
        default_version: "workspace",
        default_installed: false,
        default_enabled: false,
        locked: false,
        version: "workspace",
        is_enabled: false,
        requires_program_lms_integration: false,
        capabilities: { contexts: ["semester"] },
        setup_sections: [],
        program_settings: {},
        resolved_program_settings: {},
        fields: [],
        available: true,
        availability_reason: null,
        installed: false,
      },
      {
        id: "installation-2",
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
        requires_program_lms_integration: false,
        capabilities: { contexts: ["semester"] },
        setup_sections: [],
        program_settings: {},
        resolved_program_settings: {},
        fields: [],
        available: true,
        availability_reason: null,
        installed: true,
      },
    ]);
    apiMock.upsertProgramPluginInstallation.mockResolvedValue({});

    const { Wrapper } = createQueryClientWrapper();
    render(<ProgramPluginGovernancePanel programId="program-1" />, { wrapper: Wrapper });

    fireEvent.click(await screen.findByRole("button", { name: "Install plugin" }));
    expect(document.querySelector('[data-slot="drawer-content"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "Installed" })).toBeDisabled();
    fireEvent.click(await screen.findByRole("button", { name: "Install" }));

    await waitFor(() => {
      expect(apiMock.upsertProgramPluginInstallation).toHaveBeenCalledWith("program-1", "world-clock", {
        is_enabled: true,
      });
    });
  });

  it("opens marketplace detail pages and installs from the reused plugin details view", async () => {
    apiMock.getProgramPluginCatalog.mockResolvedValue([
      {
        id: null,
        plugin_id: "world-clock",
        display_name: "World Clock",
        description: "Dashboard widget showing selected time zones.",
        author: "Jinyuan",
        default_version: "workspace",
        default_installed: false,
        default_enabled: false,
        locked: false,
        version: "workspace",
        is_enabled: false,
        requires_program_lms_integration: false,
        capabilities: { contexts: ["semester"], available_widget_types: ["world-clock"] },
        setup_sections: [],
        program_settings: {},
        resolved_program_settings: {},
        fields: [],
        available: true,
        availability_reason: null,
        installed: false,
      },
    ]);
    apiMock.upsertProgramPluginInstallation.mockResolvedValue({});

    const { Wrapper } = createQueryClientWrapper();
    render(<ProgramPluginGovernancePanel programId="program-1" />, { wrapper: Wrapper });

    fireEvent.click(await screen.findByRole("button", { name: "Install plugin" }));
    fireEvent.click(screen.getByRole("button", { name: "Open details for World Clock" }));

    expect(await screen.findByRole("button", { name: "Back" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    await waitFor(() => {
      expect(apiMock.upsertProgramPluginInstallation).toHaveBeenCalledWith("program-1", "world-clock", {
        is_enabled: true,
      });
    });
  });

  it("toggles an installed plugin off without deleting it", async () => {
    apiMock.getProgramPluginCatalog.mockResolvedValue([
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
        requires_program_lms_integration: false,
        capabilities: { contexts: ["semester"] },
        setup_sections: [],
        program_settings: {},
        resolved_program_settings: {},
        fields: [],
        available: true,
        availability_reason: null,
        installed: true,
      },
    ]);
    apiMock.upsertProgramPluginInstallation.mockResolvedValue({});

    const { Wrapper } = createQueryClientWrapper();
    render(<ProgramPluginGovernancePanel programId="program-1" />, { wrapper: Wrapper });

    const switches = await screen.findAllByRole("switch");
    fireEvent.click(switches[0]);

    await waitFor(() => {
      expect(apiMock.upsertProgramPluginInstallation).toHaveBeenCalledWith("program-1", "course-list", {
        is_enabled: false,
      });
    });
    expect(apiMock.deleteProgramPluginInstallation).not.toHaveBeenCalled();
  });

  it("invalidates downstream semester and course caches after Program plugin changes", async () => {
    apiMock.getProgramPluginCatalog.mockResolvedValue([
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
        requires_program_lms_integration: false,
        capabilities: { contexts: ["semester"], available_widget_types: ["course-list"] },
        setup_sections: [],
        program_settings: {},
        resolved_program_settings: {},
        fields: [],
        available: true,
        availability_reason: null,
        installed: true,
      },
    ]);
    apiMock.upsertProgramPluginInstallation.mockResolvedValue({});

    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    render(<ProgramPluginGovernancePanel programId="program-1" />, { wrapper: Wrapper });

    const switches = await screen.findAllByRole("switch");
    fireEvent.click(switches[0]);

    await waitFor(() => {
      expect(apiMock.upsertProgramPluginInstallation).toHaveBeenCalledWith("program-1", "course-list", {
        is_enabled: false,
      });
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["semesters"] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["courses"] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["plugin-system", "semesters"] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["programs", "program-1", "semester-draft"] });
  });

  it("opens a reusable plugin info dialog from the row action menu", async () => {
    apiMock.getProgramPluginCatalog.mockResolvedValue([
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
        requires_program_lms_integration: false,
        capabilities: { contexts: ["semester"], available_widget_types: ["course-list"] },
        setup_sections: [],
        program_settings: {},
        resolved_program_settings: {},
        fields: [],
        available: true,
        availability_reason: null,
        installed: true,
      },
    ]);

    const { Wrapper } = createQueryClientWrapper();
    render(<ProgramPluginGovernancePanel programId="program-1" />, { wrapper: Wrapper });

    fireEvent.pointerDown(await screen.findByRole("button", { name: "Open actions for Course List" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Plugin Info" }));

    expect((await screen.findAllByText("Semester course list widget and course-management defaults.")).length).toBeGreaterThan(0);
  });
});
