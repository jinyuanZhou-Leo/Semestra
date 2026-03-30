// input:  [plugin-global settings section definitions, scope contracts, and React subscription state]
// output: [`PluginSettingsRegistry`, plugin settings section prop types, and registry subscription hooks]
// pos:    [Settings registry that exposes plugin-global settings sections plus stable scope-aware props to Program, Semester, and Course settings pages]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useSyncExternalStore } from 'react';

export type PluginSettingsContext = 'program' | 'semester' | 'course';

export type PluginSettingsScope =
  | {
    kind: 'program';
    programId: string;
  }
  | {
    kind: 'semester';
    semesterId: string;
    programId?: string;
  }
  | {
    kind: 'course';
    courseId: string;
    semesterId?: string;
    programId?: string;
  };

export interface PluginSettingsSectionProps {
  pluginId: string;
  scope: PluginSettingsScope;
  onRefresh: () => void;
}

export interface PluginSettingsSectionDefinition {
  id: string;
  component: React.FC<PluginSettingsSectionProps>;
  allowedContexts?: PluginSettingsContext[];
}

export interface RegisteredPluginSettingsSectionDefinition extends PluginSettingsSectionDefinition {
  pluginId: string;
}

type Listener = () => void;

const DEFAULT_ALLOWED_CONTEXTS: PluginSettingsContext[] = ['program', 'semester', 'course'];

export class PluginSettingsRegistryClass {
  private pluginSettingsSections: RegisteredPluginSettingsSectionDefinition[] = [];
  private listeners: Set<Listener> = new Set();
  private snapshot: RegisteredPluginSettingsSectionDefinition[] = [];
  private snapshotByContext: Record<PluginSettingsContext, RegisteredPluginSettingsSectionDefinition[]> = {
    program: [],
    semester: [],
    course: [],
  };

  private rebuildSnapshots() {
    this.snapshot = [...this.pluginSettingsSections];
    this.snapshotByContext = {
      program: this.snapshot.filter((definition) => {
        const allowedContexts = definition.allowedContexts ?? DEFAULT_ALLOWED_CONTEXTS;
        return allowedContexts.includes('program');
      }),
      semester: this.snapshot.filter((definition) => {
        const allowedContexts = definition.allowedContexts ?? DEFAULT_ALLOWED_CONTEXTS;
        return allowedContexts.includes('semester');
      }),
      course: this.snapshot.filter((definition) => {
        const allowedContexts = definition.allowedContexts ?? DEFAULT_ALLOWED_CONTEXTS;
        return allowedContexts.includes('course');
      }),
    };
  }

  registerPluginSettingsMany(pluginId: string, definitions: PluginSettingsSectionDefinition[]) {
    const nextDefinitions = this.pluginSettingsSections.filter((definition) => definition.pluginId !== pluginId);
    if (definitions.length > 0) {
      nextDefinitions.push(
        ...definitions.map((definition) => ({
          pluginId,
          ...definition,
        }))
      );
    }
    this.pluginSettingsSections = nextDefinitions;
    this.rebuildSnapshots();
    this.notifyListeners();
  }

  getAllPluginSettingsSections(context?: PluginSettingsContext): RegisteredPluginSettingsSectionDefinition[] {
    if (!context) {
      return this.snapshot;
    }
    return this.snapshotByContext[context];
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }
}

export const PluginSettingsRegistry = new PluginSettingsRegistryClass();

export const usePluginSettingsRegistry = (
  context?: PluginSettingsContext
): RegisteredPluginSettingsSectionDefinition[] => {
  return useSyncExternalStore(
    (listener) => PluginSettingsRegistry.subscribe(listener),
    () => PluginSettingsRegistry.getAllPluginSettingsSections(context),
    () => PluginSettingsRegistry.getAllPluginSettingsSections(context)
  );
};
