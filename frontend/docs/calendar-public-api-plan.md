# Calendar Public API 设计方案

> 前提：P1–P6 已完成；本方案独立于 R1–R7 重构，可立即实施，重构完成后 API 合约不变

---

## 核心思路

`calendar-core/registry.ts` 已经天然支持多 owner 注册——缺的只是一个**稳定的对外窗口**：

```
现在：外部代码必须手动调用 registerCalendarSources(ownerId, sources)
     并手动管理 ownerId、source.ownerId 一致性，理解内部实现

目标：外部代码只 import api/calendar.ts
     不需要了解 registry 内部，不需要处理 ownerId
```

---

## 文件结构

```
builtin-event-core/
└── api/
    ├── calendar.ts      ← 唯一对外窗口（稳定合约）
    └── index.ts         ← re-export（其他人 import 的入口）
```

**其他所有文件（`calendar-core/`、`shared/`、`tabs/`）保持私有，不应被外部直接 import。**

---

## API Surface

### 类型

```typescript
// api/calendar.ts

import type { CalendarSourceDefinition, CalendarSourceContext, CalendarRefreshSignal } from '../calendar-core';
// 注：CalendarEventData 在 R1 完成后改为 CalendarEventBase，API 合约不变

/** 外部注册时无需填 ownerId，API 内部自动处理 */
export type ExternalCalendarSourceDefinition = Omit<CalendarSourceDefinition, 'ownerId'>;

export type {
  CalendarSourceContext,   // load/shouldRefresh/invalidate 的入参
  CalendarRefreshSignal,   // shouldRefresh 的信号类型
  CalendarEventData,       // load 的返回元素类型（R1 后改为 CalendarEventBase）
  CalendarEventPatch,      // applyEventPatch 的入参
};
```

### 函数

```typescript
/**
 * 模块级注册：在插件/功能初始化时调用。
 * 返回 cleanup 函数，在功能卸载时调用以从日历移除该 source。
 *
 * @example
 * const deregister = registerCalendarSource({
 *   id: 'my-feature:holidays',
 *   label: '公众假期',
 *   defaultColor: '#ef4444',
 *   priority: 30,
 *   load: async (ctx) => fetchHolidays(ctx.semesterId),
 *   shouldRefresh: (signal) => signal.type === 'manual',
 * });
 * // 在功能卸载时：deregister();
 */
export function registerCalendarSource(
  source: ExternalCalendarSourceDefinition,
): () => void;

/**
 * React hook：在组件内注册 source，组件 unmount 时自动 deregister。
 * deps 变化时会重新注册（旧 source deregister，新 source register）。
 *
 * @example
 * function MyFeaturePanel() {
 *   useCalendarSource({
 *     id: 'my-feature:tasks',
 *     label: '自定义任务',
 *     defaultColor: '#8b5cf6',
 *     priority: 25,
 *     load: async (ctx) => buildTaskEvents(ctx, myConfig),
 *     shouldRefresh: (signal) => signal.type === 'manual',
 *   }, [myConfig]);
 * }
 */
export function useCalendarSource(
  source: ExternalCalendarSourceDefinition,
  deps?: React.DependencyList,
): void;
```

---

## 实现

### `api/calendar.ts`

```typescript
import React from 'react';
import { registerCalendarSources } from '../calendar-core';
import type { CalendarSourceDefinition } from '../calendar-core';

export type ExternalCalendarSourceDefinition = Omit<CalendarSourceDefinition, 'ownerId'>;

export type {
  CalendarSourceContext,
  CalendarRefreshSignal,
  CalendarEventData,
  CalendarEventPatch,
} from '../calendar-core';

/**
 * ownerId 用 source.id 本身——每个外部 source 各自拥有自己的 owner 槽位。
 * 这样不同外部 source 互不干扰，deregister 也精确清除自身。
 */
const toInternalSource = (source: ExternalCalendarSourceDefinition): CalendarSourceDefinition => ({
  ...source,
  ownerId: source.id,
});

export const registerCalendarSource = (source: ExternalCalendarSourceDefinition): (() => void) => {
  return registerCalendarSources(source.id, [toInternalSource(source)]);
};

export const useCalendarSource = (
  source: ExternalCalendarSourceDefinition,
  deps: React.DependencyList = [],
): void => {
  React.useEffect(() => {
    return registerCalendarSources(source.id, [toInternalSource(source)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};
```

### `api/index.ts`

```typescript
export {
  registerCalendarSource,
  useCalendarSource,
  type ExternalCalendarSourceDefinition,
  type CalendarSourceContext,
  type CalendarRefreshSignal,
  type CalendarEventData,
  type CalendarEventPatch,
} from './calendar';
```

---

## 消费方使用示例

### 场景一：功能模块级注册（非 React）

