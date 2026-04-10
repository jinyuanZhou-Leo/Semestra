// input:  [bound plugin settings field hooks/components, mocked tab-settings APIs, query cache, and testing-library interactions]
// output: [regression tests covering plugin-panel bound settings fields, scoped persistence, and custom hook usage]
// pos:    [UI and hook coverage for the frontend-only plugin settings binding layer used by settings.tsx panels]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from "react";
import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getProgramTabSettingsQueryOptions } from "@/data/resources/programs";
import { createQueryClientWrapper } from "@/test/queryClientWrapper";
import type { TabSetting } from "@/services/api";

import { PluginSettingsPanelProvider } from "./pluginSettingsPanelContext";
import {
  PluginSettingsBooleanField,
  PluginSettingsBucketSourceBanner,
  PluginSettingsInlineSourceBanner,
  PluginSettingsTextField,
  usePluginSettingField,
  usePluginSettingsBucket,
} from "./pluginSettingsFields";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getProgramTabSettings: vi.fn(),
    upsertProgramTabSettings: vi.fn(),
  },
}));

vi.mock("@/services/api", () => ({
  default: apiMock,
}));

const buildTabSetting = (overrides?: Partial<TabSetting>): TabSetting => ({
  id: "setting-1",
  settings_key: "template-settings",
  settings: JSON.stringify({
    title: "Scoped title",
    showChecklist: true,
  }),
  scope_settings: {
    title: "Scoped title",
    showChecklist: true,
  },
  inherited_settings: {
    title: "Inherited title",
  },
  resolved_settings: {
    title: "Scoped title",
    showChecklist: true,
  },
  setting_sources: {
    title: {
      effective_layer: "program",
      is_overridden_in_scope: true,
      fallback_layer: "default",
    },
    showChecklist: {
      effective_layer: "default",
      is_overridden_in_scope: false,
      fallback_layer: null,
    },
  },
  program_id: "program-1",
  ...overrides,
});

const createWrapper = (tabSettings: TabSetting[]) => {
  const { Wrapper, queryClient } = createQueryClientWrapper();
  queryClient.setQueryData(getProgramTabSettingsQueryOptions("program-1").queryKey, tabSettings);

  const Provider: React.FC<React.PropsWithChildren> = ({ children }) => (
    <Wrapper>
      <PluginSettingsPanelProvider
        pluginId="tab-template"
        scope={{ kind: "program", programId: "program-1" }}
        onRefresh={() => {}}
      >
        {children}
      </PluginSettingsPanelProvider>
    </Wrapper>
  );

  return {
    Wrapper: Provider,
    queryClient,
  };
};

