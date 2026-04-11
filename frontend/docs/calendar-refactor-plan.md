# Calendar 架构重构方案

> 分析日期：2026-04-11  
> 前提：P1–P6 修复已完成（calendar-core 已迁入插件，deregister/内存泄漏/竞态/scoped hook 已修复）

---

## 目标架构

```
builtin-event-core/
├── calendar-core/              ← 零域知识，纯通用日历抽象
│   ├── types.ts                ← CalendarEventBase, CalendarRefreshSignal(generic), CalendarSourceContext, CalendarSourceDefinition
│   ├── registry.ts             ← 不变
│   └── index.ts                ← 不变
│
├── shared/
│   ├── types.ts                ← TimetableCalendarEvent, TimetableSemesterRange（插件域类型）
│   ├── constants.ts            ← TIMETABLE_REFRESH_REASONS（已有）
│   ├── signals.ts              ← 新增：timetableSignal 构建工具
│   ├── eventBus.ts             ← 不变（已优化）
│   └── ...
│
└── tabs/calendar/
    ├── CalendarTab.tsx         ← 使用 TimetableCalendarEvent
    └── sources/                ← 每个 source 返回 TimetableCalendarEvent
```

---

## 问题清单与修复方案

| #  | 问题                                      | 严重度 | 类型     |
|----|-------------------------------------------|--------|----------|
| R1 | `CalendarEventData` 混入学术字段            | 高     | 架构污染 |
| R2 | `CalendarRefreshSignal` 类型名含 domain 词 | 高     | 架构     |
| R3 | `CalendarSourceContext` 保留 semester 字段 | 中     | 架构     |
| R4 | Source 直接 import 宿主服务，不可测         | 中     | 可测性   |
| R5 | `shouldRefresh` OR 链分散在 4 个 source    | 低     | 代码质量 |
| R6 | `skipNextRefreshRef` 基于字段比较，脆弱     | 低     | 可靠性   |
| R7 | LMS source 无 prefetch                    | 低     | 性能     |

---

## R1 — CalendarEventBase 抽取 + TimetableCalendarEvent

### 现状

`calendar-core/types.ts` 作为"通用日历抽象"，但混入了大量学术字段：

```typescript
// 当前——学术字段污染通用接口
export interface CalendarEventData {
  id: string;
  eventId: string;          // ← timetable 专属
  courseId: string;         // ← 学术域
  courseName: string;       // ← 学术域
  eventTypeCode: string;    // ← timetable 概念
  week: number;             // ← 学期周号
  weekPattern?: string;     // ← 排课模式
  isSkipped: boolean;       // ← 排课状态
  isConflict: boolean;      // ← 时间冲突
  conflictGroupId?: string;
  enable: boolean;
  todoState?: { ... };      // ← todo 域
  // + start, end, title, color 等通用字段
}
```

### 修复方案

**Step 1**：`calendar-core/types.ts` 只保留通用字段，删除所有学术字段：

```typescript
// calendar-core/types.ts — 极简通用
export interface CalendarEventBase {
  id: string;
  sourceId: string;
  title: string;
  subtitle?: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
  color?: string;
  note?: string | null;
}

export interface CalendarEventPatch {
  skip?: boolean;
  enable?: boolean;
}
```

**Step 2**：`CalendarSourceDefinition` 使用泛型，允许 source 返回具体子类型：

```typescript
// calendar-core/types.ts
export interface CalendarSourceDefinition<TEvent extends CalendarEventBase = CalendarEventBase> {
  id: string;
  ownerId: string;
  label: string;
  defaultColor: string;
  priority: number;
  getCached?: (context: CalendarSourceContext) => TEvent[] | undefined;
  load: (context: CalendarSourceContext) => Promise<TEvent[]>;
  invalidate?: (signal: CalendarRefreshSignal, context: CalendarSourceContext) => Promise<void> | void;
  shouldRefresh: (signal: CalendarRefreshSignal, context: CalendarSourceContext) => boolean;
  applyEventPatch?: (event: TEvent, patch: CalendarEventPatch, context: CalendarSourceContext) => Promise<void>;
}
```

**Step 3**：学术字段迁移到 `shared/types.ts`，新增 `TimetableCalendarEvent`：

