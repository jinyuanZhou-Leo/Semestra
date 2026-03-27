// input:  [`PluginSettingsSectionRenderer`, mocked shared-settings hook state, and testing-library rendering]
// output: [component regression tests covering plugin identity headers and injected shared-settings props]
// pos:    [UI regression suite for the shared plugin settings bridge used by Semester and Course settings pages]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PluginSettingsSectionRenderer } from "./PluginSettingsSectionRenderer";

const { usePluginSharedSettingsMock } = vi.hoisted(() => ({
  usePluginSharedSettingsMock: vi.fn(),
}));

vi.mock("@/hooks/usePluginSharedSettings", () => ({
  usePluginSharedSettings: usePluginSharedSettingsMock,
}));

describe("PluginSettingsSectionRenderer", () => {
  it("renders the plugin header and injects framework-managed settings props", () => {
    usePluginSharedSettingsMock.mockReturnValue({
      settings: { probe: "ready" },
      updateSettings: vi.fn(),
      saveState: "idle",
      hasPendingChanges: false,
      isLoading: false,
    });

    render(
      <PluginSettingsSectionRenderer
        pluginId="course-list"
        pluginIcon={<span data-testid="plugin-icon">icon</span>}
        pluginDisplayName="Course List"
        pluginDescription="Manage semester course data."
        component={({ settings }) => <div>Probe: {(settings as { probe: string }).probe}</div>}
        semesterId="semester-1"
        onRefresh={() => {}}
      />
    );

    expect(screen.getByText("Course List")).toBeInTheDocument();
    expect(screen.getByText("Manage semester course data.")).toBeInTheDocument();
    expect(screen.getByTestId("plugin-icon")).toBeInTheDocument();
    expect(screen.getByText("Probe: ready")).toBeInTheDocument();
  });
});
