# Plugin Development Guide

This guide describes how to create and register new widget and tab plugins for the Semestra application. The plugin system is designed to be modular and easy to extend.

## Overview

Plugins can be one of two shapes:
1. **Widget**: A small, grid-based component inside the Dashboard tab.
2. **Tab**: A full-size panel that appears as a tab under the hero gradient.

Both shapes share a similar definition structure but are registered separately.
Plugins live in `frontend/src/plugins/<plugin-name>/` and can implement a widget, a tab, or both.

### Plugin Folder Structure (Recommended)

```
frontend/src/plugins/<plugin-name>/
  index.ts        // Exports widgetDefinition and/or tabDefinition
  widget.tsx      // Optional: widget implementation
  tab.tsx         // Optional: tab implementation
  shared.ts       // Optional: shared types/helpers
```

### Built-in Tabs

The application provides built-in tab plugins:
- `dashboard`
- `settings`

These are registered from `frontend/src/plugins/builtin-dashboard/` and `frontend/src/plugins/builtin-settings/`.
Do not reuse these `type` values in custom plugins.

### Auto Registration

`widget-setup.ts` and `tab-setup.ts` automatically scan all plugin `index.ts` files using `import.meta.glob`.
If you export `widgetDefinition` and/or `tabDefinition`, the framework registers them at startup.

## Structure

### WidgetDefinition

Every plugin must export a `WidgetDefinition` object:

```typescript
export interface WidgetDefinition {
    type: string;          // Unique identifier for the widget type
    name: string;          // Display name
    description?: string;  // Optional description
    icon?: string;         // Emoji or icon string
    component: React.FC<WidgetProps>; // The React component
    defaultSettings?: any; // Default values for settings
    defaultLayout?: { 
        w: number,         // Default width (grid units)
        h: number,         // Default height (grid units)
        minW?: number,     // Minimum width
        minH?: number      // Minimum height
    };
    maxInstances?: number | 'unlimited'; // Max instances per dashboard
    allowedContexts?: Array<'semester' | 'course'>; // Where this widget can be added
    // Lifecycle hooks
    onCreate?: (ctx: WidgetLifecycleContext) => Promise<void> | void;
    onDelete?: (ctx: WidgetLifecycleContext) => Promise<void> | void;
}

export interface WidgetLifecycleContext {
    widgetId: string;      // The ID of the widget instance
    semesterId?: string;   // Semester context (if applicable)
    courseId?: string;     // Course context (if applicable)
    settings: any;         // Widget settings at the time of the event
}
```

### WidgetProps

Your widget component will receive the following props:

```typescript
export interface WidgetProps {
    widgetId: string;      // The unique ID of this widget instance
    settings: any;         // The current settings for this widget (already parsed)
    semesterId?: string;   // Context: Semester ID (if applicable)
    courseId?: string;     // Context: Course ID (if applicable)
    
    // Framework-provided functions
    updateSettings: (newSettings: any) => void;  // Update settings (auto-debounced)
    updateCourseField?: (field: string, value: any) => void; // Update course data
}
```

### TabDefinition

```typescript
export interface TabDefinition {
    type: string;          // Unique identifier for the tab type
    name: string;          // Display name (used as tab title)
    description?: string;  // Optional description
    icon?: string;         // Emoji or icon string
    component: React.FC<TabProps>; // The main tab content component
    settingsComponent?: React.FC<TabSettingsProps>; // Optional settings panel
    defaultSettings?: any; // Default settings for new tabs
    maxInstances?: number | 'unlimited'; // Max instances per dashboard
    allowedContexts?: Array<'semester' | 'course'>; // Where this tab can be added
    onCreate?: (ctx: TabLifecycleContext) => Promise<void> | void;
    onDelete?: (ctx: TabLifecycleContext) => Promise<void> | void;
}
```

```typescript
export interface TabProps {
    tabId: string;
    settings: any;
    semesterId?: string;
    courseId?: string;
    updateSettings: (newSettings: any) => void; // Debounced by framework
}
```