```typescript
// shared/types.ts — 插件域具体类型
import type { CalendarEventBase } from '../calendar-core';

export interface TimetableCalendarEvent extends CalendarEventBase {
  eventId: string;
  courseId: string;
  courseName: string;
  eventTypeCode: string;
  week: number;
  dayOfWeek: number;
  weekPattern?: string | null;
  isRecurring: boolean;
  startTime: string;
  endTime: string;
  isSkipped: boolean;
  isConflict: boolean;
  conflictGroupId?: string | null;
  enable: boolean;
  todoState?: {
    completed: boolean;
    listSource: 'course' | 'semester';
    listId: string;
  };
}
```

**Step 4**：Source 定义改为具体类型，注册时 coerce 到基类（TypeScript 结构兼容）：

```typescript
// scheduleSource.ts
export const builtinScheduleCalendarSource: CalendarSourceDefinition<TimetableCalendarEvent> = {
  load: async (context): Promise<TimetableCalendarEvent[]> => { ... },
  applyEventPatch: async (event: TimetableCalendarEvent, patch) => { ... },
  // ...
};
```

**Step 5**：CalendarTab 使用 `TimetableCalendarEvent`，通过类型断言桥接：

```typescript
// CalendarTab.tsx
import type { TimetableCalendarEvent } from '../../shared/types';

// useCalendarSources 返回 CalendarEventBase[]，在插件层收窄
const { events: baseEvents, ... } = useCalendarSources({ sources, context });
const events = baseEvents as TimetableCalendarEvent[];
```

> **注**：registry 保存 `CalendarSourceDefinition<CalendarEventBase>`（协变兼容），`useCalendarSources` 内部保持泛型 `CalendarEventBase` 不感知 timetable 细节。

### 受影响文件

```
calendar-core/types.ts                               ← 删除学术字段，加泛型参数
shared/types.ts                                      ← 新增 TimetableCalendarEvent
tabs/calendar/CalendarTab.tsx                        ← 改用 TimetableCalendarEvent
tabs/calendar/EventEditor.tsx                        ← 改用 TimetableCalendarEvent
tabs/calendar/FullCalendarView.tsx                   ← 改用 TimetableCalendarEvent
tabs/calendar/hooks/useCalendarEventEditing.ts       ← 改用 TimetableCalendarEvent
tabs/calendar/hooks/useCalendarSources.ts            ← 泛型或 as 断言
tabs/calendar/components/CalendarSourceSettingsList.tsx ← 改用 TimetableCalendarEvent
tabs/calendar/sources/{schedule,todo,gradebook,lms}Source.ts ← 返回 TimetableCalendarEvent
tabs/todo/utils/todoCalendarSync.ts                  ← 改用 TimetableCalendarEvent
```

---

## R2 — CalendarRefreshSignal 重设计

### 现状

信号类型名含域术语，`source` 字段语义模糊：

```typescript
// 当前——domain 术语泄漏进通用抽象
type CalendarRefreshSignal =
  | { type: 'manual' }
  | {
    type: 'timetable';             // ← 不通用
    source: 'course' | 'semester'; // ← 业务语义
    reason: string;
    courseId?: string;
    semesterId?: string;
  };
```

### 修复方案

**calendar-core** 定义纯结构语义（不含任何域词汇）：

```typescript
// calendar-core/types.ts — 通用刷新信号
export type CalendarRefreshSignal =
  | { type: 'manual' }
  | { type: 'full'; scopeId?: string }
  // full：全量刷新，scopeId 为空则刷全部，有值则限定范围（对应原来 source:'semester'）
  | { type: 'partial'; scopeId: string; entityId?: string; tag?: string };
  // partial：局部刷新，entityId 指定具体实体（对应原来 courseId），tag 由插件层定义
```

> 对应关系：
> - `type:'timetable', source:'semester'` → `type:'full', scopeId:semesterId`
> - `type:'timetable', source:'course'` → `type:'partial', scopeId:semesterId, entityId:courseId, tag:reason`
> - `type:'manual'` → `type:'manual'`（不变）

**新增 `shared/signals.ts`**，提供类型安全的信号构建工具：

```typescript
// shared/signals.ts
import type { CalendarRefreshSignal } from '../calendar-core';

export const timetableSignal = {
  courseChanged: (
    semesterId: string,
    courseId: string,
    tag: string,
  ): CalendarRefreshSignal => ({
    type: 'partial',
    scopeId: semesterId,
    entityId: courseId,
    tag,
  }),

  semesterChanged: (semesterId: string): CalendarRefreshSignal => ({
    type: 'full',
    scopeId: semesterId,
  }),

  manual: (): CalendarRefreshSignal => ({ type: 'manual' }),
} as const;
```

