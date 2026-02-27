"use no memo";

import React from 'react';
import { SettingsSection } from '@/components/SettingsSection';
import { Label } from '@/components/ui/label';
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
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-md border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="todo-settings-move-completed" className="cursor-pointer text-base">
              Move completed tasks to Completed section
            </Label>
            <p className="text-xs text-muted-foreground">
              When disabled, completed tasks stay in their section and are sorted at the end.
            </p>
          </div>
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
          />
        </div>
      </div>
    </SettingsSection>
  );
};
