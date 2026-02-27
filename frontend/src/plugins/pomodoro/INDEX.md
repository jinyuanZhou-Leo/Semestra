<!-- ⚠️ Once this folder changes, update me. -->

Pomodoro plugin delivers a compact dashboard timer widget with focus/break transitions and resilient countdown state.
`metadata.ts` exposes eager catalog metadata while `index.ts` lazily registers runtime definitions.
`widget.tsx` owns timer behavior, settings form fields, mode chip and completion summary, compact controls, and reset-to-initial-focus action wiring.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for pomodoro plugin files and responsibilities. |
| metadata.ts | Plugin metadata | Declares plugin id and widget catalog item for add-widget panel (name, icon, layout, etc.). |
| index.ts | Runtime entry | Exports `widgetDefinition` and metadata exports for plugin-system loading. |
| widget.tsx | Widget runtime | Pomodoro widget UI, timer state transitions, mode chip above countdown, clear completed-session summary, compact actions, settings component, and reset-to-initial-focus behavior. |
| widget.test.tsx | Test suite | Unit tests for timer transitions plus both header and widget reset actions returning to the initial focus baseline. |