**Source `shouldRefresh` 改用 Set 判断**（配合 R5）：

```typescript
// scheduleSource.ts
const SCHEDULE_TAGS = new Set([
  TIMETABLE_REFRESH_REASONS.EVENT_UPDATED,
  TIMETABLE_REFRESH_REASONS.EVENTS_UPDATED,
  TIMETABLE_REFRESH_REASONS.SECTION_CREATED,
  TIMETABLE_REFRESH_REASONS.SECTION_UPDATED,
  TIMETABLE_REFRESH_REASONS.SECTION_DELETED,
  TIMETABLE_REFRESH_REASONS.EVENT_TYPE_CREATED,
  TIMETABLE_REFRESH_REASONS.EVENT_TYPE_UPDATED,
  TIMETABLE_REFRESH_REASONS.EVENT_TYPE_DELETED,
  TIMETABLE_REFRESH_REASONS.COURSE_UPDATED,
]);

shouldRefresh: (signal, context) => {
  if (signal.type === 'manual') return true;
  if (signal.type === 'full') return !signal.scopeId || signal.scopeId === context.semesterId;
  if (signal.type === 'partial') {
    if (signal.scopeId !== context.semesterId) return false;
    return SCHEDULE_TAGS.has(signal.tag ?? '');
  }
  return false;
},
```

**CalendarTab `toRefreshSignal` 改用构建工具**：

```typescript
// CalendarTab.tsx — 不再手写信号对象
const signal = timetableSignal.courseChanged(
  semesterId,
  event.courseId,
  TIMETABLE_REFRESH_REASONS.EVENT_UPDATED,
);
```

**`useCalendarSources.reloadMatchingSources`** 需同步更新 `manual` 判断：

```typescript
const targetSources = signal.type === 'manual'
  ? sources
  : sources.filter((source) => source.shouldRefresh(signal, context));
```

（逻辑不变，只需确保 `'manual'` 匹配新 union 的第一成员）

### 受影响文件

```
calendar-core/types.ts
shared/signals.ts                                    ← 新增
shared/publishTimetableScheduleChange.ts             ← 使用 timetableSignal 构建
tabs/calendar/CalendarTab.tsx                        ← toRefreshSignal → timetableSignal
tabs/calendar/sources/{schedule,todo,gradebook,lms}Source.ts ← shouldRefresh 改 Set
tabs/calendar/hooks/useCalendarSources.ts            ← manual 类型判断（trivial）
```

---

## R3 — CalendarSourceContext 去 semester 化

### 现状

`CalendarSourceContext` 中 `semesterId`、`semesterRange`、`maxWeek` 均含学术术语，且 `SemesterDateRange` 携带 `readingWeekStart/End` 进入通用接口：

```typescript
// calendar-core/types.ts
export interface CalendarSourceContext {
  semesterId: string;           // ← 学术词
  semesterRange: SemesterDateRange;  // ← 含 readingWeek（学术概念）
  maxWeek: number;              // ← 学术词
  queryRange: CalendarQueryRange;
  prefetchQueryRanges?: CalendarQueryRange[];
}
```

### 修复方案

**Step 1**：`calendar-core` 中 `CalendarSourceContext` 使用中性命名：

```typescript
// calendar-core/types.ts
export interface CalendarScopeRange {
  startDate: Date;
  endDate: Date;
}

export interface CalendarSourceContext {
  scopeId: string;                   // was: semesterId
  scopeRange: CalendarScopeRange;    // was: semesterRange（剥离 readingWeek）
  maxPeriod: number;                 // was: maxWeek
  queryRange: CalendarQueryRange;
  prefetchQueryRanges?: CalendarQueryRange[];
}
```

**Step 2**：readingWeek 字段迁移到 `shared/types.ts`：

```typescript
// shared/types.ts — 插件层扩展
export interface TimetableSemesterRange extends CalendarScopeRange {
  readingWeekStart: Date | null;
  readingWeekEnd: Date | null;
}
```

**Step 3**：CalendarTab 构建 context 时使用 `TimetableSemesterRange`，通过 `as` 注入 readingWeek 信息到局部处理逻辑（sources 不感知 readingWeek）：

