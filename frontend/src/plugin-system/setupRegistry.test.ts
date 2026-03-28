// input:  [setup registry pure helpers, setup DSL helpers, and Vitest assertions]
// output: [unit tests covering setup-definition validation and generated backend manifest serialization]
// pos:    [pure setup-registry regression suite for plugin setup validation rules and generated backend manifest output]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it } from "vitest";

import { buildPluginSetupManifest, createRegisteredPluginSetupDefinition } from "./setupRegistry";
import { definePluginSetup, section, textField } from "./setup";

describe("plugin-system setup registry", () => {
  it("rejects sections that reference unknown field keys", () => {
    expect(() => createRegisteredPluginSetupDefinition("broken-plugin", definePluginSetup({
      fields: {
        knownField: textField({
          label: "Known field",
          persist: "setupState",
        }),
      },
      sections: [
        section("broken", {
          title: "Broken",
          fieldKeys: ["missingField"],
        }),
      ],
    }))).toThrow('unknown field key "missingField"');
  });

  it("rejects select fields without options", () => {
    expect(() => createRegisteredPluginSetupDefinition("broken-plugin", definePluginSetup({
      fields: {
        invalidSelect: {
          type: "select",
          label: "Invalid select",
          persist: "setupState",
          options: [],
        },
      },
      sections: [
        section("broken", {
          title: "Broken",
          fieldKeys: ["invalidSelect"],
        }),
      ],
    }))).toThrow("select fields must declare at least one option");
  });

  it("rejects duplicate section ids", () => {
    expect(() => createRegisteredPluginSetupDefinition("broken-plugin", definePluginSetup({
      fields: {
        firstField: textField({
          label: "First field",
          persist: "setupState",
        }),
      },
      sections: [
        section("duplicate", {
          title: "First",
          fieldKeys: ["firstField"],
        }),
        section("duplicate", {
          title: "Second",
          fieldKeys: ["firstField"],
        }),
      ],
    }))).toThrow('Duplicate setup section id "duplicate"');
  });

  it("serializes the builtin-event-core backend manifest entry", () => {
    const manifest = buildPluginSetupManifest();

    expect(manifest).toEqual(expect.arrayContaining([
      expect.objectContaining({
        plugin_id: "builtin-event-core",
        sections: [
          expect.objectContaining({
            id: "calendar-default-view",
            fields: [
              expect.objectContaining({
                path: "calendarDefaultView",
                persist: "both",
                default_value: "month",
              }),
            ],
          }),
          expect.objectContaining({
            id: "event-type-setup",
            fields: [
              expect.objectContaining({
                path: "eventTypes",
                type: "json",
                persist: "setupState",
              }),
            ],
          }),
        ],
      }),
    ]));
  });
});