```typescript
export interface TabSettingsProps {
    tabId: string;
    settings: any;
    semesterId?: string;
    courseId?: string;
    updateSettings: (newSettings: any) => void; // Debounced by framework
}
```

```typescript
export interface TabLifecycleContext {
    tabId: string;
    semesterId?: string;
    courseId?: string;
    settings: any;
}
```

## Creating a New Plugin

Follow these steps to create a new widget or tab.

### 1. Create the Plugin Files

Create a new folder in `frontend/src/plugins/`, for example `my-new-plugin/`.

`frontend/src/plugins/my-new-plugin/widget.tsx`

```typescript
import React, { useCallback } from 'react';
import type { WidgetDefinition, WidgetProps } from '../../services/widgetRegistry';

export const MyNew: React.FC<WidgetProps> = ({ settings, updateSettings }) => {
    // 1. Access settings directly - framework handles parsing
    const title = settings?.title || 'Default Title';

    // 2. Update settings - framework handles debouncing and API sync
    const handleTitleChange = useCallback((newTitle: string) => {
        // Just call updateSettings - framework does the rest:
        // - Updates UI immediately (Optimistic UI)
        // - Debounces API calls (300ms)
        // - Syncs to backend automatically
        updateSettings({ ...settings, title: newTitle });
    }, [settings, updateSettings]);

    return (
        <div style={{ padding: '1rem', height: '100%' }}>
            <input 
                value={title}
                onChange={e => handleTitleChange(e.target.value)}
            />
        </div>
    );
};

// 3. Define the widget metadata
export const MyNewDefinition: WidgetDefinition = {
    type: 'my-new-widget',
    name: 'My New Widget',
    description: 'A description of what this widget does.',
    icon: '✨',
    component: MyNew,
    defaultSettings: { title: 'Default Title' },
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 },
    maxInstances: 'unlimited',
    allowedContexts: ['semester', 'course']
};
```

### Tab Example

`frontend/src/plugins/my-new-plugin/tab.tsx`

```typescript
import React, { useCallback } from 'react';
import type { TabDefinition, TabProps } from '../../services/tabRegistry';

const NotesTab: React.FC<TabProps> = ({ settings, updateSettings }) => {
    const value = settings?.value || '';

    const handleChange = useCallback((next: string) => {
        updateSettings({ ...settings, value: next });
    }, [settings, updateSettings]);

    return (
        <div style={{ padding: '1rem' }}>
            <textarea
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                style={{ width: '100%', height: '60vh' }}
            />
        </div>
    );
};

export const NotesTabDefinition: TabDefinition = {
    type: 'notes-tab',
    name: 'Notes',
    description: 'Large scratchpad for planning.',
    icon: '📝',
    component: NotesTab,
    defaultSettings: { value: '' },
    maxInstances: 1,
    allowedContexts: ['semester', 'course']
};
```

### 2. Register the Plugin

Plugins are auto-registered via Vite's `import.meta.glob`. You only need to export from `index.ts`.

`frontend/src/plugins/my-new-plugin/index.ts`

```typescript
export { MyNewDefinition, MyNew } from './widget';
export { MyNewDefinition as widgetDefinition } from './widget';

export { NotesTabDefinition, NotesTab } from './tab';
export { NotesTabDefinition as tabDefinition } from './tab';
```

## Framework-Level Performance Optimizations

The plugin framework provides automatic performance optimizations. **Plugin developers do not need to implement these manually.**

### Optimistic UI + Debounced API Sync

When you call `updateSettings(newSettings)`:

1. **Immediate UI update**: Local state updates instantly for responsive user experience
2. **Debounced API call**: Multiple rapid updates are batched into a single API call (300ms debounce)
3. **Automatic cleanup**: Pending updates are synced when component unmounts

```typescript
// ✅ CORRECT: Just call updateSettings, framework handles everything
const handleChange = (value: string) => {
    updateSettings({ ...settings, myField: value });
};

// ❌ WRONG: Don't call API directly for settings updates
const handleChange = async (value: string) => {
    await api.updateWidget(widgetId, { settings: JSON.stringify(...) });
};
```

