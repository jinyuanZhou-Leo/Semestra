// input:  [plugin setup DSL helpers and template settings semantics]
// output: [default-exported tab-template plugin setup definition covering all host-rendered DSL field types and validation hooks]
// pos:    [Semester setup entry for tab-template that demonstrates the full plugin setup DSL surface without custom setup or review components]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import {
  booleanField,
  dateField,
  definePluginSetup,
  jsonField,
  numberField,
  section,
  selectField,
  textField,
  textareaField,
} from "@/plugin-system/setup";

export default definePluginSetup({
  fields: {
    initialTitle: textField({
      label: "Initial title",
      persist: "setupState",
      required: true,
      defaultValue: "Tab Template",
      description: "Choose the title shown when the template tab first opens.",
      placeholder: "Prototype workspace title",
      validate: (value) => (
        typeof value === "string" && value.trim().length >= 3
          ? null
          : "Use at least 3 characters for the title."
      ),
    }),
    initialNote: textareaField({
      label: "Starter note",
      persist: "setupState",
      defaultValue: "",
      description: "Seed the persistent note area with starter content for this Semester.",
      placeholder: "Add a short note that explains what this prototype is for.",
    }),
    focusMinutes: numberField({
      label: "Default focus session (minutes)",
      persist: "both",
      required: true,
      defaultValue: 45,
      description: "Pick the default focus block length suggested by this template.",
      placeholder: "45",
      validate: (value) => (
        typeof value === "number" && Number.isFinite(value) && value >= 15 && value <= 180
          ? null
          : "Choose a focus session between 15 and 180 minutes."
      ),
    }),
    showChecklist: booleanField({
      label: "Show starter checklist",
      persist: "setupState",
      defaultValue: true,
      description: "Keep the onboarding checklist visible when the tab is first used.",
    }),
    defaultView: selectField({
      label: "Default opening surface",
      persist: "both",
      required: true,
      defaultValue: "notes",
      description: "Choose which part of the template should be emphasized first.",
      options: [
        { label: "Notes", value: "notes" },
        { label: "Checklist", value: "checklist" },
        { label: "Timeline", value: "timeline" },
      ],
      summaryLabels: {
        notes: "Notes",
        checklist: "Checklist",
        timeline: "Timeline",
      },
    }),
    kickoffDate: dateField({
      label: "Kickoff date",
      persist: "semesterOverride",
      required: true,
      defaultValue: "2026-01-12",
      description: "Set the first day this prototype should be considered active in the Semester.",
    }),
    starterBlocks: jsonField({
      label: "Starter blocks",
      persist: "setupState",
      required: true,
      defaultValue: [
        {
          id: "overview",
          label: "Overview",
          kind: "notes",
        },
        {
          id: "tasks",
          label: "Tasks",
          kind: "checklist",
        },
      ],
      description: "Configure the starter blocks that should seed this tab when it is first used.",
      placeholder: '[\n  {\n    "id": "overview",\n    "label": "Overview",\n    "kind": "notes"\n  }\n]',
      validate: (value) => (
        Array.isArray(value)
          ? null
          : "Starter blocks must be a JSON array."
      ),
    }),
  },
  sections: [
    section("template-setup", {
      title: "Content",
      description: "Set up the core content and cadence for this template workspace.",
      fieldKeys: ["initialTitle", "initialNote", "focusMinutes", "kickoffDate"],
    }),
    section("template-behavior", {
      title: "Behavior",
      description: "Choose how the template behaves when users first open it.",
      fieldKeys: ["showChecklist", "defaultView"],
    }),
    section("template-blocks", {
      title: "Starter Blocks",
      description: "Seed a few starter blocks to demonstrate the JSON field workflow.",
      fieldKeys: ["starterBlocks"],
    }),
  ],
  validate: ({ values }) => {
    if (values.defaultView === "checklist" && values.showChecklist === false) {
      return {
        fieldPath: "showChecklist",
        message: "Enable the starter checklist or choose a different opening surface.",
      };
    }
    return null;
  },
});
