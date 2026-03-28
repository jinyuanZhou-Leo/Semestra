// input:  [builtin-event-core setup definition and generic plugin-setup validation helper]
// output: [regression tests for builtin-event-core setup defaults and event-type validation]
// pos:    [plugin-local test suite guarding builtin-event-core setup behavior across default values and custom validator rules]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it } from "vitest";

import { resolvePluginSetupValues, validatePluginSetupDefinition } from "@/plugin-system";

import setupDefinition from "./setup";

describe("builtin-event-core setup", () => {
  it("hydrates the calendar default and accepts builtin event-type fallbacks", async () => {
    const values = resolvePluginSetupValues(setupDefinition, {});
    const issues = await validatePluginSetupDefinition(setupDefinition, values);

    expect(values.calendarDefaultView).toBe("month");
    expect(values.eventTypes).toBeNull();
    expect(issues).toEqual([]);
  });

  it("rejects an empty event-type list", async () => {
    const issues = await validatePluginSetupDefinition(setupDefinition, {
      calendarDefaultView: "month",
      eventTypes: [],
    });

    expect(issues).toContainEqual({
      fieldPath: "eventTypes",
      message: "Add at least one event type before continuing.",
    });
  });

  it("rejects duplicate event-type codes and abbreviations", async () => {
    const issues = await validatePluginSetupDefinition(setupDefinition, {
      calendarDefaultView: "week",
      eventTypes: [
        { id: "lecture-1", code: "LECTURE", abbreviation: "LEC", track_attendance: false },
        { id: "lecture-2", code: "LECTURE", abbreviation: "TUT", track_attendance: false },
        { id: "tutorial-1", code: "TUTORIAL", abbreviation: "LEC", track_attendance: false },
      ],
    });

    expect(issues).toEqual(expect.arrayContaining([
      {
        fieldPath: "eventTypes",
        message: 'Event type "LECTURE" is duplicated.',
      },
      {
        fieldPath: "eventTypes",
        message: 'Event type abbreviation "LEC" is duplicated.',
      },
    ]));
  });
});
