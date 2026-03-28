// input:  [plugin setup validation helpers, setup DSL field builders, and Vitest assertions]
// output: [unit tests covering default setup UI mode, default value resolution, and combined field/form validation]
// pos:    [pure setup-contract regression suite for plugin-authored DSL validation and UI-mode normalization]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it } from "vitest";

import { definePluginSetup, resolvePluginSetupValues, textField, validatePluginSetupDefinition } from "./setup";

describe("plugin-system setup contract", () => {
  it("defaults setup UI mode to DSL", () => {
    const definition = definePluginSetup({
      fields: {
        semesterName: textField({
          label: "Semester name",
          persist: "setupState",
        }),
      },
      sections: [
        {
          id: "general",
          title: "General",
          fieldKeys: ["semesterName"],
        },
      ],
    });

    expect(definition.ui).toEqual({ kind: "dsl" });
  });

  it("resolves missing setup values from field defaults", () => {
    const definition = definePluginSetup({
      fields: {
        semesterName: textField({
          label: "Semester name",
          persist: "setupState",
          defaultValue: "Winter 2026",
        }),
      },
      sections: [
        {
          id: "general",
          title: "General",
          fieldKeys: ["semesterName"],
        },
      ],
    });

    expect(resolvePluginSetupValues(definition, {})).toEqual({
      semesterName: "Winter 2026",
    });
  });

  it("combines required, field-level, and definition-level validation", async () => {
    const definition = definePluginSetup({
      fields: {
        semesterName: textField({
          label: "Semester name",
          persist: "setupState",
          required: true,
          validate: (value) => typeof value === "string" && value.startsWith("Sem")
            ? null
            : "Semester name must start with 'Sem'.",
        }),
      },
      sections: [
        {
          id: "general",
          title: "General",
          fieldKeys: ["semesterName"],
        },
      ],
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
