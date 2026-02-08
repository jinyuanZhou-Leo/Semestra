# Academic Suite Plugin Architecture Proposal

## 1. 核心理念 (Core Concept)

### "One Plugin, Multiple Views"
我们采用**单插件、多视图 (One Plugin, Multiple Tabs)** 的设计模式来实现日程管理、日历视图和任务待办。我们将现有的 `builtin-timetable` 扩展为一个综合性的 **Academic Suite** 插件，它包含以下三个主要 Tab：

1.  **Schedule Tab (现有)**: 专注于课程表的列表管理、排课、冲突检测。
2.  **Calendar Tab (新增)**: 提供全功能的日历视图（月/周/日），用于直观展示课程和个人日程，支持拖拽调整。
3.  **Tasks Tab (规划中)**: 提供 Todo List 功能，任务可关联截止日期并在 Calendar 中展示。

这种架构的核心优势在于**数据共享**与**状态同步**的零成本实现。

---

## 2. 为什么选择这种架构？

| 特性 | 独立插件模式 (Schedule vs Calendar) | 单一综合插件模式 (Academic Suite) |
| :--- | :--- | :--- |
| **数据源** | 需要复杂的事件总线或协议层来同步数据 | **天然共享**：直接 import 同一个 API Hook |
| **状态同步** | 难：A 插件改了数据，B 插件不知情 | **自动**：React Query 缓存自动更新所有视图 |
| **组件复用** | 难：需要把组件提出来放到公共库 | **容易**：直接引用同目录下的组件 (如 `EditDialog`) |
| **类型定义** | 需要定义 `UnifiedEvent` 接口进行转换 | 直接使用共享的 `CourseEvent` / `Task` 类型 |
| **维护成本** | 高：两个插件版本需同步 | 低：一套代码，统一维护 |

---

## 3. 目录结构 (Directory Structure)

我们将把现有的 `builtin-timetable` 目录重构为 `academic-core` (暂定名)，结构如下：

```text
src/plugins/academic-core/
├── index.ts                     // 插件入口，导出所有 Tab 定义
├── types/                       // 共享类型定义
│   ├── course.ts                // 课程相关类型 (现有)
│   ├── task.ts                  // 任务相关类型 (新增)
│   └── calendar.ts              // 日历视图特有类型
├── services/                    // 共享数据服务
│   ├── api.ts                   // 后端 API 封装
│   ├── useAcademicData.ts       // ★ 核心 Hook (基于 React Query)
│   └── transform.ts             // 数据转换工具 (Course -> CalendarEvent)
├── components/                  // 共享 UI 组件
│   ├── EventDetailDialog.tsx    // 查看/编辑事件详情弹窗
│   ├── TaskForm.tsx             // 任务表单
│   └── shared-ui/               // 通用 UI (Tag, Badge, etc.)
├── tabs/                        // 各个 Tab 的视图实现
│   ├── ScheduleListTab.tsx      // [Tab 1] 课程表列表视图 (原 CrudPanel)
│   ├── CalendarViewTab.tsx      // [Tab 2]由于 Calendar 视图
│   └── TaskListTab.tsx          // [Tab 3] 待办任务视图
└── utils/                       // 工具函数
    └── dateUtils.ts             // 日期处理
```

---

## 4. 核心技术实现：数据共享 (Reactive Data Sharing)

为了实现“在一处修改，处处更新”的效果，我们将使用 **TanStack Query (React Query)** 来管理数据状态。

### 4.1 定义共享 Hook (`useAcademicData`)

```typescript
// src/plugins/academic-core/services/useAcademicData.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const useAcademicData = (semesterId: string) => {
  const queryClient = useQueryClient();

  // 1. 获取所有数据 (课程 + 任务)
  // 这个 Query Key 被所有 Tab 共享。只要 key 相同，数据就是同一份。
  const scheduleQuery = useQuery({
    queryKey: ['academic', semesterId, 'schedule'],
    queryFn: () => api.getSemesterSchedule(semesterId),
  });

  const tasksQuery = useQuery({
    queryKey: ['academic', semesterId, 'tasks'],
    queryFn: () => api.getTasks(semesterId),
  });

  // 2. 统一的数据变更 Mutation
  const updateEventMutation = useMutation({
    mutationFn: api.updateEvent,
    onSuccess: () => {
      // 关键点：修改成功后，立即使缓存失效
      // 这会自动触发 ScheduleTab, CalendarTab, TaskTab 的重新渲染
      queryClient.invalidateQueries({ queryKey: ['academic', semesterId] });
    },
  });

  return {
    schedule: scheduleQuery.data,
    tasks: tasksQuery.data,
    updateEvent: updateEventMutation.mutate,
    isLoading: scheduleQuery.isLoading || tasksQuery.isLoading,
  };
};
```

### 4.2 在视图中使用

**ScheduleListTab.tsx**:
```typescript
const { schedule, updateEvent } = useAcademicData(semesterId);
// 渲染列表...
// 用户点击保存 -> 调用 updateEvent -> 自动触发重绘
```

**CalendarViewTab.tsx**:
```typescript
const { schedule, tasks } = useAcademicData(semesterId);
// 将 schedule 和 tasks 合并转换为日历事件格式
const calendarEvents = useMemo(() => {
  return [
    ...transformCourses(schedule),
    ...transformTasks(tasks)
  ];
}, [schedule, tasks]);

return <BigCalendar events={calendarEvents} />;
```

---

## 5. 实施路线图 (Implementation Roadmap)

### Phase 1: 重构与准备 (Refactoring)
1.  **新建插件目录**：创建 `src/plugins/academic-core`。
2.  **迁移现有代码**：将 `builtin-timetable` 的代码移动到新目录，并拆分为 `tabs/ScheduleListTab`。
3.  **引入 React Query**：将原有的 `useState` + `useEffect` 数据获取逻辑替换为 `useAcademicData` Hook。
4.  **验证**：确保原有的排课功能在新架构下正常工作。

### Phase 2: 引入日历视图 (Calendar Capability)
1.  **选择日历库**：引入 `react-big-calendar` 或 `@fullcalendar/react`。
2.  **实现 CalendarTab**：创建 `tabs/CalendarViewTab.tsx`。
3.  **数据转换**：编写转换函数，将 Backend 的 `ScheduleItem` 转换为日历库需要的 EventObject 格式。
4.  **交互集成**：实现点击日历事件弹出 `EventDetailDialog`（复用 Schedule Tab 的编辑组件）。

### Phase 3: 引入任务管理 (Task Capability)
1.  **后端支持**：设计 Task 数据表 (Title, Deadline, Status)。
2.  **前端 Hook 升级**：在 `useAcademicData` 中增加 `tasksQuery`。
3.  **开发 TaskTab**：创建简单的 Todo List 视图。
4.  **日历集成**：将 Task 数据也转换为日历事件，使得日历上既显示课程，也显示 DDL。

---

## 6. 总结

通过采用 **"One Plugin, Multiple Tabs"** 的架构，我们将复杂的跨组件通信问题转化为简单的**组件状态共享**问题。这不仅降低了系统的复杂度，还为未来扩展更多功能（如考试倒计时、番茄钟等）提供了极大的便利。
