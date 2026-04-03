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

import { getProgramDetailQueryOptions } from "@/data/resources/programs";
import { createQueryClientWrapper } from "@/test/queryClientWrapper";
import type { Program, TabSetting } from "@/services/api";

import { PluginSettingsPanelProvider } from "./pluginSettingsPanelContext";
import {
  PluginSettingsBooleanField,
  PluginSettingsTextField,
  usePluginSettingField,
} from "./pluginSettingsFields";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getProgram: vi.fn(),
    upsertProgramTabSettings: vi.fn(),
  },
}));

vi.mock("@/services/api", () => ({
  default: apiMock,
}));

type ProgramDetail = Program & { semesters: never[] };

const buildProgram = (tabSettings: TabSetting[] = []): ProgramDetail => ({
  id: "program-1",
  name: "Program One",
  cgpa_scaled: 0,
  cgpa_percentage: 0,
  grad_requirement_credits: 0,
  semesters: [],
  tab_settings: tabSettings,
});

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

const createWrapper = (program: ProgramDetail) => {
  const { Wrapper, queryClient } = createQueryClientWrapper();
  queryClient.setQueryData(getProgramDetailQueryOptions(program.id).queryKey, program);

  const Provider: React.FC<React.PropsWithChildren> = ({ children }) => (
    <Wrapper>
      <PluginSettingsPanelProvider
        pluginId="tab-template"
        scope={{ kind: "program", programId: program.id }}
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
    apiMock.getProgram.mockReset();
    apiMock.upsertProgramTabSettings.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads a resolved field value from the current scope bucket", () => {
    const { Wrapper } = createWrapper(buildProgram([buildTabSetting()]));

    const { result } = renderHook(
      () => usePluginSettingField<string>("template-settings", "title"),
      { wrapper: Wrapper },
    );

    expect(result.current.value).toBe("Scoped title");
  });

  it("does not render source or reset chrome for overridden template fields", () => {
    const { Wrapper } = createWrapper(buildProgram([buildTabSetting()]));

    render(
      <PluginSettingsTextField
        settingsKey="template-settings"
        fieldPath="title"
        label="Template title"
      />,
      { wrapper: Wrapper },
    );

    expect(screen.queryByText("Modified in Program")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore default" })).not.toBeInTheDocument();
  });

  it("does not render source hint when the field is not overridden in scope", () => {
    const { Wrapper } = createWrapper(buildProgram([buildTabSetting()]));

    render(
      <PluginSettingsBooleanField
        settingsKey="template-settings"
        fieldPath="showChecklist"
        label="Show checklist"
      />,
      { wrapper: Wrapper },
    );

    expect(screen.queryByText("Modified in Program")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore default" })).not.toBeInTheDocument();
  });

  it("updates the scoped settings bucket when a bound field changes", async () => {
    let currentProgram = buildProgram([buildTabSetting()]);
    apiMock.getProgram.mockImplementation(async () => currentProgram);
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
      currentProgram = buildProgram([nextTabSetting]);
      return nextTabSetting;
    });

    const { Wrapper } = createWrapper(currentProgram);

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

});
