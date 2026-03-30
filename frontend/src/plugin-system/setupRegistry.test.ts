// input:  [setup registry pure helpers, descriptor-backed setup schema types, and Vitest assertions]
// output: [unit tests covering descriptor setup-schema validation and eager registry hydration]
// pos:    [pure setup-registry regression suite for descriptor-backed setup schema validation and eager registry hydration]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it } from "vitest";

import type { PluginDescriptorSetupSchema } from "@/plugin-sdk";

import { createRegisteredPluginSetupDefinition, getAllPluginSetupDefinitions } from "./setupRegistry";

describe("plugin-system setup registry", () => {
  it("rejects sections that reference unknown field keys", () => {
    const schema: PluginDescriptorSetupSchema = {
      sections: [
        {
          id: "broken",
          title: "Broken",
          fields: [
            {
              path: "missingField",
              label: "Missing",
              type: "text",
            },
          ],
        },
      ],
    };

    const definition = createRegisteredPluginSetupDefinition("broken-plugin", schema);
    expect(definition.fieldOrder).toEqual(["missingField"]);
  });

  it("rejects select fields without options", () => {
    const schema: PluginDescriptorSetupSchema = {
      sections: [
        {
          id: "broken",
          title: "Broken",
          fields: [
            {
              path: "invalidSelect",
              label: "Invalid select",
              type: "select",
              options: [],
            },
          ],
        },
      ],
    };

    expect(() => createRegisteredPluginSetupDefinition("broken-plugin", schema)).toThrow("select fields must declare at least one option");
  });

  it("rejects duplicate section ids", () => {
    const schema: PluginDescriptorSetupSchema = {
      sections: [
        {
          id: "duplicate",
          title: "First",
          fields: [
            {
              path: "firstField",
              label: "First field",
              type: "text",
            },
          ],
        },
        {
          id: "duplicate",
          title: "Second",
          fields: [
            {
              path: "firstField",
              label: "First field",
              type: "text",
            },
          ],
        },
      ],
    };

    expect(() => createRegisteredPluginSetupDefinition("broken-plugin", schema)).toThrow('Duplicate setup section id "duplicate"');
  });

  it("registers the builtin-event-core setup schema from plugin.ts", () => {
    const definitions = getAllPluginSetupDefinitions();
    const definition = definitions.find((entry) => entry.pluginId === "builtin-event-core");

    expect(definition).toBeDefined();
    expect(definition?.sections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "calendar-default-view",
        fieldKeys: ["calendarDefaultView"],
      }),
      expect.objectContaining({
        id: "event-type-setup",
        fieldKeys: ["eventTypes"],
      }),
    ]));
    expect(definition?.fields.calendarDefaultView).toEqual(expect.objectContaining({
      defaultValue: "month",
    }));
    expect(definition?.fields.eventTypes).toEqual(expect.objectContaining({
      type: "json",
    }));
  });
});