```typescript
// CalendarTab.tsx
// context 传入 useCalendarSources 时只携带基础 CalendarScopeRange
// readingWeek 过滤仍在 CalendarTab 自己的 calendarEvents memo 里处理
const sourceContext: CalendarSourceContext = {
  scopeId: semesterId,
  scopeRange: {
    startDate: semesterContext.semesterRange.startDate,
    endDate: semesterContext.semesterRange.endDate,
  },
  maxPeriod: semesterContext.maxWeek,
  queryRange: navigation.queryRange,
  prefetchQueryRanges: navigation.prefetchQueryRanges,
};
```

**Step 4**：`isDateInReadingWeek` 只在 CalendarTab 的 `calendarEvents` memo 内调用（已是此模式），依赖 `semesterContext.semesterRange`（`TimetableSemesterRange`），不需要随 CalendarSourceContext 传入。

### 受影响文件

```
calendar-core/types.ts                               ← 字段重命名，SemesterDateRange → CalendarScopeRange
shared/types.ts                                      ← 新增 TimetableSemesterRange
tabs/calendar/hooks/useSemesterCalendarContext.ts    ← 返回 TimetableSemesterRange
tabs/calendar/hooks/useCalendarSources.ts            ← contextIdentityKey 适配新字段名
tabs/calendar/CalendarTab.tsx                        ← 构建 sourceContext 逻辑
tabs/calendar/sources/*.ts                           ← context.semesterRange → context.scopeRange
```

---

## R4 — Source 服务注入（可测性）

### 现状

Source 文件直接 import 宿主服务：

```typescript
// scheduleSource.ts
import scheduleService from '@/services/schedule';    // ← 无法 mock
import { queryClient } from '@/services/queryClient'; // ← 全局单例
import { queryKeys } from '@/services/queryKeys';
```

Source 无法单独进行单元测试（必须 mock `@/services/*` 路径别名）。

### 修复方案

用**工厂函数**将服务依赖变为参数，与 TanStack Query 的 `queryClient` 注入模式对齐：

```typescript
// shared/sourceServices.ts — 服务容器类型
export interface CalendarSourceServices {
  scheduleService: typeof import('@/services/schedule').default;
  queryClient: import('@tanstack/react-query').QueryClient;
  queryKeys: typeof import('@/services/queryKeys').queryKeys;
  api: typeof import('@/services/api').default;
}
```

```typescript
// scheduleSource.ts
import type { CalendarSourceServices } from '../../../shared/sourceServices';

export const createScheduleCalendarSource = (
  services: CalendarSourceServices,
): CalendarSourceDefinition<TimetableCalendarEvent> => ({
  id: BUILTIN_CALENDAR_SOURCE_SCHEDULE,
  // ...
  load: async (context) => {
    const items = await services.queryClient.fetchQuery({ ... });
    return buildCalendarEvents(items, context.scopeRange.startDate);
  },
});
```

```typescript
// registerBuiltinCalendarSources.ts
import { createScheduleCalendarSource } from './scheduleSource';
import scheduleService from '@/services/schedule';
import { queryClient } from '@/services/queryClient';
import { queryKeys } from '@/services/queryKeys';
import api from '@/services/api';

const services = { scheduleService, queryClient, queryKeys, api };

export const ensureBuiltinCalendarSourcesRegistered = () => {
  if (deregister) return;
  deregister = registerCalendarSources(BUILTIN_TIMETABLE_CALENDAR_TAB_TYPE, [
    createScheduleCalendarSource(services),
    createTodoCalendarSource(services),
    createGradebookCalendarSource(services),
    createLmsCalendarSource(services),
  ]);
};
```

**测试变为：**

```typescript
// scheduleSource.test.ts
const mockServices = {
  scheduleService: { getSemesterCalendarSchedule: vi.fn() },
  queryClient: createTestQueryClient(),
  queryKeys,
  api: { getCourse: vi.fn() },
};
const source = createScheduleCalendarSource(mockServices);
const events = await source.load(testContext);
```

---

## R5 — shouldRefresh Set 优化（配合 R2）

详见 R2 中的 Set 示例。核心变化：

```typescript
// 当前——OR 链（scheduleSource.ts:88-99）
signal.reason === 'event-updated'
|| signal.reason === 'events-updated'
|| signal.reason === 'section-created'
// ...（9 个 OR）

// 目标——Set.has，O(1) 查找 + 一行表达意图
SCHEDULE_TAGS.has(signal.tag ?? '')
```

每个 source 维护一个 module-level `const Tags = new Set([...])` 常量，`shouldRefresh` 函数体压缩到 4-6 行。

---

## R6 — skipNextRefreshRef 改用信号 ID