describe("plugin settings bound fields", () => {
  beforeEach(() => {
    apiMock.getProgramTabSettings.mockReset();
    apiMock.upsertProgramTabSettings.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads a resolved field value from the current scope bucket", () => {
    const { Wrapper } = createWrapper([buildTabSetting()]);

    const { result } = renderHook(
      () => usePluginSettingField<string>("template-settings", "title"),
      { wrapper: Wrapper },
    );

    expect(result.current.value).toBe("Scoped title");
  });

  it("renders Modified badge and reset button when the field is overridden in scope", () => {
    const { Wrapper } = createWrapper([buildTabSetting()]);

    render(
      <PluginSettingsTextField
        settingsKey="template-settings"
        fieldPath="title"
        label="Template title"
      />,
      { wrapper: Wrapper },
    );

    // title has is_overridden_in_scope: true in the mock, so badge and reset should appear
    expect(screen.getByText("Modified")).toBeInTheDocument();
    // Reset button is hidden until hover; check it exists in the DOM
    expect(screen.getByRole("button", { name: "Restore default" })).toBeInTheDocument();
  });

  it("does not render source hint when the field is at default layer and not overridden", () => {
    const { Wrapper } = createWrapper([buildTabSetting()]);

    render(
      <PluginSettingsBooleanField
        settingsKey="template-settings"
        fieldPath="showChecklist"
        label="Show checklist"
      />,
      { wrapper: Wrapper },
    );

    // showChecklist has effective_layer: "default", is_overridden_in_scope: false — nothing shown
    expect(screen.queryByText("Modified")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore default" })).not.toBeInTheDocument();
  });

  it("updates the scoped settings bucket when a bound field changes", async () => {
    let currentTabSettings = [buildTabSetting()];
    apiMock.getProgramTabSettings.mockImplementation(async () => currentTabSettings);
    apiMock.upsertProgramTabSettings.mockImplementation(async (_programId: string, settingsKey: string, payload: { settings: string }) => {
      const nextScopeSettings = JSON.parse(payload.settings) as Record<string, unknown>;
      const nextTabSetting = buildTabSetting({
        settings_key: settingsKey,
        settings: payload.settings,
        scope_settings: nextScopeSettings,
        resolved_settings: {
          title: String(nextScopeSettings.title ?? "Inherited title"),
          showChecklist: Boolean(nextScopeSettings.showChecklist ?? false),
        },
      });
      currentTabSettings = [nextTabSetting];
      return nextTabSetting;
    });

    const { Wrapper } = createWrapper(currentTabSettings);

    render(
      <PluginSettingsTextField
        settingsKey="template-settings"
        fieldPath="title"
        label="Template title"
      />,
      { wrapper: Wrapper },
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Updated title" },
    });

    await waitFor(() => {
      expect(apiMock.upsertProgramTabSettings).toHaveBeenCalledWith("program-1", "template-settings", {
        settings: JSON.stringify({
          title: "Updated title",
          showChecklist: true,
        }),
      });
    });
  });

  it("serializes overlapping saves so later edits keep earlier pending field changes", async () => {
    let currentTabSettings = [buildTabSetting()];
    let resolveFirstSave: ((value: TabSetting) => void) | null = null;

    apiMock.getProgramTabSettings.mockImplementation(async () => currentTabSettings);
    apiMock.upsertProgramTabSettings
      .mockImplementationOnce(async () => {
        return await new Promise<TabSetting>((resolve) => {
          resolveFirstSave = (nextTabSetting) => {
            currentTabSettings = [nextTabSetting];
            resolve(nextTabSetting);
          };
        });
      })
      .mockImplementationOnce(async (_programId: string, settingsKey: string, payload: { settings: string }) => {
        const nextScopeSettings = JSON.parse(payload.settings) as Record<string, unknown>;
        const nextTabSetting = buildTabSetting({
          settings_key: settingsKey,
          settings: payload.settings,
          scope_settings: nextScopeSettings,
          resolved_settings: {
            title: String(nextScopeSettings.title ?? "Inherited title"),
            showChecklist: Boolean(nextScopeSettings.showChecklist ?? false),
          },
        });
        currentTabSettings = [nextTabSetting];
        return nextTabSetting;
      });

    const { Wrapper } = createWrapper(currentTabSettings);

    render(
      <>
        <PluginSettingsTextField
          settingsKey="template-settings"
          fieldPath="title"
          label="Template title"
        />
        <PluginSettingsBooleanField
          settingsKey="template-settings"
          fieldPath="showChecklist"
          label="Show checklist"
        />
      </>,
      { wrapper: Wrapper },
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Updated title" },
    });

    await waitFor(() => {
      expect(apiMock.upsertProgramTabSettings).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("switch", { name: "Show checklist" }));

    expect(apiMock.upsertProgramTabSettings).toHaveBeenCalledTimes(1);
    expect(apiMock.upsertProgramTabSettings).toHaveBeenNthCalledWith(
      1,
      "program-1",
      "template-settings",
      {
        settings: JSON.stringify({
          title: "Updated title",
          showChecklist: true,
        }),
      },
    );

    const firstTabSetting = buildTabSetting({
      settings_key: "template-settings",
      settings: JSON.stringify({
        title: "Updated title",
        showChecklist: true,
      }),
      scope_settings: {
        title: "Updated title",
        showChecklist: true,
      },
      resolved_settings: {
        title: "Updated title",
        showChecklist: true,
      },
    });

    expect(resolveFirstSave).not.toBeNull();
    resolveFirstSave!(firstTabSetting);

    await waitFor(() => {
      expect(apiMock.upsertProgramTabSettings).toHaveBeenCalledTimes(2);
    });

    expect(apiMock.upsertProgramTabSettings).toHaveBeenNthCalledWith(
      2,
      "program-1",
      "template-settings",
      {
        settings: JSON.stringify({
          title: "Updated title",
        }),
      },
    );
  });

  it("resetField removes the field from scope settings and persists", async () => {
    let currentTabSettings = [buildTabSetting()];
    apiMock.getProgramTabSettings.mockImplementation(async () => currentTabSettings);
    apiMock.upsertProgramTabSettings.mockImplementation(async (_programId: string, settingsKey: string, payload: { settings: string }) => {
      const nextScopeSettings = JSON.parse(payload.settings) as Record<string, unknown>;
      const nextTabSetting = buildTabSetting({
        settings_key: settingsKey,
        settings: payload.settings,
        scope_settings: nextScopeSettings,
        resolved_settings: nextScopeSettings,
      });
      currentTabSettings = [nextTabSetting];
      return nextTabSetting;
    });

    const { Wrapper } = createWrapper(currentTabSettings);

    const { result } = renderHook(
      () => usePluginSettingField<string>("template-settings", "title"),
      { wrapper: Wrapper },
    );

    result.current.reset();

    await waitFor(() => {
      expect(apiMock.upsertProgramTabSettings).toHaveBeenCalledWith(
        "program-1",
        "template-settings",
        {
          // title key removed; showChecklist remains
          settings: JSON.stringify({ showChecklist: true }),
        },
      );
    });
  });

  it("PluginSettingsBucketSourceBanner shows inherited notice when field comes from parent scope", () => {
    const inheritedTabSetting = buildTabSetting({
      scope_settings: {},
      setting_sources: {
        rows: {
          effective_layer: "program",
          is_overridden_in_scope: false,
          fallback_layer: null,
        },
      },
    });
    const { Wrapper } = createWrapper([inheritedTabSetting]);

    const BannerWrapper: React.FC = () => {
      const bucket = usePluginSettingsBucket("template-settings");
      return <PluginSettingsBucketSourceBanner bucket={bucket} fieldPath="rows" />;
    };

    render(<BannerWrapper />, { wrapper: Wrapper });

    expect(screen.getByText(/From/)).toBeInTheDocument();
    expect(screen.getByText("Program")).toBeInTheDocument();
  });

  it("PluginSettingsBucketSourceBanner keeps a reserved row when the field uses the default layer", () => {
    const defaultTabSetting = buildTabSetting({
      setting_sources: {
        rows: {
          effective_layer: "default",
          is_overridden_in_scope: false,
          fallback_layer: null,
        },
      },
    });
    const { Wrapper } = createWrapper([defaultTabSetting]);

    const BannerWrapper: React.FC = () => {
      const bucket = usePluginSettingsBucket("template-settings");
      return <PluginSettingsBucketSourceBanner bucket={bucket} fieldPath="rows" />;
    };

    const { container } = render(<BannerWrapper />, { wrapper: Wrapper });
    const banner = container.querySelector('[data-slot="plugin-settings-source-banner"]');

    expect(banner).not.toBeNull();
    expect(banner).toHaveAttribute("aria-hidden", "true");
    expect(banner).toBeEmptyDOMElement();
  });

  it("PluginSettingsBucketSourceBanner shows modified notice and reset button when field is overridden", async () => {
    let currentTabSettings = [buildTabSetting()];
    apiMock.getProgramTabSettings.mockImplementation(async () => currentTabSettings);
    apiMock.upsertProgramTabSettings.mockImplementation(async (_programId: string, settingsKey: string, payload: { settings: string }) => {
      const nextTabSetting = buildTabSetting({
        settings_key: settingsKey,
        settings: payload.settings,
        scope_settings: JSON.parse(payload.settings) as Record<string, unknown>,
        setting_sources: {
          rows: { effective_layer: "program", is_overridden_in_scope: true, fallback_layer: null },
        },
      });
      currentTabSettings = [nextTabSetting];
      return nextTabSetting;
    });

    const overriddenTabSetting = buildTabSetting({
      setting_sources: {
        rows: { effective_layer: "program", is_overridden_in_scope: true, fallback_layer: null },
      },
    });
    const { Wrapper } = createWrapper([overriddenTabSetting]);

    const BannerWrapper: React.FC = () => {
      const bucket = usePluginSettingsBucket("template-settings");
      return <PluginSettingsBucketSourceBanner bucket={bucket} fieldPath="rows" />;
    };

    render(<BannerWrapper />, { wrapper: Wrapper });

    expect(screen.getByText(/^Modified$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore default" })).toBeInTheDocument();
  });

  it("PluginSettingsInlineSourceBanner renders an inline badge without the block banner slot", () => {
    const inheritedTabSetting = buildTabSetting({
      scope_settings: {},
      setting_sources: {
        rows: {
          effective_layer: "program",
          is_overridden_in_scope: false,
          fallback_layer: null,
        },
      },
    });
    const { Wrapper } = createWrapper([inheritedTabSetting]);

    const BannerWrapper: React.FC = () => {
      const bucket = usePluginSettingsBucket("template-settings");
      return <PluginSettingsInlineSourceBanner bucket={bucket} fieldPath="rows" />;
    };

    const { container } = render(<BannerWrapper />, { wrapper: Wrapper });

    expect(container.querySelector('[data-slot="plugin-settings-inline-source-banner"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="plugin-settings-source-banner"]')).toBeNull();
    expect(screen.getByText("Program")).toBeInTheDocument();
  });

});