```typescript
// some-other-feature/calendarIntegration.ts
import { registerCalendarSource } from '@/plugins/builtin-event-core/api';
import type { ExternalCalendarSourceDefinition, CalendarEventData } from '@/plugins/builtin-event-core/api';

const examSource: ExternalCalendarSourceDefinition = {
  id: 'exams-feature:exam-schedule',
  label: '考试安排',
  defaultColor: '#dc2626',
  priority: 15,

  load: async (ctx): Promise<CalendarEventData[]> => {
    const exams = await fetchExams(ctx.semesterId);
    return exams.map(toCalendarEvent);
  },

  shouldRefresh: (signal) => {
    if (signal.type === 'manual') return true;
    // 使用 TIMETABLE_REFRESH_REASONS 常量（已从 shared/constants 导出）
    return signal.type === 'timetable' && signal.reason === 'course-updated';
  },
};

// 在功能初始化时调用
export const initExamCalendarSource = () => registerCalendarSource(examSource);
```

### 场景二：React 组件动态注册

```typescript
// some-feature/ExamPanel.tsx
import { useCalendarSource } from '@/plugins/builtin-event-core/api';

function ExamPanel({ semesterId }: { semesterId: string }) {
  useCalendarSource({
    id: 'exams-feature:exam-schedule',
    label: '考试安排',
    defaultColor: '#dc2626',
    priority: 15,
    load: async (ctx) => fetchAndBuildExamEvents(ctx),
    shouldRefresh: (signal) => signal.type === 'manual',
  }, [semesterId]);  // semesterId 变化时重新注册

  return <div>...</div>;
}
```

### 场景三：带缓存的 source

```typescript
import { registerCalendarSource } from '@/plugins/builtin-event-core/api';
import type { CalendarSourceContext, CalendarEventData } from '@/plugins/builtin-event-core/api';

let cachedEvents: CalendarEventData[] | null = null;

const deregister = registerCalendarSource({
  id: 'library-booking:slots',
  label: '预约时段',
  defaultColor: '#0891b2',
  priority: 40,

  getCached: () => cachedEvents ?? undefined,

  load: async (ctx: CalendarSourceContext): Promise<CalendarEventData[]> => {
    cachedEvents = await fetchBookingSlots(ctx.semesterId, ctx.queryRange);
    return cachedEvents;
  },

  invalidate: () => { cachedEvents = null; },

  shouldRefresh: (signal) => signal.type === 'manual',
});
```

---

## ownerId 机制说明

外部调用 `registerCalendarSource({ id: 'foo:bar', ... })` 时，内部行为是：

```
registerCalendarSources('foo:bar', [{ ...source, ownerId: 'foo:bar' }])
```

即：**每个外部 source 的 id 同时作为 ownerId**。这样：
- 不同外部 source 各占一个 owner 槽，互不覆盖
- deregister 精确清除对应 owner 的所有数据
- id 全局唯一校验由 registry 内部 `validateSources` 负责（已有）

与内置 source 的区别：内置的 4 个 source 共享同一个 ownerId（`BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE`），因为它们作为一组批量注册/注销。外部 source 通常独立注册，所以用自身 id 作 owner 更合适。

---

## id 命名约定

外部 source 的 `id` 应遵循 `<feature-namespace>:<source-name>` 格式：

```
✓ 'exams-feature:exam-schedule'
✓ 'library-booking:available-slots'
✓ 'faculty-events:seminars'

✗ 'schedule'           ← 太短，易冲突
✗ 'builtin-event-core:custom'  ← 不要使用 builtin- 前缀
```

Registry 已有全局唯一性校验，重复 id 会在注册时 throw Error。

---

## 与 R1–R7 重构的关系

| 重构项 | 对 API 的影响 |
|--------|--------------|
| R1（CalendarEventBase） | `CalendarEventData` 重命名为 `CalendarEventBase`；`api/index.ts` 更新一行 export，消费方代码不变 |
| R2（信号重设计） | `CalendarRefreshSignal` 类型变化；消费方 `shouldRefresh` 需适配新 union（`full/partial` 替代 `timetable`） |
| R3（context 去 semester） | `CalendarSourceContext` 字段重命名；消费方访问 `context.scopeId` 而非 `context.semesterId` |
| R4（服务注入） | 不影响 API 外部调用方，只影响内置 source 内部实现 |
| R5–R7 | 不影响 API |

> **结论**：API 合约在 R2/R3 时有 breaking change，建议 R2/R3 执行时同步更新 `api/calendar.ts` 的导出类型，并在 CHANGELOG 中标注。

---

## 执行步骤

1. 新建 `api/calendar.ts`（约 30 行）
2. 新建 `api/index.ts`（re-export）
3. TypeScript check 验证
4. （可选）在 `builtin-event-core/INDEX.md` 中标注 `api/` 为 public surface
