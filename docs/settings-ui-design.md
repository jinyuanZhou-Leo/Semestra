# Settings UI/UX Design Guidelines

To maintain visual consistency and reduce interaction hierarchy across Semestra, all settings pages (e.g., Global Settings, Semester/Course Settings Tabs, Plugin Settings) must follow these unified design guidelines.

## 1. Core Principles
- **Visual Consistency:** All settings pages must look the same. We use a flat list of `SettingsSection` components within a standard container.
- **Reduced Hierarchy:** Avoid over-nesting. Do not wrap `SettingsSection` in other decorative cards or panels (e.g., do not use extra Card wrappers). 
- **Clear Interaction:** Each setting option should be intuitive, with clear labels, helpful descriptions, and immediate feedback (e.g., using `SaveSettingButton` with animated states).

## 2. Page & Container Layout
Settings pages or tabs should enforce a maximum width to ensure readability.

### Container Rules
- Use a `div` or `<Container>` with appropriate spacing like `space-y-6` for vertical flow.
- Ensure the content is allowed to expand comfortably (e.g. `max-w-4xl`, `max-w-5xl`, or full container width `w-full` for tabs) so it aligns properly with upper navigations on desktop.
- **Example:**
```tsx
<div className="w-full space-y-6 select-none font-sans py-4 pb-12">
    {/* Settings Sections go here */}
</div>
```

## 3. The `SettingsSection` Component
The fundamental building block for any group of settings is the `SettingsSection` component. It automatically provides standard padding, borders, and a well-formatted header section.

### Usage
- Every logical group of settings should be wrapped in a `<SettingsSection>`.
- Provide a clear `title` and an optional `description`.
- **Example:**
```tsx
import { SettingsSection } from '@/components/SettingsSection';

export const MyPluginSettings = () => (
  <SettingsSection 
      title="Plugin Settings" 
      description="Customize the behavior of this plugin."
  >
      {/* Forms, inputs, toggles */}
  </SettingsSection>
);
```

### Avoid Redundant Headings
- Do **not** use separate standalone text headers outside of the `SettingsSection` to group settings. The `SettingsSection` header is sufficient.
- Do **not** wrap a `SettingsSection` inside another card. This creates visual clutter, double titles, and duplicate borders.

## 4. UI Elements & Reading Distances (The "Tennis Match" Problem)
When screens are extremely wide (e.g. desktop), aligning the outer bounds directly without interior structure creates a UX issue for forms. If a row uses `justify-between` across a 1200px container, the user's eyes must jump forcefully from the label on the far left to the toggle on the far right. Leaving a large blank space on the right is equally awkward.

### The Split Layout Solution
To solve this, Semestra employs a **Two-Column Split Layout** for settings on desktop:
- **Left Column:** Displays the `title` and `description` of the setting group.
- **Right Column:** Contains an elevated `Card` holding all the actual interactive elements and nested fields.

This automatically happens inside `SettingsSection`. You do not need to implement this yourself. 

### Inside the Content Panel
When designing the interactive elements inside `SettingsSection`:
- **Grids over Stretched Flex:** Use `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` for a more compact layout when having multiple related configurations rather than letting a single configuration take an entire row.
- **Contained Row Layouts:** For toggle switches or single-line config items, they safely expand inside the component's card.
```tsx
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-md border p-3">
    <div className="space-y-0.5">
        <Label htmlFor="feature-toggle" className="cursor-pointer">Enable Feature</Label>
        <p className="text-xs text-muted-foreground">Detailed explanation of the feature.</p>
    </div>
    <Switch id="feature-toggle" />
</div>
```

## 5. Saving and Feedback
- Use `SaveSettingButton` for primary save actions. It provides built-in idle/saving/success states.
- If a plugin supports it, changes can auto-save, but always ensure an alert or visual indicator handles network failures.
- For destructive actions (like resetting defaults or deleting), use a `"destructive"` variant button, placed carefully at the bottom or separate Actions section, typically requested behind an `AlertDialog` for confirmation.
