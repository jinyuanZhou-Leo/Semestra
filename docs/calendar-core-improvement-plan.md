# calendar-core 改进修复方案

> 分析日期：2026-04-11  
> 涉及路径：`frontend/src/calendar-core/`、`frontend/src/plugins/builtin-event-core/`

---

## 问题总览

| # | 问题 | 严重度 | 类型 |
|---|------|--------|------|
| P1 | `calendar-core` 错误地放置在宿主层 | 高 | 架构 |
| P2 | `registerBuiltinCalendarSources` 丢弃 deregister 函数 | 高 | 内存泄漏 |
| P3 | `TimetableEventBus.recentPublishes` 永不清理 | 中 | 内存泄漏 |
| P4 | `publishTimetableScheduleChange` 异步解析与 `skipNextRefreshRef` 的竞态 | 中 | 逻辑缺陷 |
| P5 | `CalendarRefreshSignal.reason` 过度耦合 timetable 域 | 中 | 架构 |
| P6 | 每个 eventBus subscriber 手动重复 semesterId 过滤 | 低 | 代码质量 |

---

## P1 — `calendar-core` 错误地放置在宿主层

### 现状

```
frontend/src/
├── plugin-sdk/        ← 插件作者 API
├── plugin-system/     ← 宿主插件基础设施
├── services/          ← 宿主业务服务
├── calendar-core/     ← ⚠️ Calendar 插件专用逻辑，却放在了宿主层
└── plugins/
    └── builtin-event-core/   ← Calendar 插件
```

`calendar-core` 的所有消费方（21 处 import）**全部来自 `builtin-event-core` 插件内部**，没有任何宿主层代码依赖它。但它当前与 `plugin-sdk`、`plugin-system`、`services` 并列，属于宿主级模块。

### 问题

1. 宿主需要感知 `CalendarSourceDefinition`、`CalendarRefreshSignal` 等 Calendar 专属契约，造成不必要的宿主耦合
2. 若未来移除或替换 Calendar 插件，`calendar-core` 会成为宿主层的孤立代码
3. 其他插件按此逻辑也可以把自己的扩展 API 放到宿主层，破坏插件边界一致性
4. 与 `plugin-sdk/INDEX.md` 所描述的插件架构意图相悖

### 修复方案

将 `calendar-core` 整体迁移到 `builtin-event-core` 插件内部：

```
frontend/src/plugins/builtin-event-core/
├── calendar-core/          ← 从 src/calendar-core/ 移入
│   ├── index.ts
│   ├── types.ts
│   ├── registry.ts
│   └── registry.test.ts
├── shared/
├── tabs/
└── ...
```

**迁移步骤：**

1. 将 `src/calendar-core/` 目录移动到 `src/plugins/builtin-event-core/calendar-core/`
2. 全局替换所有 `@/calendar-core` import 为相对路径（均在 `builtin-event-core` 内部，相对路径可直接使用）
3. 删除 `src/calendar-core/` 目录
4. 更新 `src/plugins/builtin-event-core/` 的 `INDEX.md`

**受影响的 import 路径（全部在 `builtin-event-core` 内部）：**

```
tabs/calendar/CalendarTab.tsx
tabs/calendar/CalendarTab.test.tsx
tabs/calendar/CalendarSettingsSection.tsx
tabs/calendar/EventEditor.tsx
tabs/calendar/settings.ts
tabs/calendar/components/CalendarSourceSettingsList.tsx
tabs/calendar/components/EventColorPicker.tsx
tabs/calendar/hooks/useCalendarEventEditing.ts
tabs/calendar/hooks/useCalendarNavigationState.ts
tabs/calendar/hooks/useCalendarSources.ts
tabs/calendar/hooks/useCalendarSources.test.tsx
tabs/calendar/hooks/useSemesterCalendarContext.ts
tabs/calendar/sources/gradebookSource.ts
tabs/calendar/sources/lmsSource.ts
tabs/calendar/sources/registerBuiltinCalendarSources.ts
tabs/calendar/sources/scheduleSource.ts
tabs/calendar/sources/todoSource.ts
tabs/todo/utils/todoCalendarSync.ts
tabs/todo/utils/todoCalendarSync.test.ts
shared/types.ts
shared/utils.ts
```

这些文件的 `@/calendar-core` import 只需改为类似 `../../calendar-core`（相对路径因文件位置而异）。

---

## P2 — `registerBuiltinCalendarSources` 丢弃 deregister 函数

### 现状

```typescript
// registerBuiltinCalendarSources.ts
let hasRegisteredBuiltinCalendarSources = false;

export const ensureBuiltinCalendarSourcesRegistered = () => {
  if (hasRegisteredBuiltinCalendarSources) return;
  registerCalendarSources(BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE, [...]);
  hasRegisteredBuiltinCalendarSources = true;
  // ← registerCalendarSources 返回的 deregister 函数被丢弃
};
```

### 问题

