// input:  [`CoursePluginGovernancePanel`, mocked course-governance APIs, QueryClient wrapper, and testing-library interactions]
// output: [component regression tests covering unassigned-Course plugin toggles, bulk toggles, and plugin info dialogs]
// pos:    [UI regression suite for the shared data table used by unassigned-Course plugin management]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClientWrapper } from "@/test/queryClientWrapper";
import { CoursePluginGovernancePanel } from "../CoursePluginGovernancePanel";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    upsertCoursePluginActivation: vi.fn(),
    bulkUpdateCoursePluginActivations: vi.fn(),
  },
}));

vi.mock("@/services/api", () => ({
  default: apiMock,
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => true,
}));

describe("CoursePluginGovernancePanel", () => {
  beforeEach(() => {
    apiMock.upsertCoursePluginActivation.mockReset();
    apiMock.bulkUpdateCoursePluginActivations.mockReset();
  });

  it("toggles an unassigned Course plugin on", async () => {
    apiMock.upsertCoursePluginActivation.mockResolvedValue({});

    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    render(
      <CoursePluginGovernancePanel
        courseId="course-1"
        pluginActivations={[
          {
            id: null,
            course_id: "course-1",
            program_plugin_installation_id: "installation-1",
            plugin_id: "course-resources",
            display_name: "Course Resources",
            description: "Manage files and links for each course.",
            author: "Jinyuan",
            version: "workspace",
            is_enabled: false,
            capabilities: { contexts: ["course"], available_tab_types: ["course-resources-tab"], supports_unassigned_course: true },
            available: false,
            availability_reason: "Disabled for this Course.",
            source: "course",
            auth_state: "not-required",
          },
        ]}
      />,
      { wrapper: Wrapper },
    );

    fireEvent.click(await screen.findByRole("switch", { name: "Course Resources enabled" }));

    await waitFor(() => {
      expect(apiMock.upsertCoursePluginActivation).toHaveBeenCalledWith("course-1", "course-resources", {
        is_enabled: true,
      });
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["courses", "detail", "course-1"] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["courses", "course-1", "plugin-activations"] });
  });

  it("uses the header switch to bulk-enable editable Course plugins", async () => {
    apiMock.bulkUpdateCoursePluginActivations.mockResolvedValue([]);

    const { Wrapper } = createQueryClientWrapper();
    render(
      <CoursePluginGovernancePanel
        courseId="course-1"
        pluginActivations={[
          {
            id: null,
            course_id: "course-1",
            program_plugin_installation_id: "installation-1",
            plugin_id: "course-resources",
            display_name: "Course Resources",
            description: "Manage files and links for each course.",
            author: "Jinyuan",
            version: "workspace",
            is_enabled: false,
            capabilities: { contexts: ["course"], supports_unassigned_course: true },
            available: false,
            availability_reason: "Disabled for this Course.",
            source: "course",
            auth_state: "not-required",
          },
          {
            id: null,
            course_id: "course-1",
            program_plugin_installation_id: "installation-2",
            plugin_id: "world-clock",
            display_name: "World Clock",
            description: "Track time across cities and time zones at a glance.",
            author: "Jinyuan",
            version: "workspace",
            is_enabled: false,
            capabilities: { contexts: ["course"], supports_unassigned_course: true },
            available: false,
            availability_reason: "Disabled for this Course.",
            source: "course",
            auth_state: "not-required",
          },
        ]}
      />,
      { wrapper: Wrapper },
    );

    const switches = await screen.findAllByRole("switch");
    fireEvent.click(switches[0]);

    await waitFor(() => {
      expect(apiMock.bulkUpdateCoursePluginActivations).toHaveBeenCalledWith("course-1", {
        plugin_ids: ["course-resources", "world-clock"],
        is_enabled: true,
      });
    });
  });

  it("opens plugin info for an unassigned Course plugin", async () => {
    const { Wrapper } = createQueryClientWrapper();
    render(
      <CoursePluginGovernancePanel
        courseId="course-1"
        pluginActivations={[
          {
            id: null,
            course_id: "course-1",
            program_plugin_installation_id: "installation-1",
            plugin_id: "course-resources",
            display_name: "Course Resources",
            description: "Manage files and links for each course.",
            long_description: "Course Resources keeps important files and links close at hand for each course.",
            author: "Jinyuan",
            version: "workspace",
            is_enabled: false,
            capabilities: { contexts: ["course"], available_tab_types: ["course-resources-tab"], supports_unassigned_course: true },
            available: false,
            availability_reason: "Disabled for this Course.",
            source: "course",
            auth_state: "not-required",
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
