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
    settings: any;         // The current settings for this widget
    semesterId?: string;   // Context: Semester ID (if applicable)
    courseId?: string;     // Context: Course ID (if applicable)
}
```

## Creating a New Plugin

Follow these steps to create a new widget.

### 1. Create the Plugin File

Create a new file in `frontend/src/plugins/`, for example `MyNew.tsx`.

```typescript
import React from 'react';
import type { WidgetDefinition, WidgetProps } from '../services/widgetRegistry';
import api from '../services/api';

export const MyNew: React.FC<WidgetProps> = ({ widgetId, settings }) => {
    // 1. Access settings
    const title = settings?.title || 'Default Title';

    // 2. Handle updates
    // Call api.updateWidget whenever you need to persist changes
    const updateTitle = async (newTitle: string) => {
        try {
            await api.updateWidget(widgetId, {
                settings: JSON.stringify({ ...settings, title: newTitle })
            });
        } catch (error) {
            console.error("Failed to save", error);
        }
    };

    return (
        <div className="p-4">
            <h3>{title}</h3>
            {/* Widget content here */}
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

### State Persistence
Widgets should persist their state to the backend using `api.updateWidget`.
- **`widgetId`**: Always passed as a prop.
- **`settings`**: Passed as a JSON string from backend, but `WidgetProps` types it as `any` (already parsed by the container usually, but verify implementation if unsure. *Note: In this codebase, the container handles parsing, so `settings` is an object*).
- **`updateWidget`**: Accepts specific fields to update. Usually you want to update `settings`. Note that `settings` in the API payload expects a JSON string, so use `JSON.stringify`.

### Styling
- Use standard CSS or inline styles.
- The widget container handles the border and background, so your component should fill the available space (height: 100%).
- Use CSS variables (e.g., `var(--color-text-primary)`) to respect the theme (light/dark mode).

### Example: World Clock

See `frontend/src/plugins/WorldClock.tsx` for a distinct example of a functional widget.

## UI 设计规范
- 插件UI中避免在上方添加标题，因为容器已经提供了标题
- 插件应当适配声明的所有尺寸
- 插件应当适配深色模式
- 插件应当高效利用空间，避免过多留白
- 插件中应对必要元素添加user-select: none