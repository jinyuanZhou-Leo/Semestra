# Plugin Development Guide

This guide describes how to create and register new widget plugins for the Semestra application. The plugin system is designed to be modular and easy to extend.

## Overview

A widget plugin consists of two main parts:
1. **The React Component**: The actual UI of the widget.
2. **The Definition**: Metadata that tells the system about the widget (name, default size, etc.).

All plugins are located in `frontend/src/plugins`.

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

## Creating a New Plugin

Follow these steps to create a new widget.

### 1. Create the Plugin File

Create a new file in `frontend/src/plugins/`, for example `MyNew.tsx`.

```typescript
import React, { useCallback } from 'react';
import type { WidgetDefinition, WidgetProps } from '../services/widgetRegistry';

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
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 }
};
```

### 2. Register the Plugin

Open `frontend/src/widget-setup.ts` and register your new widget.

```typescript
import { WidgetRegistry } from './services/widgetRegistry';
// ... other imports
import { MyNewDefinition } from './plugins/MyNew';

// ... existing registrations
WidgetRegistry.register(MyNewDefinition);
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

Plugins can define lifecycle hooks to run custom logic when a widget is created or deleted.

### onCreate

Called **after** the widget is successfully created in the database. If this function throws an error, the widget will be automatically rolled back (deleted).

```typescript
onCreate: async (ctx) => {
    console.log(`Widget ${ctx.widgetId} created`);
    // Initialize external resources, setup subscriptions, etc.
    // Throw an error to cancel widget creation
}
```

### onDelete

Called **after** the widget is successfully deleted from the database. Errors in this function are logged but do not affect the deletion.

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
- The widget container handles the border and background, so your component should fill the available space (height: 100%).
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