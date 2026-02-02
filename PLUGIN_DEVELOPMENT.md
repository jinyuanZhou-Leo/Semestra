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
If you export `widgetDefinition` and/or `tabDefinition`, the framework registers them asynchronously.

**Lazy Loading**: Plugins are loaded asynchronously in the background. The UI renders immediately without waiting for plugins to load. When plugins finish loading, components automatically re-render to show the newly available widgets/tabs.

**Reactive Hooks**: Use `useWidgetRegistry()` and `useTabRegistry()` hooks to subscribe to registry changes:

```typescript
import { useWidgetRegistry } from '../services/widgetRegistry';
import { useTabRegistry } from '../services/tabRegistry';

// These hooks return the current list of registered widgets/tabs
// and automatically re-render when new plugins are registered
const widgets = useWidgetRegistry();
const tabs = useTabRegistry();
```

## Structure

### WidgetDefinition

Every plugin must export a `WidgetDefinition` object:

```typescript
export interface WidgetDefinition {
    type: string;          // Unique identifier for the widget type
    name: string;          // Display name
    description?: string;  // Optional description
    icon?: React.ReactNode; // Emoji, React node, or image URL (imported from plugin folder)
    component: React.FC<WidgetProps>; // The React component
    defaultSettings?: any; // Default values for settings
    layout?: { 
        w: number,         // Default width (grid units)
        h: number,         // Default height (grid units)
        minW?: number,     // Minimum width
        minH?: number,     // Minimum height
        maxW?: number,     // Maximum width
        maxH?: number      // Maximum height
    };
    maxInstances?: number | 'unlimited'; // Max instances per dashboard
    allowedContexts?: Array<'semester' | 'course'>; // Where this widget can be added
    headerButtons?: HeaderButton[]; // Optional custom action buttons in widget header
    SettingsComponent?: React.FC<WidgetSettingsProps>; // Optional per-instance settings modal
    globalSettingsComponent?: React.FC<WidgetGlobalSettingsProps>; // Optional plugin-level settings
    // Lifecycle hooks
    onCreate?: (ctx: WidgetLifecycleContext) => Promise<void> | void;
    onDelete?: (ctx: WidgetLifecycleContext) => Promise<void> | void;
}

export interface HeaderButton {
    id: string;            // Unique identifier for this button
    icon: React.ReactNode; // Icon to display (emoji, SVG, etc.)
    title: string;         // Tooltip text
    onClick: (context: HeaderButtonContext) => void; // Click handler with widget context
}

export interface HeaderButtonContext {
    widgetId: string;      // The unique ID of this widget instance
    settings: any;         // Current widget settings
    semesterId?: string;   // Semester context (if applicable)
    courseId?: string;     // Course context (if applicable)
    updateSettings: (newSettings: any) => void; // Update widget settings
}

export interface WidgetLifecycleContext {
    widgetId: string;      // The ID of the widget instance
    semesterId?: string;   // Semester context (if applicable)
    courseId?: string;     // Course context (if applicable)
    settings: any;         // Widget settings at the time of the event
}

// Per-instance settings (shown in modal when clicking gear icon on widget)
export interface WidgetSettingsProps {
    settings: any;
    onSave: (newSettings: any) => void;
    onClose: () => void;
}

// Plugin-level global settings (shown in Settings tab)
export interface WidgetGlobalSettingsProps {
    semesterId?: string;   // Semester context (if applicable)
    courseId?: string;     // Course context (if applicable)
    onRefresh: () => void; // Call to refresh parent data after mutations
}
```

**Header Buttons**: Widgets can define custom action buttons that appear in the widget header (alongside drag handle, edit, and remove buttons). These buttons only appear when the widget controls are visible (on hover for desktop, on tap for touch devices).

**Example - Reset Button**:
```typescript
export const MyWidgetDefinition: WidgetDefinition = {
    type: 'my-widget',
    name: 'My Widget',
    component: MyWidget,
    headerButtons: [
        {
            id: 'reset',
            icon: '↺',
            title: 'Reset to default',
            onClick: ({ settings, updateSettings }) => {
                updateSettings({ ...settings, value: 0 });
            }
        }
    ]
};
```

