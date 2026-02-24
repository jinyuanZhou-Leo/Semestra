// input:  [plugin settings definition typing from plugin settings registry]
// output: [`tabSettingsDefinitions` and `widgetGlobalSettingsDefinitions` exports]
// pos:    [Eager plugin settings entry used by plugin-system settings autoload]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { TabSettingsDefinition, WidgetGlobalSettingsDefinition } from '@/services/pluginSettingsRegistry';

export const tabSettingsDefinitions: TabSettingsDefinition[] = [];

export const widgetGlobalSettingsDefinitions: WidgetGlobalSettingsDefinition[] = [];
