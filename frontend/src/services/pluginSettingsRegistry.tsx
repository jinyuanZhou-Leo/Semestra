"use no memo";

import React from 'react';

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

  registerTabSettings(definition: TabSettingsDefinition) {
    this.tabSettingsByType.set(definition.type, definition.component);
    this.notifyListeners();
  }

  registerTabSettingsMany(definitions: TabSettingsDefinition[]) {
    if (definitions.length === 0) return;
    definitions.forEach((definition) => {
      this.tabSettingsByType.set(definition.type, definition.component);
    });
    this.notifyListeners();
  }

  getTabSettingsComponent(type: string): React.FC<TabSettingsProps> | undefined {
    return this.tabSettingsByType.get(type);
  }

  getAllTabSettingsDefinitions(): TabSettingsDefinition[] {
    return Array.from(this.tabSettingsByType.entries()).map(([type, component]) => ({
      type,
      component,
    }));
  }

  registerWidgetGlobalSettings(definition: WidgetGlobalSettingsDefinition) {
    this.widgetGlobalSettingsByType.set(definition.type, definition.component);
    this.notifyListeners();
  }

  registerWidgetGlobalSettingsMany(definitions: WidgetGlobalSettingsDefinition[]) {
    if (definitions.length === 0) return;
    definitions.forEach((definition) => {
      this.widgetGlobalSettingsByType.set(definition.type, definition.component);
    });
    this.notifyListeners();
  }

  getWidgetGlobalSettingsComponent(type: string): React.FC<WidgetGlobalSettingsProps> | undefined {
    return this.widgetGlobalSettingsByType.get(type);
  }

  getAllWidgetGlobalSettingsDefinitions(): WidgetGlobalSettingsDefinition[] {
    return Array.from(this.widgetGlobalSettingsByType.entries()).map(([type, component]) => ({
      type,
      component,
    }));
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
  const [definitions, setDefinitions] = React.useState<TabSettingsDefinition[]>(
    () => PluginSettingsRegistry.getAllTabSettingsDefinitions()
  );

  React.useEffect(() => {
    setDefinitions(PluginSettingsRegistry.getAllTabSettingsDefinitions());
    return PluginSettingsRegistry.subscribe(() => {
      setDefinitions(PluginSettingsRegistry.getAllTabSettingsDefinitions());
    });
  }, []);

  return definitions;
};

export const useWidgetGlobalSettingsRegistry = (): WidgetGlobalSettingsDefinition[] => {
  const [definitions, setDefinitions] = React.useState<WidgetGlobalSettingsDefinition[]>(
    () => PluginSettingsRegistry.getAllWidgetGlobalSettingsDefinitions()
  );

  React.useEffect(() => {
    setDefinitions(PluginSettingsRegistry.getAllWidgetGlobalSettingsDefinitions());
    return PluginSettingsRegistry.subscribe(() => {
      setDefinitions(PluginSettingsRegistry.getAllWidgetGlobalSettingsDefinitions());
    });
  }, []);

  return definitions;
};