1. **内存泄漏**：插件卸载时 sources 永远留在 registry 里，引用无法被 GC
2. **HMR 失效**：模块级 boolean 在热重载时不重置，插件重新加载后 sources 不会重新注册
3. **无法测试插件卸载**：测试无法验证插件的完整生命周期

### 修复方案

```typescript
// registerBuiltinCalendarSources.ts
let deregister: (() => void) | null = null;

export const ensureBuiltinCalendarSourcesRegistered = () => {
  if (deregister) return;
  deregister = registerCalendarSources(BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE, [
    builtinScheduleCalendarSource,
    builtinTodoCalendarSource,
    builtinGradebookCalendarSource,
    builtinLmsCalendarSource,
  ]);
};

export const deregisterBuiltinCalendarSources = () => {
  deregister?.();
  deregister = null;
};
```

然后在 `builtin-event-core/index.ts`（plugin runtime）的 teardown / cleanup 中调用 `deregisterBuiltinCalendarSources()`：

```typescript
// index.ts (plugin runtime)
// 伪代码，根据插件 runtime 实际 teardown 机制调整
export const runtime = definePluginRuntime({
  onMount: () => {
    ensureBuiltinCalendarSourcesRegistered();
  },
  onUnmount: () => {
    deregisterBuiltinCalendarSources();
  },
});
```

---

## P3 — `TimetableEventBus.recentPublishes` 永不清理

### 现状

```typescript
// eventBus.ts
private recentPublishes = new Map<string, number>();

publish<T extends TimetableEventType>(...) {
  const dedupeToken = `${type}:${dedupeKey}`;  // key = "timetable:schedule-data-changed:{...}"
  this.recentPublishes.set(dedupeToken, now);   // ← 写入，但从未删除
}

clear() {
  this.recentPublishes.clear();  // ← 存在但从未被调用
}
```

去重窗口只有 180ms，但 entries 永远留在 Map 里。对于长时间运行的应用，Map 会无限增长。

### 修复方案

在 `publish` 时顺带清理已过期的 entries：

```typescript
publish<T extends TimetableEventType>(
  type: T,
  payload: TimetableEventPayloadMap[T],
  options?: PublishEventOptions,
) {
  const dedupeWindowMs = options?.dedupeWindowMs ?? EVENT_BUS_DEFAULT_DEDUPE_WINDOW_MS;
  const dedupeKey = options?.dedupeKey ?? JSON.stringify(payload);
  const dedupeToken = `${type}:${dedupeKey}`;
  const now = Date.now();

  // 清理过期 entries（在访问 Map 时顺带清理，无额外开销）
  for (const [key, publishedAt] of this.recentPublishes) {
    if (now - publishedAt > dedupeWindowMs) {
      this.recentPublishes.delete(key);
    }
  }

  const previousPublishedAt = this.recentPublishes.get(dedupeToken);
  if (typeof previousPublishedAt === 'number' && (now - previousPublishedAt) < dedupeWindowMs) {
    return;
  }
  // ... 其余逻辑不变
}
```

---

## P4 — `publishTimetableScheduleChange` 异步/同步不一致引发的竞态

### 现状

CalendarTab 在保存事件后的调用链：

```typescript
// CalendarTab.tsx (onSaveSuccess)
skipNextRefreshRef.current = signal;          // ① 立即设置 skip 标记
await publishTimetableScheduleChange({        // ② async：内部可能调用 api.getCourse()
  source: 'course',                           //    API 返回后才 publish 到 eventBus
  reason: 'event-updated',
  semesterId,                                 //    但此处 semesterId 已知
});
await reloadMatchingSources(signal);          // ③ 立即开始本地 reload
```

```typescript
// publishTimetableScheduleChange.ts
export const publishTimetableScheduleChange = async (...) => {
  const resolvedSemesterId = await resolveSemesterId(...); // 可能触发 API
  timetableEventBus.publish(...);  // eventBus publish 在 API 返回后，可能比 ③ 晚几百 ms
};
```

`CalendarTab.tsx:174` 使用 `void publishTimetableScheduleChange()` 而非 `await`，这意味着 ③ 先于 eventBus publish 完成。`skipNextRefreshRef` 的作用是防止 eventBus 事件触发二次刷新，但设置时机（①）和清理时机之间存在窗口，若另一个事件插入则判断错误。

### 修复方案

调用方已知 `semesterId` 时（绝大多数情况），无需异步解析，直接同步 publish：

```typescript
// publishTimetableScheduleChange.ts — 同步优先，仅在真正需要时异步
export const publishTimetableScheduleChange = (
  params: PublishTimetableScheduleChangeParams,
): void => {
  if (params.semesterId) {
    // semesterId 已知 → 同步 publish，消除竞态窗口
    timetableEventBus.publish('timetable:schedule-data-changed', {
      source: params.source,
      reason: params.reason,
      courseId: params.courseId,
      semesterId: params.semesterId,
    });
    return;
  }

  // semesterId 未知 → 异步解析后 publish（降级路径）
  if (params.source !== 'course' || !params.courseId) return;
  void api.getCourse(params.courseId).then((course) => {
    const resolvedSemesterId = course.semester_id ?? undefined;
    if (!resolvedSemesterId) return;
    timetableEventBus.publish('timetable:schedule-data-changed', {
      source: params.source,
      reason: params.reason,
      courseId: params.courseId,
      semesterId: resolvedSemesterId,
    });
  }).catch(() => { /* 解析失败时静默，不影响本地已完成的 reload */ });
};
```

