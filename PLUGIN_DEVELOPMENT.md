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

Create a new file in `frontend/src/plugins/`, for example `MyNewWidget.tsx`.

```typescript
import React from 'react';
import type { WidgetDefinition, WidgetProps } from '../services/widgetRegistry';
import api from '../services/api';

export const MyNewWidget: React.FC<WidgetProps> = ({ widgetId, settings }) => {
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
export const MyNewWidgetDefinition: WidgetDefinition = {
    type: 'my-new-widget',
    name: 'My New Widget',
    description: 'A description of what this widget does.',
    icon: '✨',
    component: MyNewWidget,
    defaultSettings: { title: 'Default Title' },
    defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 }
};
```

### 2. Register the Plugin

Open `frontend/src/widget-setup.ts` and register your new widget.

```typescript
import { WidgetRegistry } from './services/widgetRegistry';
// ... other imports
import { MyNewWidgetDefinition } from './plugins/MyNewWidget';

// ... existing registrations
WidgetRegistry.register(MyNewWidgetDefinition);
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

See `frontend/src/plugins/WorldClockWidget.tsx` for a distinct example of a functional widget.
