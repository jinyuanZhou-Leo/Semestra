<!-- ⚠️ Once this folder changes, update me. -->

Behavior tests for widget container and dashboard grid infrastructure.
Covers square-unit sizing, lower-frequency resize guards, zero-width mount guards, local layout sync rules, commit persistence triggers, and touch-interaction guardrails.
Uses mocked grid/runtime dependencies to isolate widget-shell behavior.

| File | Role | Description |
|------|------|-------------|
| CounterWidget.test.tsx | Test file | Verifies the counter widget runtime component directly, including safe clamping for invalid min/max settings. |
| DashboardGrid.test.tsx | Test file | Validates square unit sizing (`1w = 1h`), metadata-driven layout constraints, resize-throttled width propagation, zero-width mount protection, responsive reflow guards, and drag/resize commit persistence triggers. |
| DashboardWidgetWrapper.test.tsx | Test file | Verifies lazy widget plugins stay on the ring-matched loading shell until runtime registration completes, then fade in loaded content. |
| WidgetContainer.test.tsx | Test file | Validates widget action-control visibility on desktop hover and direct touch edit mode without an ellipsis action trigger. |