**Icon rendering:** Icons are displayed inside a circular badge in the UI. If `icon` is omitted, a placeholder badge with the first letter of the plugin name is shown. For image icons, place the asset in the plugin folder and import it (Vite will provide a URL string).

### Plugin-Level Global Settings

Widgets can provide a `globalSettingsComponent` that is rendered in the Settings tab. Unlike `SettingsComponent` (which is per-instance and shown in a modal), `globalSettingsComponent` is shown once in the Settings tab regardless of how many widget instances exist. This is useful for:

- Plugin-wide configuration that applies to all instances
- Management functions (e.g., adding/removing items)
- Settings that don't belong to any specific widget instance

**Example - Course List Plugin with Global Settings**:
```typescript
import type { WidgetGlobalSettingsProps } from '../../services/widgetRegistry';

const CourseListGlobalSettings: React.FC<WidgetGlobalSettingsProps> = ({ 
    semesterId, 
    onRefresh 
}) => {
    // Fetch semester data, manage courses, etc.
    return (
        <SettingsSection title="Courses" description="Manage courses">
            {/* Course management UI */}
        </SettingsSection>
    );
};

export const CourseListDefinition: WidgetDefinition = {
    type: 'course-list',
    name: 'Course List',
    component: CourseList,
    allowedContexts: ['semester'],
    globalSettingsComponent: CourseListGlobalSettings  // Shown in Settings tab
};
```

**Note**: The `globalSettingsComponent` is only shown for widgets whose `allowedContexts` includes the current page context (semester or course).


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
    updateCourse?: (updates: any) => void; // Update course data (if applicable)
}
```

### TabDefinition

```typescript
export interface TabDefinition {
    type: string;          // Unique identifier for the tab type
    name: string;          // Display name (used as tab title)
    description?: string;  // Optional description
    icon?: React.ReactNode; // Emoji, React node, or image URL (imported from plugin folder)
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
    title?: string;         // Tab title (provided by framework)
    pluginName?: string;    // Plugin name (provided by framework)
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
import myIconUrl from './icon.svg';

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
    icon: myIconUrl,
    component: MyNew,
    defaultSettings: { title: 'Default Title' },
    layout: { w: 3, h: 2, minW: 2, minH: 2 },
    maxInstances: 'unlimited',
    allowedContexts: ['semester', 'course']
};
```

### Tab Example

`frontend/src/plugins/my-new-plugin/tab.tsx`

```typescript
import React, { useCallback } from 'react';
import type { TabDefinition, TabProps } from '../../services/tabRegistry';
import myIconUrl from './icon.svg';

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
    icon: myIconUrl,
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

// If you also have a tab:
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

Both Widget and Tab components are automatically wrapped with `React.memo` at the framework level. The framework uses custom comparison functions that only trigger re-renders when:
- Widget/Tab ID changes
- Widget/Tab type changes
- Settings object changes (deep comparison via JSON.stringify)
- Context (semesterId/courseId) changes

**Important**: Do NOT manually wrap your widget or tab component with `React.memo` - the framework already handles this optimization via `DashboardWidgetWrapper` (for widgets) and `TabRegistry` (for tabs).

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
    layout: { w: 3, h: 2 },
    
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

See `frontend/src/plugins/grade-calculator/widget.tsx` for a complete example demonstrating:
- Using `settings` directly without local state duplication
- Calling `updateSettings` for all changes
- Using `useMemo` for computed values

## Widget UI 设计规范

- WidgetUI中避免在上方添加标题，因为容器已经提供了标题
- Widget应当适配声明的所有尺寸， 使用响应式设计
- Widget应当适配深色模式
- Widget应当高效利用空间，避免过多留白
- Widget中应对必要元素添加 `user-select: none`
- 使用 CSS 变量确保主题一致性：
  - `var(--color-text-primary)` - 主要文本颜色
  - `var(--color-text-secondary)` - 次要文本颜色
  - `var(--color-bg-primary)` - 主要背景色
  - `var(--color-border)` - 边框颜色

## Tab UI 设计规范

- Tab 内容中避免显示标题，Tab 栏已提供名称
- Tab 组件应将主要空间留给内容本身，避免额外占用垂直空间
- Tab 组件需适配深色模式，使用 CSS 变量保持主题一致
- Tab 内容应使用响应式设计

