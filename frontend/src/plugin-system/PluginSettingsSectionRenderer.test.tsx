// input:  [`PluginSettingsSectionRenderer` and testing-library rendering]
// output: [component regression tests covering plugin identity headers and injected scope props]
// pos:    [UI regression suite for the plugin settings bridge used by Semester and Course settings pages]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PluginSettingsSectionRenderer } from "./PluginSettingsSectionRenderer";

describe("PluginSettingsSectionRenderer", () => {
  it("renders the plugin header and injects the stable scope contract", () => {
    render(
      <PluginSettingsSectionRenderer
        pluginId="course-list"
        pluginIcon={<span data-testid="plugin-icon">icon</span>}
        pluginDisplayName="Course List"
        pluginDescription="Manage semester course data."
        component={({ pluginId, scope }) => (
          <div>
            Probe: {pluginId} / {scope.kind} / {scope.kind === 'semester' ? scope.semesterId : 'none'}
          </div>
        )}
        semesterId="semester-1"
        onRefresh={() => {}}
      />
    );

    expect(screen.getByText("Course List")).toBeInTheDocument();
    expect(screen.getByText("Manage semester course data.")).toBeInTheDocument();
    expect(screen.getByTestId("plugin-icon")).toBeInTheDocument();
    expect(screen.getByText("Probe: course-list / semester / semester-1")).toBeInTheDocument();
  });
});
