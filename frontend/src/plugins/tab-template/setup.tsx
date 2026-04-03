// input:  [host-provided setup field components and template settings semantics]
// output: [default-exported tab-template plugin setup definition covering all host-provided setup field components and validation hooks]
// pos:    [Semester setup entry for tab-template that demonstrates the full plugin setup component surface without custom setup or review components]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import {
  definePluginSetup,
  PluginSetupBooleanField,
  PluginSetupDateField,
  PluginSetupJsonField,
  PluginSetupNumberField,
  PluginSetupSection,
  PluginSetupSelectField,
  PluginSetupTextField,
  PluginSetupTextareaField,
} from "@/plugin-sdk";

export default definePluginSetup({
  content: (
    <>
      <PluginSetupSection
        id="template-setup"
        title="Content"
        description="Set up the core content and cadence for this template workspace."
      >
        <PluginSetupTextField
          path="initialTitle"
          settingsKey="tab-template"
          label="Initial title"
          required
          defaultValue="Tab Template"
          description="Choose the title shown when the template tab first opens."
          placeholder="Prototype workspace title"
          validate={(value) => (
            typeof value === "string" && value.trim().length >= 3
              ? null
              : "Use at least 3 characters for the title."
          )}
        />
        <PluginSetupTextareaField
          path="initialNote"
          settingsKey="tab-template"
          label="Starter note"
          defaultValue=""
          description="Seed the persistent note area with starter content for this Semester."
          placeholder="Add a short note that explains what this prototype is for."
        />
        <PluginSetupNumberField
          path="focusMinutes"
          settingsKey="tab-template"
          label="Default focus session (minutes)"
          required
          defaultValue={45}
          description="Pick the default focus block length suggested by this template."
          placeholder="45"
          validate={(value) => (
            typeof value === "number" && Number.isFinite(value) && value >= 15 && value <= 180
              ? null
              : "Choose a focus session between 15 and 180 minutes."
          )}
        />
        <PluginSetupDateField
          path="kickoffDate"
          settingsKey="tab-template"
          label="Kickoff date"
          required
          defaultValue="2026-01-12"
          description="Set the first day this prototype should be considered active in the Semester."
        />
      </PluginSetupSection>

      <PluginSetupSection
        id="template-behavior"
        title="Behavior"
        description="Choose how the template behaves when users first open it."
      >
        <PluginSetupBooleanField
          path="showChecklist"
          settingsKey="tab-template"
          label="Show starter checklist"
          defaultValue
          description="Keep the onboarding checklist visible when the tab is first used."
        />
        <PluginSetupSelectField
          path="defaultView"
          settingsKey="tab-template"
          label="Default opening surface"
          required
          defaultValue="notes"
          description="Choose which part of the template should be emphasized first."
          options={[
            { label: "Notes", value: "notes" },
            { label: "Checklist", value: "checklist" },
            { label: "Timeline", value: "timeline" },
          ]}
          summaryLabels={{
            notes: "Notes",
            checklist: "Checklist",
            timeline: "Timeline",
          }}
        />
      </PluginSetupSection>

      <PluginSetupSection
        id="template-blocks"
        title="Starter Blocks"
        description="Seed a few starter blocks to demonstrate the JSON field workflow."
      >
        <PluginSetupJsonField
          path="starterBlocks"
          settingsKey="tab-template"
          label="Starter blocks"
          required
          defaultValue={[
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
          ]}
          description="Configure the starter blocks that should seed this tab when it is first used."
          placeholder={'[\n  {\n    "id": "overview",\n    "label": "Overview",\n    "kind": "notes"\n  }\n]'}
          validate={(value) => (
            Array.isArray(value)
              ? null
              : "Starter blocks must be a JSON array."
          )}
        />
      </PluginSetupSection>
    </>
  ),
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