CalendarTab 调用处同时改为同步调用（移除 `void` / `await`）：

```typescript
// CalendarTab.tsx (onSaveSuccess)
skipNextRefreshRef.current = signal;
publishTimetableScheduleChange({ source: 'course', reason: 'event-updated', courseId, semesterId });
await reloadMatchingSources(signal);
```

---

## P5 — `CalendarRefreshSignal.reason` 过度耦合 timetable 域

### 现状

```typescript
// calendar-core/types.ts
type CalendarRefreshSignal =
  | { type: 'manual' }
  | {
    type: 'timetable';
    source: 'course' | 'semester';
    reason:
      | 'course-updated'
      | 'event-type-created'
      | 'event-type-updated'
      | 'event-type-deleted'
      | 'section-created'
      | 'section-updated'
      | 'section-deleted'
      | 'event-updated'
      | 'events-updated'
      | 'gradebook-assessments-updated';  // ← gradebook 概念也进了 calendar-core
  };
```

`scheduleSource.ts` 的 `shouldRefresh` 需要硬编码这些字面量（lines 88-98）。一旦 timetable 服务新增业务事件，需要同时修改 `calendar-core/types.ts` 和所有相关 source。这个问题在 P1 解决后（迁移入插件内部）影响面会显著降低，但类型设计仍可优化。

### 修复方案（配合 P1 一并执行）

迁移进插件内部后，将 `reason` 改为可扩展的 `string` 类型，已知常量维护在插件层：

```typescript
// calendar-core/types.ts（迁移后）
type CalendarRefreshSignal =
  | { type: 'manual' }
  | {
    type: 'timetable';
    source: 'course' | 'semester';
    reason: string;        // 开放扩展，不再封闭枚举
    courseId?: string;
    semesterId?: string;
  };
```

```typescript
// shared/constants.ts（插件层维护具体 reason 常量）
export const TIMETABLE_REFRESH_REASONS = {
  COURSE_UPDATED: 'course-updated',
  EVENT_UPDATED: 'event-updated',
  EVENTS_UPDATED: 'events-updated',
  SECTION_CREATED: 'section-created',
  // ...
} as const;
```

`shouldRefresh` 改为引用常量而非字符串字面量，新增 reason 时只需更新常量文件。

---

## P6 — 每个 eventBus subscriber 手动重复 semesterId 过滤

### 现状

```typescript
// CalendarTab.tsx:281-283
useEventBus('timetable:schedule-data-changed', (payload) => {
  if (!semesterId) return;
  if (!payload.semesterId || payload.semesterId !== semesterId) return; // 手动过滤
  ...
});

// widget.tsx — 同样的过滤代码
// TodoTab.tsx — 同样的过滤代码
```

semesterId 过滤逻辑在 3 处重复，且放置不当（应由 bus API 层处理，不应由消费方各自实现）。

### 修复方案

在 eventBus 的 React hook 层提供 scoped 变体：

```typescript
// eventBus.ts — 新增 scoped hook
export const useScopedEventBus = <T extends TimetableEventType>(
  type: T,
  semesterId: string | undefined,
  handler: (payload: TimetableEventPayloadMap[T]) => void,
) => {
  useEventBus(type, (payload) => {
    if (!semesterId) return;
    if ('semesterId' in payload && payload.semesterId !== semesterId) return;
    handler(payload);
  });
};
```

消费方简化为：

```typescript
// CalendarTab.tsx
useScopedEventBus('timetable:schedule-data-changed', semesterId, (payload) => {
  const signal = toRefreshSignal(payload);
  // ... 不再需要手动 scope 检查
});
```

---

## 执行顺序建议

```
P2（deregister 修复）   → 最低风险，独立改动，立即修复实质 bug
P3（内存泄漏修复）      → 改动仅限 eventBus.ts 一个文件
P4（异步竞态修复）      → 改动 publishTimetableScheduleChange.ts + CalendarTab.tsx 调用处
P6（scoped hook）       → 改动 eventBus.ts + 3 处消费方，可与 P3/P4 一起处理
P1（calendar-core 迁移）→ 影响面最大（21 处 import），建议单独 PR，纯路径变更
P5（reason 类型开放）   → 配合 P1 同步执行，改动量小但需谨慎测试 shouldRefresh 逻辑
```

P1 是架构层面最重要的改动，但纯属机械迁移（只改 import 路径，不改任何逻辑），可以安全地通过全局替换完成。
