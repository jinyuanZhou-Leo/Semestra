// input:  [plugin settings definitions from metadata modules and React subscription state]
// output: [`PluginSettingsRegistry`, definition types, and registry subscription hooks]
// pos:    [Settings registry that exposes plugin tab/global settings to settings pages]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useSyncExternalStore } from 'react';

import type { TabSettingsProps } from './tabRegistry';
import type { WidgetGlobalSettingsProps } from './widgetRegistry';

export interface TabSettingsDefinition {
  type: string;
  component: React.FC<TabSettingsProps>;
}

export interface WidgetGlobalSettingsDefinition {
  type: string;
  component: React.FC<WidgetGlobalSettingsProps>;
}

type Listener = () => void;

class PluginSettingsRegistryClass {
  private tabSettingsByType = new Map<string, React.FC<TabSettingsProps>>();
  private widgetGlobalSettingsByType = new Map<string, React.FC<WidgetGlobalSettingsProps>>();
  private listeners: Set<Listener> = new Set();
  private tabSnapshot: TabSettingsDefinition[] = [];
  private widgetSnapshot: WidgetGlobalSettingsDefinition[] = [];

  private rebuildSnapshots() {
    this.tabSnapshot = Array.from(this.tabSettingsByType.entries()).map(([type, component]) => ({
      type,
      component,
    }));
    this.widgetSnapshot = Array.from(this.widgetGlobalSettingsByType.entries()).map(([type, component]) => ({
      type,
      component,
    }));
  }

  registerTabSettings(definition: TabSettingsDefinition) {
    this.tabSettingsByType.set(definition.type, definition.component);
    this.rebuildSnapshots();
    this.notifyListeners();
  }

  registerTabSettingsMany(definitions: TabSettingsDefinition[]) {
    if (definitions.length === 0) return;
    definitions.forEach((definition) => {
      this.tabSettingsByType.set(definition.type, definition.component);
    });
    this.rebuildSnapshots();
    this.notifyListeners();
  }

  getTabSettingsComponent(type: string): React.FC<TabSettingsProps> | undefined {
    return this.tabSettingsByType.get(type);
  }

  getAllTabSettingsDefinitions(): TabSettingsDefinition[] {
    return this.tabSnapshot;
  }

  registerWidgetGlobalSettings(definition: WidgetGlobalSettingsDefinition) {
    this.widgetGlobalSettingsByType.set(definition.type, definition.component);
    this.rebuildSnapshots();
    this.notifyListeners();
  }

  registerWidgetGlobalSettingsMany(definitions: WidgetGlobalSettingsDefinition[]) {
    if (definitions.length === 0) return;
    definitions.forEach((definition) => {
      this.widgetGlobalSettingsByType.set(definition.type, definition.component);
    });
    this.rebuildSnapshots();
    this.notifyListeners();
  }

  getWidgetGlobalSettingsComponent(type: string): React.FC<WidgetGlobalSettingsProps> | undefined {
    return this.widgetGlobalSettingsByType.get(type);
  }

  getAllWidgetGlobalSettingsDefinitions(): WidgetGlobalSettingsDefinition[] {
    return this.widgetSnapshot;
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

export const useTabSettingsRegistry = (): TabSettingsDefinition[] => {
  return useSyncExternalStore(
    (listener) => PluginSettingsRegistry.subscribe(listener),
    () => PluginSettingsRegistry.getAllTabSettingsDefinitions(),
    () => PluginSettingsRegistry.getAllTabSettingsDefinitions()
  );
};

export const useWidgetGlobalSettingsRegistry = (): WidgetGlobalSettingsDefinition[] => {
  return useSyncExternalStore(
    (listener) => PluginSettingsRegistry.subscribe(listener),
    () => PluginSettingsRegistry.getAllWidgetGlobalSettingsDefinitions(),
    () => PluginSettingsRegistry.getAllWidgetGlobalSettingsDefinitions()
  );
};
