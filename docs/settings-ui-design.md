# Settings UI/UX Design Guidelines

To maintain visual consistency and reduce interaction hierarchy across Semestra, all settings pages (e.g., Global Settings, Semester/Course Settings Tabs, Plugin Settings) must follow these unified design guidelines.

## 1. Core Principles
- **Visual Consistency:** All settings pages must look the same. We use a flat list of `SettingsSection` components within a standard container.
- **Reduced Hierarchy:** Avoid over-nesting. Do not wrap `SettingsSection` in other decorative cards or panels (e.g., do not use extra Card wrappers). Avoid deep nesting of settings modals inside settings panels.
- **Clear Interaction:** Each setting option should be intuitive, with clear labels, helpful descriptions, and immediate feedback (e.g., using `SaveSettingButton` with animated states).
- **Low Noise UI:** Avoid non-actionable helper banners and repetitive hints. Keep only labels and guidance that changes user behavior.

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
The fundamental building block for any group of settings is the `SettingsSection` component. It automatically provides a two-column split layout on large screens, standard padding, borders, and a well-formatted header section.

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
      {/* Configuration items go here */}
  </SettingsSection>
);
```

### Avoid Redundant Headings
- Do **not** use separate standalone text headers outside of the `SettingsSection` to group settings. The `SettingsSection` header is sufficient.
- Do **not** wrap a `SettingsSection` inside another card. This creates visual clutter, double titles, and duplicate borders.

## 4. Common Setting Types

To ensure visual consistency across all forms of settings (inputs, switches, tables, etc.), follow these unified UI patterns for interactive elements inside the `SettingsSection`.

### A. Switch / Toggle (Boolean Settings)
Used for simple on/off configurations. 
- **Layout:** Wrap in a `flex items-center justify-between rounded-md border p-3 (or p-4 shadow-sm)`.
- **Content:** The label and description sit on the left, while the `<Switch>` sits directly on the right.

```tsx
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-md border p-3">
    <div className="space-y-0.5">
        <Label htmlFor="feature-toggle" className="cursor-pointer text-base">Enable Feature</Label>
        <p className="text-sm text-muted-foreground">Detailed explanation of the feature.</p>
    </div>
    <Switch id="feature-toggle" />
</div>
```

### B. ToggleGroup / Radio / Select (Single or Multi-choice)
Used for selecting one among a few options (e.g., Theme: Light/Dark/System).
- **Layout:** Similar to Switch, wrapped in a bordered generic row. Buttons placed consecutively.
- **Actions:** Place a group of `<Button>` or `<ToggleGroup>` elements. 

```tsx
<div className="flex items-center justify-between gap-4 rounded-lg border p-4 shadow-sm">
    <Label htmlFor="theme-select" className="text-base">Theme</Label>
    <div className="flex items-center gap-2">
        <Button variant="default" size="sm" className="min-w-[80px]">Light</Button>
        <Button variant="outline" size="sm" className="min-w-[80px]">Dark</Button>
    </div>
</div>
```

### C. Forms & Text Inputs
Used for text/number/date settings. Unlike switches, inputs usually require vertical stacking to accommodate ample typing space.
- **Spacing:** Use `<div className="grid gap-3 max-w-sm">` to group the label and input.
- **Labels:** Left-aligned above the input. Keep maximum width constraints so the input doesn't stretch awkwardly across the screen.

```tsx
<div className="grid gap-3 max-w-sm pt-2">
    <Label htmlFor="default-credit">Default Course Credit</Label>
    <Input
        id="default-credit"
        type="number"
        className="max-w-[120px]"
    />
</div>
```

### D. Account & Profile Info
For user profiles or linked accounts with heavy visual elements.
- Present avatars on the left, profile names directly beside it. Don't frame basic info in a border. Reserved borders for integration actions like "Linked Accounts."

```tsx
<div className="flex items-center gap-4">
    <Avatar className="h-16 w-16 border">
        <AvatarFallback>U</AvatarFallback>
    </Avatar>
    <div>
        <p className="text-lg font-semibold leading-none">Username</p>
        <p className="text-sm text-muted-foreground mt-1">user@example.com</p>
    </div>
</div>
```

### E. Complex Content & Tables
For interactive data grids, GPAScalingTables, or nested lists.
- Do **not** wrap the table component in an extra outer bordered card, since tables usually have their own outline.
- Let the table comfortably fit inside the natural background of the `SettingsSection`. 

```tsx
<div className="grid gap-4">
    <Label className="text-base">Table Name</Label>
    <MyTableComponent />
    <p className="text-xs text-muted-foreground">Description of what this table does.</p>
</div>
```

### F. Action Buttons & Modals
Used for specific tasks like Exporting Data, Deleting items, or popping up complex imports. 
- **Layout:** If the action stands completely alone (e.g., "Export Data"), place it inside a simple bordered card and map the button full-width at the bottom.
- **Popups:** Always use inline `Dialog` or `AlertDialog` over navigating users completely away from the settings tab to preserve their flow.

```tsx
<div className="flex flex-col justify-between rounded-lg border p-4 shadow-sm">
    <div className="space-y-2 mb-4">
        <p className="font-medium">Export Data</p>
        <p className="text-sm text-muted-foreground">Download a backup file containing your programs.</p>
    </div>
    <Button variant="outline" className="w-full">
        Download Backup
    </Button>
</div>
```

## 5. Saving and Feedback
- Use `SaveSettingButton` for primary save actions. It provides built-in idle/saving/success states. Don't use standard buttons to save settings unless doing one-off data edits.
- If a plugin supports it, changes can auto-save, but always ensure an alert or visual indicator handles network failures.
- For destructive actions (like resetting defaults or deleting), use a `"destructive"` variant button, placed carefully at the bottom or behind an `AlertDialog` for confirmation.

## 6. Wrapping and Layout Stability (Required)
When designing plugin settings, enforce these rules to prevent layout jitter and visual noise:

- **No extra wrappers:** Do not add decorative bordered containers around single form controls unless they are true standalone action cards.
- **No redundant tips:** Remove informational blocks that repeat what a label already says. Keep only actionable, contextual guidance.
- **Stable structure:** For mode switches (e.g., Preset vs Custom), avoid mounting/unmounting whole sections that change page height.
- **Prefer behavior switch over structure switch:** Keep the same fields visible and switch interaction state (`readOnly`, `disabled`, value source) instead of swapping layouts.
- **Avoid jumpy helper regions:** Do not add conditional hint banners that appear/disappear and push content up/down.

### Stability Pattern Example
```tsx
<div className="grid gap-4">
  <div className="grid max-w-sm gap-2">
    <Label htmlFor="mode">Mode</Label>
    <Select id="mode" />
  </div>

  <div className="grid max-w-2xl gap-2">
    <Label htmlFor="url">URL</Label>
    <Input id="url" readOnly={!isCustom} value={isCustom ? customUrl : presetUrl} />
  </div>
</div>
```
