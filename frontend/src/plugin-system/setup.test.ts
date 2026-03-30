// input:  [plugin setup validation helpers, setup DSL field builders, and Vitest assertions]
// output: [unit tests covering optional setup UI overrides, default value resolution, and combined field/form validation]
// pos:    [pure setup-contract regression suite for plugin-authored DSL validation and optional-override normalization]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { createElement } from "react";
import { describe, expect, it } from "vitest";

import {
  definePluginSetup,
  PluginSetupSection,
  PluginSetupTextField,
  resolvePluginSetupValues,
  validatePluginSetupDefinition,
} from "./setup";

describe("plugin-system setup contract", () => {
  it("defaults setup UI overrides to undefined", () => {
    const definition = definePluginSetup({
      content: createElement(
        PluginSetupSection,
        { id: "general", title: "General" },
        createElement(PluginSetupTextField, { path: "semesterName", label: "Semester name" }),
      ),
    });

    expect(definition.ui).toBeUndefined();
  });

  it("resolves missing setup values from field defaults", () => {
    const definition = definePluginSetup({
      content: createElement(
        PluginSetupSection,
        { id: "general", title: "General" },
        createElement(PluginSetupTextField, { path: "semesterName", label: "Semester name", defaultValue: "Winter 2026" }),
      ),
    });

    expect(resolvePluginSetupValues(definition, {})).toEqual({
      semesterName: "Winter 2026",
    });
  });

  it("combines required, field-level, and definition-level validation", async () => {
    const definition = definePluginSetup({
      content: createElement(
        PluginSetupSection,
        { id: "general", title: "General" },
        createElement(PluginSetupTextField, {
          path: "semesterName",
          label: "Semester name",
          required: true,
          validate: (value: unknown) => typeof value === "string" && value.startsWith("Sem")
            ? null
            : "Semester name must start with 'Sem'.",
        }),
      ),
      validate: ({ values }) => (
        values.semesterName === "Semester"
          ? null
          : [{ message: "Semester name must exactly equal 'Semester'." }]
      ),
    });

    await expect(validatePluginSetupDefinition(definition, { semesterName: "" })).resolves.toEqual([
      {
        fieldPath: "semesterName",
        message: "Semester name is required.",
      },
      {
        fieldPath: "semesterName",
        message: "Semester name must start with 'Sem'.",
      },
      {
        message: "Semester name must exactly equal 'Semester'.",
      },
    ]);
  });
});
