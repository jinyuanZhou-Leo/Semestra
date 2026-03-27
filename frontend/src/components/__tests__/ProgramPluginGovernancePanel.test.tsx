// input:  [`ProgramPluginGovernancePanel`, mocked governance APIs, QueryClient wrapper, and testing-library interactions]
// output: [component regression tests covering Program-level plugin install and enablement toggles]
// pos:    [UI regression suite for the shared CRUD panel used by Program plugin management]
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
    ]);
    apiMock.upsertProgramPluginInstallation.mockResolvedValue({});

    const { Wrapper } = createQueryClientWrapper();
    render(<ProgramPluginGovernancePanel programId="program-1" />, { wrapper: Wrapper });

    fireEvent.click(await screen.findByRole("button", { name: "Install plugin" }));
    fireEvent.click(await screen.findByRole("button", { name: "Install" }));

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
});
