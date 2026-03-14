// input:  [tab settings props, todo behavior normalization helpers, and shadcn Field/Switch primitives]
// output: [`TodoSettingsSection` component]
// pos:    [Todo settings panel that edits hidden-completed-bucket behavior using shadcn Field-based switch layout]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { SettingsSection } from '@/components/SettingsSection';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSet } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import type { TabSettingsProps } from '@/services/tabRegistry';
import { patchTodoBehaviorSettings, normalizeTodoBehaviorSettings } from './preferences';

export const TodoSettingsSection: React.FC<TabSettingsProps> = ({ settings, updateSettings }) => {
  const behavior = React.useMemo(() => normalizeTodoBehaviorSettings(settings), [settings]);

  return (
    <SettingsSection
      title="Todo"
      description="Task completion behavior"
    >
      <FieldSet>
        <FieldGroup>
          <Field orientation="responsive">
            <FieldContent>
              <FieldLabel htmlFor="todo-settings-move-completed">
                Store completed tasks in the hidden completed bucket
              </FieldLabel>
              <FieldDescription>
                When disabled, completed tasks stay attached to their original section records.
              </FieldDescription>
            </FieldContent>
            <Switch
              id="todo-settings-move-completed"
              checked={behavior.moveCompletedToCompletedSection}
              onCheckedChange={(checked) => {
                void Promise.resolve(
                  updateSettings(
                    patchTodoBehaviorSettings(settings, { moveCompletedToCompletedSection: checked }),
                  ),
                );
              }}
              className="shrink-0"
            />
          </Field>
        </FieldGroup>
      </FieldSet>
    </SettingsSection>
  );
};
