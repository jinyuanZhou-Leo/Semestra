import React, { useCallback, useId, useMemo } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsSection } from '@/components/SettingsSection';
import type { TabSettingsProps } from '@/services/tabRegistry';
import type { TabSettingsDefinition, WidgetGlobalSettingsDefinition } from '@/services/pluginSettingsRegistry';

import { resolveTemplateSettings } from './shared';

const TemplateTabSettingsComponent: React.FC<TabSettingsProps> = ({ settings, updateSettings }) => {
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
        <div className="grid gap-2">
          <Label htmlFor={titleId}>
            Template Title
          </Label>
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

export const tabSettingsDefinitions: TabSettingsDefinition[] = [
  {
    type: 'tab-template',
    component: TemplateTabSettingsComponent,
  },
];

export const widgetGlobalSettingsDefinitions: WidgetGlobalSettingsDefinition[] = [];
