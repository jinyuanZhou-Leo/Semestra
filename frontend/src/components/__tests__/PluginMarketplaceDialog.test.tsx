import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PluginMarketplaceDialog } from "../PluginMarketplaceDialog";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

describe("PluginMarketplaceDialog", () => {
  it("renders the provided marketplace description when no item is selected", async () => {
    render(
      <PluginMarketplaceDialog
        open
        onOpenChange={vi.fn()}
        title="Install plugin"
        description="Search the workspace catalog and install a plugin into this Program."
        searchPlaceholder="Search plugins"
        emptyLabel="No plugins available"
        noResultsLabel="No plugins match your search."
        items={[
          {
            pluginId: "course-resources",
            displayName: "Course Resources",
            description: "Manage files and links for each course.",
            author: "Jinyuan",
            label: "Install",
          },
        ]}
        onSelect={vi.fn()}
      />,
    );

    expect(
      await screen.findByText("Search the workspace catalog and install a plugin into this Program."),
    ).toBeInTheDocument();
  });
});