## Plugin Settings UI 设计规范

插件在 Settings 页面中的设置 UI 需要遵循以下规范：

### Settings 页面结构

Settings 页面采用以下层次结构：

```
Settings Page
├── Semester/Course Setting (小标题)
│   └── General (SettingsSection 卡片)
│       └── 基本设置表单
│
├── [Plugin] Plugin Name (胶囊 + 小标题)
│   ├── Global Settings (SettingsSection 卡片)
│   └── Other Category (SettingsSection 卡片, 如有)
│
├── [Plugin] Another Plugin (胶囊 + 小标题)
│   └── Display (SettingsSection 卡片)
...
```

### globalSettingsComponent (Widget 插件全局设置)

`globalSettingsComponent` 在 Settings 页面渲染，用于插件级别的配置。

**设计要求：**
- 必须使用 `SettingsSection` 包装设置内容
- 可以返回多个 `SettingsSection`，每个代表一个设置分类
- 框架已经提供了插件标题（Plugin 胶囊 + 插件名），组件内部不需要重复

**示例：**
```typescript
import { SettingsSection } from '../../components/SettingsSection';

const MyPluginGlobalSettings: React.FC<WidgetGlobalSettingsProps> = ({ 
    semesterId, 
    onRefresh 
}) => {
    return (
        <>
            {/* Global 设置卡片 */}
            <SettingsSection
                title="Courses"
                description="Manage courses assigned to this semester."
            >
                {/* 课程管理 UI */}
            </SettingsSection>
            
            {/* 如果有其他分类，可以添加更多 SettingsSection */}
            <SettingsSection
                title="Import/Export"
                description="Import or export course data."
            >
                {/* 导入导出 UI */}
            </SettingsSection>
        </>
    );
};
```

### settingsComponent (Tab 插件设置)

`settingsComponent` 在 Settings 页面渲染，用于 Tab 实例的配置。

**设计要求：**
- 必须使用 `SettingsSection` 包装设置内容
- 可以返回多个 `SettingsSection`，每个代表一个设置分类
- 框架已经提供了插件标题（Plugin 胶囊 + 插件名），组件内部不需要重复

**示例：**
```typescript
import { SettingsSection } from '../../components/SettingsSection';

const MyTabSettings: React.FC<TabSettingsProps> = ({ settings, updateSettings }) => {
    return (
        <SettingsSection
            title="Display"
            description="Configure how this tab is displayed."
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Input
                    label="Title"
                    value={settings.title}
                    onChange={(e) => updateSettings({ ...settings, title: e.target.value })}
                />
                <Checkbox
                    checked={settings.showHeader}
                    onChange={(checked) => updateSettings({ ...settings, showHeader: checked })}
                    label="Show header"
                />
            </div>
        </SettingsSection>
    );
};
```

### SettingsSection 组件

`SettingsSection` 是一个卡片容器，用于组织设置项：

```typescript
interface SettingsSectionProps {
    title?: string;          // 分类标题（小写大写字母）
    description?: string;    // 分类描述
    children: React.ReactNode;
    headerAction?: React.ReactNode;  // 可选的标题区操作按钮
    center?: boolean;        // 是否垂直居中对齐
}
```

**布局结构：**
- 左侧：标题 + 描述 + 可选操作按钮（固定宽度 220px）
- 右侧：设置内容（弹性宽度）

### 设置 UI 最佳实践

1. **使用 SettingsSection 分组**
   - 每个逻辑分类使用一个 `SettingsSection`
   - 标题使用简洁的分类名称（如 "Display", "Courses", "Import/Export"）
   - 描述简要说明该分类的用途

2. **表单布局**
   - 使用 `display: flex; flex-direction: column; gap: 1rem;` 排列表单项
   - 使用项目提供的 `Input`, `Checkbox`, `Select` 等组件保持一致性

3. **避免冗余**
   - 不要在组件内重复插件名称或标题
   - 框架已经渲染了 "Plugin + 插件名" 的标题

4. **响应式设计**
   - `SettingsSection` 内置响应式布局
   - 在窄屏幕上，左侧标题区和右侧内容区会垂直堆叠

5. **主题兼容**
   - 使用 CSS 变量确保深色/浅色模式兼容
   - 使用项目组件而非原生 HTML 元素