### React.memo Optimization

Widget components are automatically wrapped with `React.memo` at the framework level. The framework uses a custom comparison function that only triggers re-renders when:
- Widget ID changes
- Widget type changes
- Settings object changes (deep comparison)
- Context (semesterId/courseId) changes

## Lifecycle Hooks

Lifecycle hooks apply to both widgets and tabs.

### onCreate

Called **after** the widget/tab is successfully created in the database. If this function throws an error, the widget/tab will be automatically rolled back (deleted).

```typescript
onCreate: async (ctx) => {
    console.log(`Widget ${ctx.widgetId} created`);
    // Initialize external resources, setup subscriptions, etc.
    // Throw an error to cancel widget creation
}
```

### onDelete

Called **after** the widget/tab is successfully deleted from the database. Errors in this function are logged but do not affect the deletion.

```typescript
onDelete: async (ctx) => {
    console.log(`Widget ${ctx.widgetId} deleted`);
    // Clean up external resources, cancel subscriptions, etc.
}
```

### Example with Lifecycle Hooks

```typescript
export const MyDefinition: WidgetDefinition = {
    type: 'my-widget',
    name: 'My Widget',
    component: My,
    defaultSettings: {},
    defaultLayout: { w: 3, h: 2 },
    
    onCreate: async (ctx) => {
        // Example: register with an external service
        await externalService.register(ctx.widgetId);
    },
    
    onDelete: async (ctx) => {
        // Example: unregister from external service
        await externalService.unregister(ctx.widgetId);
    }
};
```

## Best Practices

### State Management

- **Use `settings` prop directly**: The framework handles parsing and provides an object
- **Use `updateSettings` for persistence**: Don't call `api.updateWidget` directly for settings
- **Trust the Optimistic UI**: UI updates are immediate, no need for local state in most cases

### Shared Settings (Tab + Widget)

When a plugin provides both a tab and a widget, keep settings in a single JSON object
but split into namespaces to avoid conflicts:

```json
{
  "shared": { "timezone": "UTC" },
  "widget": { "sizeMode": "compact" },
  "tab": { "layout": "timeline" }
}
```

- Put business data in `shared`
- Put view-only configuration in `widget` or `tab`

### When to Use Local State

Only use local state (`useState`) when:
- You need temporary UI state that shouldn't be persisted (e.g., hover state, dropdown open)
- You're managing derived/computed values

```typescript
// ❌ WRONG: Duplicating settings into local state
const [value, setValue] = useState(settings.value);
// Problem: May get out of sync with settings prop

// ✅ CORRECT: Use settings directly
const value = settings.value;
const handleChange = (newValue) => {
    updateSettings({ ...settings, value: newValue });
};
```

### Styling
- Use standard CSS or inline styles.
- Widgets: the container handles border/background, so fill available space (height: 100%).
- Tabs: optimize for large layouts; avoid forcing fixed heights.
- Use CSS variables (e.g., `var(--color-text-primary)`) to respect the theme (light/dark mode).

### Example: GradeCalculator

See `frontend/src/plugins/GradeCalculator.tsx` for a complete example demonstrating:
- Using `settings` directly without local state duplication
- Calling `updateSettings` for all changes
- Using `useMemo` for computed values

## UI 设计规范

- 插件UI中避免在上方添加标题，因为容器已经提供了标题
- 插件应当适配声明的所有尺寸
- 插件应当适配深色模式
- 插件应当高效利用空间，避免过多留白
- 插件中应对必要元素添加 `user-select: none`
- 使用 CSS 变量确保主题一致性：
  - `var(--color-text-primary)` - 主要文本颜色
  - `var(--color-text-secondary)` - 次要文本颜色
  - `var(--color-bg-primary)` - 主要背景色
  - `var(--color-border)` - 边框颜色

## Tab UI 设计规范

- Tab 内容中避免显示标题，Tab 栏已提供名称
- Tab 组件应将主要空间留给内容本身，避免额外占用垂直空间
- Tab 组件需适配深色模式，使用 CSS 变量保持主题一致
