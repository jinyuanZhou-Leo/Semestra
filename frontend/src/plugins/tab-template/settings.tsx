// input:  [template settings helpers, public plugin-system tab settings contracts, and form primitives]
// output: [`TemplateSettingsSection` for the tab-template plugin settings surface at program/semester/course]
// pos:    [settings entry that owns the tab-template tab settings UI without changing the runtime behavior]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React from 'react';

import { definePluginSettings, PluginSettingsBooleanField, PluginSettingsTextField } from '@/plugin-sdk';
import { SettingsSection } from '@/components/SettingsSection';
import { FieldGroup, FieldSet } from '@/components/ui/field';

const TEMPLATE_SETTINGS_KEY = 'tab-template';

const TemplateSettingsSection: React.FC = () => {

  return (
    <SettingsSection
      title="Display"
      description="Configure how this tab is displayed."
    >
      <FieldSet>
        <FieldGroup>
          <PluginSettingsTextField
            settingsKey={TEMPLATE_SETTINGS_KEY}
            fieldPath="title"
            label="Template title"
            description="Choose the title this template should use by default in the current scope."
            placeholder="Template workspace title"
          />
          <PluginSettingsBooleanField
            settingsKey={TEMPLATE_SETTINGS_KEY}
            fieldPath="showChecklist"
            label="Show quick-start checklist"
            description="Keep the quick-start checklist enabled for newly opened template tabs."
          />
        </FieldGroup>
      </FieldSet>
    </SettingsSection>
  );
};

export default definePluginSettings({
  pluginSettings: [
    {
      id: 'template-settings',
      component: TemplateSettingsSection,
      allowedContexts: ['program', 'semester', 'course'],
    },
  ],
});
