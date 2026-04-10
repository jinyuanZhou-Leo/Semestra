// input:  [`PluginSettingsSectionRenderer`, `SettingsSection`, and testing-library rendering]
// output: [component regression tests covering injected scope props and plugin ownership labels inside settings sections]
// pos:    [UI regression suite for the plugin settings bridge used by Semester and Course settings pages]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SettingsSection } from "@/components/SettingsSection";
import { createQueryClientWrapper } from "@/test/queryClientWrapper";
import { PluginSettingsSectionRenderer } from "./PluginSettingsSectionRenderer";

vi.mock("@/services/api", () => ({
  default: {
    getProgramTabSettings: vi.fn().mockResolvedValue([]),
    getSemesterTabSettings: vi.fn().mockResolvedValue([]),
    getCourseTabSettings: vi.fn().mockResolvedValue([]),
  },
}));

describe("PluginSettingsSectionRenderer", () => {
  it("injects the stable scope contract and plugin ownership label into settings sections", () => {
    const { Wrapper } = createQueryClientWrapper();

    render(
      <PluginSettingsSectionRenderer
        pluginId="course-list"
        pluginDisplayName="Course List"
        component={({ pluginId, scope }) => (
          <SettingsSection title="Display">
            <div>
              Probe: {pluginId} / {scope.kind} / {scope.kind === 'semester' ? scope.semesterId : 'none'}
            </div>
          </SettingsSection>
        )}
        semesterId="semester-1"
        onRefresh={() => {}}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText("Display")).toBeInTheDocument();
    expect(screen.getByText("Plugin: Course List")).toBeInTheDocument();
    expect(screen.getByText("Probe: course-list / semester / semester-1")).toBeInTheDocument();
  });
});
