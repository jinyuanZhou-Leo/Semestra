// input:  [template settings helpers, public plugin-system tab settings contracts, and form primitives]
// output: [`TemplateTabSettingsComponent` for the tab-template plugin settings surface]
// pos:    [settings entry that owns the tab-template tab settings UI without changing the runtime behavior]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useCallback, useId, useMemo } from 'react';

import { definePluginSettings, PluginSettingsBooleanField, PluginSettingsTextField } from '@/plugin-sdk';
import { SettingsSection } from '@/components/SettingsSection';
import { Checkbox } from '@/components/ui/checkbox';
import { FieldGroup, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TabSettingsProps } from '@/services/tabRegistry';

import { resolveTemplateSettings } from './shared';

const TEMPLATE_SETTINGS_KEY = 'tab-template';

export const TemplateTabSettingsComponent: React.FC<TabSettingsProps> = ({ settings, updateSettings }) => {
  const resolved = useMemo(() => resolveTemplateSettings(settings), [settings]);
  const titleId = useId();
  const checklistId = useId();

  const handleTitleChange = useCallback((value: string) => {
    updateSettings({ ...resolved, title: value });
  }, [resolved, updateSettings]);

  const handleChecklistToggle = useCallback((checked: boolean) => {
    updateSettings({ ...resolved, showChecklist: checked });
  }, [resolved, updateSettings]);

  return (
    <SettingsSection
      title="Display"
      description="Configure how this tab is displayed."
    >
      <div className="grid gap-4">
        <div className="grid max-w-sm gap-2">
          <Label htmlFor={titleId}>Template Title</Label>
          <Input
            id={titleId}
            value={resolved.title}
            onChange={(event) => handleTitleChange(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={checklistId}
            checked={resolved.showChecklist}
            onCheckedChange={(checked) => {
              if (checked === 'indeterminate') return;
              handleChecklistToggle(checked);
            }}
          />
          <Label htmlFor={checklistId} className="cursor-pointer text-sm font-normal text-muted-foreground">
            Show quick-start checklist
          </Label>
        </div>
      </div>
    </SettingsSection>
  );
};

const TemplateProgramSettingsSection: React.FC = () => {

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
      id: 'template-program-settings',
      component: TemplateProgramSettingsSection,
      allowedContexts: ['program'],
    },
  ],
});