### 现状

CalendarTab 用字段逐一比较来识别"自己刚发出的信号"：

```typescript
if (
  skipSignal.semesterId === signal.semesterId
  && skipSignal.courseId === signal.courseId
  && skipSignal.reason === signal.reason
  && skipSignal.source === signal.source
) { ... }
```

若两次不同操作刚好产生相同字段的信号，会错误地跳过刷新。

### 修复方案

给信号加 `signalId`（nanoid），skip 只比较 ID：

```typescript
// shared/signals.ts
import { nanoid } from 'nanoid';

export const timetableSignal = {
  courseChanged: (semesterId: string, courseId: string, tag: string): CalendarRefreshSignal => ({
    type: 'partial',
    scopeId: semesterId,
    entityId: courseId,
    tag,
    signalId: nanoid(8),   // ← 每次唯一
  }),
  // ...
};
```

```typescript
// calendar-core/types.ts — CalendarRefreshSignal 基类加 signalId
export type CalendarRefreshSignal =
  | { type: 'manual'; signalId?: string }
  | { type: 'full'; scopeId?: string; signalId?: string }
  | { type: 'partial'; scopeId: string; entityId?: string; tag?: string; signalId?: string };
```

```typescript
// CalendarTab.tsx
const skipSignal = skipNextRefreshRef.current;
if (skipSignal?.signalId && skipSignal.signalId === signal.signalId) {
  skipNextRefreshRef.current = null;
  return;
}
```

---

## R7 — LMS Source 添加 Prefetch

### 现状

`scheduleSource` 有完整的 prefetch 逻辑（相邻时间窗口预加载），`lmsSource` 完全没有：

```typescript
// lmsSource.ts — load 函数，无 prefetch
load: async (context) => {
  const response = await queryClient.fetchQuery({ ... });
  return response.items.map(...);
},
```

LMS 事件（来自 LMS 集成）跟 schedule 一样按时间窗口加载，用户在切周时存在空白等待。

### 修复方案

参照 `scheduleSource.ts` 的 `prefetchAdjacentScheduleWindows` 模式：

```typescript
// lmsSource.ts
const prefetchAdjacentLmsWindows = (context: CalendarSourceContext) => {
  const prefetchRanges = context.prefetchQueryRanges ?? [];
  return Promise.allSettled(prefetchRanges.map((range) => {
    const params = buildLmsParams({ ...context, queryRange: range });
    return services.queryClient.prefetchQuery({
      queryKey: services.queryKeys.semesters.lmsCalendarEvents(context.scopeId, params),
      queryFn: async () => {
        const res = await services.lmsService.getLmsCalendarEvents(context.scopeId, params);
        return res.items;
      },
      staleTime: 60_000,
      gcTime: 5 * 60_000,
    });
  }));
};

load: async (context) => {
  const data = await services.queryClient.fetchQuery({ ... });
  void prefetchAdjacentLmsWindows(context);  // ← 加这一行
  return data.items.map(...);
},
```

---

## 执行顺序

```
R5（shouldRefresh Set）     → 纯代码质量，最低风险，改动仅 4 个 source 文件
R6（signalId）              → 可靠性修复，改动 signals.ts + CalendarTab.tsx
R7（LMS prefetch）          → 独立性能改进，改动仅 lmsSource.ts
R2（信号重设计）            → 影响 types + 所有信号创建点，建议单独 PR
R3（context 去 semester 化）→ 配合 R2 同步执行，纯重命名
R4（服务注入）              → 影响所有 source 文件，单独 PR，改后补测试
R1（CalendarEventBase 分层）→ 影响面最大，建议最后执行，分两步：
                              Step A：新增 TimetableCalendarEvent，source 改类型，不动 calendar-core
                              Step B：calendar-core/types.ts 剥离学术字段，更新 registry 泛型
```

---

## 完成后的层次规则（可写进 INDEX.md）

```
calendar-core/
  ✓ 可以 import：React（仅 useSyncExternalStore）
  ✗ 禁止 import：@/services/*, shared/, tabs/

shared/
  ✓ 可以 import：calendar-core, @/services/*（仅 types）
  ✗ 禁止 import：tabs/

tabs/calendar/
  ✓ 可以 import：calendar-core, shared/, @/services/*
  ✗ 禁止 import：tabs/todo/ 直接内部实现（通过 shared/ 共享）
```

未来可以通过 oxlint / eslint-plugin-boundaries 配置 import 规则强制执行。
