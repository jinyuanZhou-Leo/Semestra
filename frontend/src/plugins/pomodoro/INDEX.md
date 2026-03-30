<!-- ⚠️ Once this folder changes, update me. -->

Pomodoro plugin delivers a compact dashboard timer widget with focus/break transitions and resilient countdown state.
`plugin.json` and `plugin.ts` now provide the eager descriptor-backed entry while `index.ts` lazily registers runtime definitions.
`widget.tsx` owns timer behavior, settings form fields, mode chip and completion summary, compact controls, and reset-to-initial-focus action wiring.

| File | Role | Description |
|------|------|-------------|
| INDEX.md | Architecture index | Local map for pomodoro plugin files and responsibilities. |
| plugin.json | Plugin manifest | Static public manifest for plugin identity plus widget metadata shared with the backend. |
| plugin.ts | Plugin entry | Binds the descriptor to lazy runtime loading through the frontend plugin SDK. |
| index.ts | Runtime entry | Default-exports `definePluginRuntime(...)` so the plugin-system can lazy-register the widget runtime. |
| widget.tsx | Widget runtime | Pomodoro widget UI, timer state transitions, mode chip above countdown, clear completed-session summary, compact actions, settings component, and reset-to-initial-focus behavior. |
| widget.test.tsx | Test suite | Unit tests for timer transitions plus both header and widget reset actions returning to the initial focus baseline. |
