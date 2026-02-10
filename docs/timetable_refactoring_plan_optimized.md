# Builtin Timetable 插件重构计划（性能与 UX 优化版）

## 📋 项目概览

### 目标
将现有的单一 Timetable Tab 重构为多 Tab 架构，引入统一的日历视图（基于 FullCalendar），分离学期/课程管理功能，并为未来的待办事项功能预留接口。

### 核心原则
- **功能完整性**：保持现有功能不丢失
- **架构清晰**：采用 One Plugin, Multi Tab 架构
- **代码可维护性**：分离关注点，提升代码组织结构
- **用户体验优先**：流畅的交互、一致的 UI 风格
- **性能优先**：遵循 Vercel React 最佳实践
- **无障碍性**：符合 WCAG 2.1 AA 标准
- **规范遵循**：严格遵循项目的插件开发规范和 UI 规范
- **问题修复**：在重构过程中修复现有逻辑问题

---

## 🚀 性能优化策略（基于 Vercel React Best Practices）

### 1. 消除瀑布流（CRITICAL）

#### 问题：Recurring Rule 数据加载导致的瀑布流
**当前实现**（串行加载 20 周数据）：
```typescript
// ❌ BAD: 串行加载导致瀑布流
for (let week = 1; week <= 20; week++) {
    const data = await scheduleService.getSemesterSchedule(semesterId, { week });
    allItems.push(...data.items);
}
```

**优化方案**（并行加载）：
```typescript
// ✅ GOOD: 使用 Promise.all 并行加载所有周次
const loadAllWeeks = async () => {
    const weekPromises = Array.from({ length: maxWeek }, (_, i) =>
        scheduleService.getSemesterSchedule(semesterId, {
            week: i + 1,
            withConflicts: true
        })
    );

    const results = await Promise.all(weekPromises);
    const allItems = results.flatMap(data => data.items);
    setScheduleItems(allItems);
};
```

**性能提升**：从 ~2000ms（20 * 100ms）降至 ~100ms（并行）

#### 问题：组件层级导致的串行渲染
**优化方案**：使用 Suspense 边界流式传输内容
```typescript
// ✅ GOOD: 使用 Suspense 避免阻塞整个页面
<Suspense fallback={<CalendarSkeleton />}>
    <CalendarTab />
</Suspense>
<Suspense fallback={<SemesterScheduleSkeleton />}>
    <SemesterScheduleTab />
</Suspense>
```

### 2. Bundle 大小优化（CRITICAL）

#### 问题：FullCalendar 体积过大（~200KB）
**优化方案**：动态导入 + 代码分割
```typescript
// ✅ GOOD: 动态导入 FullCalendar
import dynamic from 'next/dynamic';

const FullCalendarView = dynamic(
    () => import('./FullCalendarView').then(mod => mod.FullCalendarView),
    {
        loading: () => <CalendarSkeleton />,
        ssr: false, // 日历无需 SSR
    }
);
```

**Bundle 优化**：
- FullCalendar: 从主包分离到独立 chunk
- 仅在 Calendar Tab 激活时加载
- 使用 Tree-shaking 移除未使用的插件

#### 问题：Barrel imports 导致额外代码
```typescript
// ❌ BAD: Barrel import 导入整个 lucide-react
import { Calendar, Eye, EyeOff } from 'lucide-react';

// ✅ GOOD: 直接导入
import Calendar from 'lucide-react/dist/esm/icons/calendar';
import Eye from 'lucide-react/dist/esm/icons/eye';
import EyeOff from 'lucide-react/dist/esm/icons/eye-off';
```

### 3. 服务端性能优化（HIGH）

#### React.cache() 实现请求去重
```typescript
// ✅ GOOD: 使用 React.cache 去重同一请求周期内的重复调用
import { cache } from 'react';

export const getSemesterSchedule = cache(async (semesterId: string, options: any) => {
    return await scheduleService.getSemesterSchedule(semesterId, options);
});
```

#### 避免重复序列化
```typescript
// ❌ BAD: 多次传递相同数据给客户端组件
<EventEditor event={selectedEvent} eventData={selectedEvent.extendedProps} />

// ✅ GOOD: 最小化传递数据
<EventEditor eventId={selectedEvent.id} />
// 在 EventEditor 内部按需获取详细数据
```

### 4. 客户端性能优化（MEDIUM-HIGH）

#### SWR 自动去重
```typescript
// ✅ GOOD: 使用 SWR 实现请求去重和缓存
import useSWR from 'swr';

const { data: schedule, mutate } = useSWR(
    semesterId ? [`semester-schedule`, semesterId, week] : null,
    () => scheduleService.getSemesterSchedule(semesterId, { week })
);

// 事件总线更新时使用 mutate 刷新
eventBus.subscribe('EVENT_UPDATED', () => mutate());
```

#### 被动事件监听器
```typescript
// ✅ GOOD: 为滚动事件添加 passive 标志
useEffect(() => {
    const handleScroll = () => { /* ... */ };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
}, []);
```

### 5. 重渲染优化（MEDIUM）

#### 问题：频繁的状态更新导致重渲染
**优化方案**：使用 useTransition 标记非紧急更新
```typescript
// ✅ GOOD: 使用 useTransition 延迟非紧急更新
const [isPending, startTransition] = useTransition();

const handleFilterChange = (filter: string) => {
    startTransition(() => {
        setFilter(filter); // 非紧急更新
    });
};
```

#### 提取昂贵计算到 memo 组件
```typescript
// ✅ GOOD: 将事件转换逻辑提取到 memo 组件
const MemoizedCalendarEvents = memo(({ items, colorConfig, skippedMode }: Props) => {
    return items.map(item => toCalendarEvent(item, semesterInfo.startDate, colorConfig, skippedMode));
}, (prev, next) => {
    return prev.items === next.items &&
           prev.colorConfig === next.colorConfig &&
           prev.skippedMode === next.skippedMode;
});
```

#### 使用 ref 存储瞬态值
```typescript
// ✅ GOOD: 使用 ref 存储频繁变化的值（如鼠标位置）
const isDraggingRef = useRef(false);

const handleDragStart = () => {
    isDraggingRef.current = true; // 不触发重渲染
};
```

### 6. 渲染性能优化（MEDIUM）

#### Content Visibility 优化长列表
```typescript
// ✅ GOOD: 为长列表添加 content-visibility
<div className="space-y-2">
    {schedule.map((item, index) => (
        <div
            key={item.id}
            style={{ contentVisibility: 'auto' }}
            className="min-h-[60px]" // 指定高度用于布局计算
        >
            <ScheduleItem item={item} />
        </div>
    ))}
</div>
```

#### 条件渲染使用三元运算符
```typescript
// ❌ BAD: && 可能导致渲染 0 或 false
{items.length && <ItemList items={items} />}

// ✅ GOOD: 使用三元运算符
{items.length > 0 ? <ItemList items={items} /> : <EmptyState />}
```

#### 提升静态 JSX
```typescript
// ✅ GOOD: 将静态 JSX 提升到组件外部
const EMPTY_STATE = (
    <Card>
        <CardContent>
            <p className="text-muted-foreground">No events found</p>
        </CardContent>
    </Card>
);

const MyComponent = () => {
    return items.length > 0 ? <ItemList /> : EMPTY_STATE;
};
```

---

## 🎨 UI/UX 优化策略（基于 UI/UX Pro Max）

### 1. 无障碍性（CRITICAL）

#### 颜色对比度
```typescript
// ✅ GOOD: 确保文本对比度 ≥ 4.5:1
<span className="text-slate-900 dark:text-slate-100">Primary text</span>
<span className="text-slate-600 dark:text-slate-400">Secondary text</span>

// ❌ BAD: 对比度不足
<span className="text-slate-400">Body text</span> // 仅 2.8:1
```

#### 焦点状态
```typescript
// ✅ GOOD: 清晰的焦点指示器
<Button className="focus:ring-2 focus:ring-primary focus:ring-offset-2">
    Skip Event
</Button>
```

#### ARIA 标签
```typescript
// ✅ GOOD: 为图标按钮添加 aria-label
<Button
    variant="ghost"
    size="icon"
    aria-label={item.skip ? "Mark as active" : "Skip this event"}
>
    {item.skip ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
</Button>
```

#### 键盘导航
```typescript
// ✅ GOOD: 支持键盘快捷键
useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSave();
        }
        if (e.key === 'Escape') {
            onClose();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

### 2. 触摸与交互（CRITICAL）

#### 触摸目标大小
```typescript
// ✅ GOOD: 最小 44x44px 触摸目标
<Button
    size="sm"
    className="min-w-[44px] min-h-[44px]" // 确保触摸友好
>
    <Eye className="h-4 w-4" />
</Button>
```

#### 加载按钮状态
```typescript
// ✅ GOOD: 异步操作时禁用按钮
<Button
    onClick={handleSave}
    disabled={isSaving}
    className="relative"
>
    {isSaving && (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    )}
    Save
</Button>
```

#### 错误反馈
```typescript
// ✅ GOOD: 错误消息靠近问题区域
<div className="space-y-2">
    <Label htmlFor="title" className={errors.title ? 'text-destructive' : ''}>
        Title
    </Label>
    <Input
        id="title"
        value={title}
        className={errors.title ? 'border-destructive' : ''}
        onChange={handleChange}
    />
    {errors.title && (
        <p className="text-sm text-destructive">{errors.title}</p>
    )}
</div>
```

#### Cursor Pointer
```typescript
// ✅ GOOD: 为所有可点击元素添加 cursor-pointer
<div
    className="cursor-pointer hover:bg-accent transition-colors"
    onClick={handleClick}
    onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    role="button"
    tabIndex={0}
>
    {/* 可点击卡片 */}
</div>
```

### 3. 性能感知（HIGH）

#### 图片优化
```typescript
// ✅ GOOD: 使用 Next.js Image 组件
import Image from 'next/image';

<Image
    src="/calendar-placeholder.jpg"
    alt="Calendar placeholder"
    width={400}
    height={300}
    loading="lazy"
    placeholder="blur"
/>
```

#### 减少动画（prefers-reduced-motion）
```typescript
// ✅ GOOD: 检查用户偏好
<div className="
    transition-transform duration-200
    motion-reduce:transition-none
">
    {/* 内容 */}
</div>
```

#### 内容跳跃预防
```typescript
// ✅ GOOD: 为异步内容预留空间
<div className="min-h-[400px]"> {/* 预留高度 */}
    <Suspense fallback={<Skeleton className="h-[400px]" />}>
        <FullCalendarView />
    </Suspense>
</div>
```

### 4. 布局与响应式（HIGH）

#### 可读字体大小
```css
/* ✅ GOOD: 移动端最小 16px 避免缩放 */
.text-body {
    @apply text-base; /* 16px */
}

/* ❌ BAD: 过小的字体 */
.text-small {
    @apply text-xs; /* 12px - 移动端难以阅读 */
}
```

#### 行长度限制
```typescript
// ✅ GOOD: 限制文本行长度为 65-75 字符
<p className="max-w-prose"> {/* max-w-prose = 65ch */}
    Event description text...
</p>
```

#### Z-index 管理
```typescript
// ✅ GOOD: 定义 z-index 阶梯
const Z_INDEX = {
    base: 0,
    dropdown: 10,
    sticky: 20,
    overlay: 30,
    modal: 40,
    popover: 50,
    tooltip: 60,
} as const;

<Dialog className="z-[var(--z-modal)]" />
```

### 5. 动画与过渡（MEDIUM）

#### 动画时长
```typescript
// ✅ GOOD: 微交互使用 150-300ms
<Button className="transition-colors duration-200 hover:bg-accent">
    Click me
</Button>

// ❌ BAD: 过长的动画
<div className="transition-all duration-1000"> {/* 太慢 */}
```

#### 使用 transform 而非布局属性
```css
/* ✅ GOOD: 使用 transform 和 opacity */
.animate-slide-in {
    @apply transition-transform duration-300;
    transform: translateX(0);
}

/* ❌ BAD: 动画 width 触发 reflow */
.animate-width {
    @apply transition-all duration-300;
    width: 100%;
}
```

#### 骨架屏加载状态
```typescript
// ✅ GOOD: 骨架屏优于 Spinner
const CalendarSkeleton = () => (
    <div className="space-y-4">
        <Skeleton className="h-12 w-full" /> {/* 工具栏 */}
        <Skeleton className="h-[600px] w-full" /> {/* 日历主体 */}
    </div>
);
```

### 6. 颜色与对比度优化

#### 浅色模式玻璃态卡片
```typescript
// ❌ BAD: 透明度过高导致不可见
<Card className="bg-white/10 backdrop-blur-md">

// ✅ GOOD: 浅色模式使用更高透明度
<Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md">
```

#### 边框可见性
```typescript
// ❌ BAD: 浅色模式下边框不可见
<div className="border border-white/10">

// ✅ GOOD: 根据主题调整边框颜色
<div className="border border-slate-200 dark:border-slate-800">
```

---

## 🏗️ 优化后的架构设计

### 1. 插件结构（增强性能）

```
frontend/src/plugins/builtin-timetable/
├── index.ts                          # 插件入口，使用动态导入
├── shared/                           # 共享模块
│   ├── eventBus.ts                  # 发布-订阅事件总线（去重优化）
│   ├── types.ts                     # 共享类型定义
│   ├── utils.ts                     # 工具函数（memoized）
│   ├── hooks/                       # 自定义 Hooks
│   │   ├── useScheduleData.ts       # SWR 数据获取
│   │   ├── useEventBus.ts           # 事件总线订阅
│   │   └── useOptimisticUpdate.ts   # 乐观更新
│   └── constants.ts                 # 常量（颜色、Z-index 等）
├── tabs/
│   ├── calendar/                    # Calendar Tab（动态导入）
│   │   ├── index.ts
│   │   ├── CalendarTab.tsx          # 使用 Suspense
│   │   ├── FullCalendarView.tsx    # 动态导入的主视图
│   │   ├── CalendarToolbar.tsx
│   │   ├── CalendarSettings.tsx
│   │   ├── EventEditor.tsx
│   │   └── components/
│   │       ├── CalendarSkeleton.tsx # 骨架屏
│   │       └── EventColorPicker.tsx # 颜色选择器
│   ├── semester-schedule/
│   │   ├── index.ts
│   │   ├── SemesterScheduleTab.tsx
│   │   ├── SemesterScheduleSettings.tsx
│   │   └── components/
│   │       ├── VirtualizedScheduleList.tsx # 虚拟滚动
│   │       └── ScheduleSkeleton.tsx
│   ├── course-schedule/
│   │   ├── index.ts
│   │   ├── CourseScheduleTab.tsx
│   │   └── CourseScheduleSettings.tsx
│   └── todo/
│       ├── index.ts
│       └── TodoTab.tsx
└── components/                      # 共享 UI 组件
    ├── CrudPanel.tsx
    ├── WeeklyCalendarView.tsx       # 优化渲染
    ├── SectionFormDialog.tsx
    └── EventTypeFormDialog.tsx
```

### 2. 核心优化实现

#### 2.1 并行数据加载 Hook
**文件**: `shared/hooks/useScheduleData.ts`

```typescript
import useSWR from 'swr';
import { useMemo } from 'react';
import scheduleService from '@/services/schedule';

export const useScheduleData = (semesterId: string | undefined, maxWeek: number) => {
    // 使用 SWR 自动去重和缓存
    const { data, error, isLoading, mutate } = useSWR(
        semesterId ? ['semester-schedule-all', semesterId, maxWeek] : null,
        async () => {
            // 并行加载所有周次
            const weekPromises = Array.from({ length: maxWeek }, (_, i) =>
                scheduleService.getSemesterSchedule(semesterId!, {
                    week: i + 1,
                    withConflicts: true,
                })
            );

            const results = await Promise.all(weekPromises);
            return results.flatMap(data => data.items);
        },
        {
            revalidateOnFocus: false,
            dedupingInterval: 5000, // 5秒内去重
        }
    );

    return {
        schedule: data ?? [],
        isLoading,
        error,
        mutate,
    };
};
```

#### 2.2 优化的事件总线
**文件**: `shared/eventBus.ts`

```typescript
import { useEffect, useRef } from 'react';

class EventBusImpl {
    private listeners = new Map<string, Set<Function>>();
    private pendingEvents = new Map<string, NodeJS.Timeout>();

    // 去重发布：同一事件类型在短时间内只触发一次
    publish<T extends CalendarEvent['type']>(
        eventType: T,
        payload: any,
        debounce = 100 // 100ms 去重
    ): void {
        // 清除之前的 pending 事件
        const pending = this.pendingEvents.get(eventType);
        if (pending) {
            clearTimeout(pending);
        }

        // 设置新的 debounced 发布
        const timeoutId = setTimeout(() => {
            const handlers = this.listeners.get(eventType);
            if (!handlers) return;

            handlers.forEach(handler => {
                try {
                    handler(payload);
                } catch (error) {
                    console.error(`Error in event handler for ${eventType}:`, error);
                }
            });

            this.pendingEvents.delete(eventType);
        }, debounce);

        this.pendingEvents.set(eventType, timeoutId);
    }

    subscribe<T extends CalendarEvent['type']>(
        eventType: T,
        handler: Function
    ): () => void {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        this.listeners.get(eventType)!.add(handler);

        return () => {
            this.listeners.get(eventType)?.delete(handler);
        };
    }
}

export const eventBus = new EventBusImpl();

// Custom Hook 用于订阅事件
export const useEventBus = <T extends CalendarEvent['type']>(
    eventType: T,
    handler: (payload: Extract<CalendarEvent, { type: T }>['payload']) => void,
    deps: any[] = []
) => {
    const handlerRef = useRef(handler);

    // 使用 ref 保持最新的 handler
    useEffect(() => {
        handlerRef.current = handler;
    }, [handler]);

    useEffect(() => {
        const unsubscribe = eventBus.subscribe(eventType, (payload: any) => {
            handlerRef.current(payload);
        });

        return unsubscribe;
    }, [eventType, ...deps]);
};
```

#### 2.3 动态导入的 Calendar Tab
**文件**: `tabs/calendar/index.ts`

```typescript
import dynamic from 'next/dynamic';
import { CalendarSkeleton } from './components/CalendarSkeleton';

// 动态导入 FullCalendar（~200KB）
export const CalendarTab = dynamic(
    () => import('./CalendarTab').then(mod => mod.CalendarTab),
    {
        loading: () => <CalendarSkeleton />,
        ssr: false, // 日历不需要 SSR
    }
);

export { CalendarTabDefinition } from './CalendarTabDefinition';
```

#### 2.4 优化的 Calendar Tab 主组件
**文件**: `tabs/calendar/CalendarTab.tsx`

```typescript
import React, { useState, useMemo, useTransition, Suspense } from 'react';
import type { TabProps } from '@/services/tabRegistry';
import dynamic from 'next/dynamic';
import { useScheduleData } from '../../shared/hooks/useScheduleData';
import { useEventBus } from '../../shared/eventBus';
import { toCalendarEvent } from '../../shared/utils';
import { CalendarSkeleton } from './components/CalendarSkeleton';
import type { CalendarEventData, SkippedDisplayMode } from '../../shared/types';

// 动态导入 FullCalendar 组件
const FullCalendarView = dynamic(
    () => import('./FullCalendarView').then(mod => mod.FullCalendarView),
    {
        loading: () => <CalendarSkeleton />,
        ssr: false,
    }
);

const EventEditor = dynamic(() => import('./EventEditor').then(mod => mod.EventEditor));

export const CalendarTab: React.FC<TabProps> = ({
    tabId,
    settings,
    semesterId,
    courseId,
    updateSettings,
}) => {
    const [selectedEvent, setSelectedEvent] = useState<CalendarEventData | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    // 使用 SWR 获取数据（自动缓存和去重）
    const { schedule, isLoading, mutate } = useScheduleData(semesterId, 20);

    // 订阅事件总线
    useEventBus('EVENT_UPDATED', () => mutate());
    useEventBus('EVENT_DELETED', () => mutate());
    useEventBus('SECTION_CHANGED', () => mutate());

    // 转换为 FullCalendar 格式（memoized）
    const calendarEvents = useMemo(() => {
        if (!schedule.length) return [];

        const skippedMode: SkippedDisplayMode = settings.skippedDisplay || 'grayed';
        const colorConfig = settings.eventColors || {
            schedule: '#3b82f6',
            todo: '#10b981',
            custom: '#8b5cf6',
        };

        // TODO: 获取 semester start date
        const semesterStartDate = new Date('2024-01-01');

        return schedule
            .filter(item => {
                if (skippedMode === 'hidden' && item.skip) return false;
                if (settings.courseFilter !== 'ALL' && item.courseId !== settings.courseFilter) return false;
                if (settings.typeFilter !== 'ALL' && item.eventTypeCode !== settings.typeFilter) return false;
                return true;
            })
            .map(item => toCalendarEvent(item, semesterStartDate, colorConfig, skippedMode));
    }, [schedule, settings]);

    // 事件更新（使用 transition 延迟非紧急更新）
    const handleEventUpdate = async (eventId: string, changes: any) => {
        // 乐观更新
        startTransition(() => {
            mutate(
                (current) =>
                    current?.map(item =>
                        item.eventId === eventId ? { ...item, ...changes } : item
                    ),
                { revalidate: false }
            );
        });

        // 调用 API
        try {
            // await scheduleService.updateCourseEvent(courseId, eventId, changes);
            console.log('Update event:', eventId, changes);
        } catch (error) {
            // 回滚乐观更新
            mutate();
            throw error;
        }
    };

    if (isLoading) {
        return <CalendarSkeleton />;
    }

    return (
        <div className="flex h-full flex-col">
            <Suspense fallback={<CalendarSkeleton />}>
                <FullCalendarView
                    semesterId={semesterId}
                    events={calendarEvents}
                    semesterStartDate={new Date('2024-01-01')}
                    semesterEndDate={new Date('2024-06-30')}
                    onEventUpdate={handleEventUpdate}
                    onEventClick={(event) => {
                        setSelectedEvent(event);
                        setIsEditorOpen(true);
                    }}
                    isPending={isPending}
                />
            </Suspense>

            {isEditorOpen && (
                <EventEditor
                    event={selectedEvent}
                    open={isEditorOpen}
                    onOpenChange={setIsEditorOpen}
                    onSave={handleEventUpdate}
                />
            )}
        </div>
    );
};
```

#### 2.5 骨架屏组件
**文件**: `tabs/calendar/components/CalendarSkeleton.tsx`

```typescript
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const CalendarSkeleton: React.FC = () => {
    return (
        <div className="flex h-full flex-col p-6 space-y-4">
            {/* 工具栏骨架 */}
            <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-64" />
                <div className="flex gap-2">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                </div>
            </div>

            {/* 日历骨架 */}
            <div className="flex-1 space-y-2">
                {/* 周标题 */}
                <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <Skeleton key={i} className="h-8" />
                    ))}
                </div>

                {/* 日历网格 */}
                <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 35 }).map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
            </div>
        </div>
    );
};
```

#### 2.6 虚拟滚动列表（Semester Schedule Tab）
**文件**: `tabs/semester-schedule/components/VirtualizedScheduleList.tsx`

```typescript
import React, { useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ScheduleItem } from '../../../shared/types';

interface VirtualizedScheduleListProps {
    items: ScheduleItem[];
    onItemClick: (item: ScheduleItem) => void;
}

export const VirtualizedScheduleList: React.FC<VirtualizedScheduleListProps> = ({
    items,
    onItemClick,
}) => {
    const parentRef = React.useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 60, // 每项高度约 60px
        overscan: 5, // 预渲染 5 项
    });

    return (
        <div
            ref={parentRef}
            className="h-full overflow-y-auto"
            style={{
                contain: 'strict', // 优化渲染性能
            }}
        >
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                    const item = items[virtualRow.index];
                    return (
                        <div
                            key={virtualRow.key}
                            data-index={virtualRow.index}
                            ref={virtualizer.measureElement}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                transform: `translateY(${virtualRow.start}px)`,
                            }}
                            className="cursor-pointer hover:bg-accent transition-colors"
                            onClick={() => onItemClick(item)}
                        >
                            <ScheduleItemCard item={item} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
```

---

## 🎨 UI/UX 增强设计

### 1. Skip 操作 UX 改进

#### 方案 A：表格内快速操作（优先实现）
```typescript
<TableRow className="group hover:bg-accent/50 transition-colors">
    <TableCell>{item.courseName}</TableCell>
    <TableCell>{item.eventTypeCode}</TableCell>
    <TableCell>{item.startTime} - {item.endTime}</TableCell>
    <TableCell className="text-right">
        <Button
            variant="ghost"
            size="sm"
            className="
                min-w-[44px] min-h-[44px]
                opacity-0 group-hover:opacity-100
                focus:opacity-100
                transition-opacity
            "
            onClick={() => handleToggleSkip(item.eventId, !item.skip)}
            aria-label={item.skip ? "Mark as active" : "Skip this event"}
        >
            {item.skip ? (
                <Eye className="h-4 w-4 text-primary" />
            ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
            )}
        </Button>
    </TableCell>
</TableRow>
```

**UX 亮点**：
- ✅ 悬停时显示，减少视觉噪音
- ✅ 44x44px 触摸目标
- ✅ 明确的 ARIA 标签
- ✅ 焦点时也显示（键盘导航友好）

#### 方案 B：Calendar 中的改进编辑器
```typescript
<Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                Edit Event
                <Badge variant={isScheduleEvent ? 'default' : 'secondary'}>
                    {event.extendedProps.source}
                </Badge>
            </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
            {/* Skip 开关 - 突出显示 */}
            {isScheduleEvent && (
                <div className="
                    flex items-center justify-between
                    rounded-lg border-2
                    border-primary/20
                    bg-primary/5
                    p-4
                    transition-all
                    hover:border-primary/40
                ">
                    <div className="flex items-center gap-3">
                        {isSkipped ? (
                            <EyeOff className="h-5 w-5 text-muted-foreground" />
                        ) : (
                            <Eye className="h-5 w-5 text-primary" />
                        )}
                        <div>
                            <Label
                                htmlFor="skip"
                                className="cursor-pointer font-medium text-base"
                            >
                                Skip this event
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">
                                {isSkipped
                                    ? 'This event will be grayed out or hidden in the calendar'
                                    : 'Skip if you won\'t attend this event'}
                            </p>
                        </div>
                    </div>
                    <Switch
                        id="skip"
                        checked={isSkipped}
                        onCheckedChange={setIsSkipped}
                        className="data-[state=checked]:bg-primary"
                    />
                </div>
            )}
        </div>

        <DialogFooter className="flex justify-between">
            {isScheduleEvent && (
                <Button variant="destructive" onClick={handleDelete}>
                    Delete
                </Button>
            )}
            <div className="flex gap-2 ml-auto">
                <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="min-w-[100px]"
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        'Save'
                    )}
                </Button>
            </div>
        </DialogFooter>
    </DialogContent>
</Dialog>
```

**UX 亮点**：
- ✅ Skip 开关视觉突出（边框高亮）
- ✅ 清晰的状态说明
- ✅ 加载状态反馈
- ✅ 键盘快捷键支持（Ctrl+S 保存，Esc 关闭）

#### 方案 C：批量操作（后续增强）
```typescript
<div className="border-b border-border p-4">
    <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
            <Checkbox
                checked={selectedEvents.length === schedule.length}
                onCheckedChange={handleSelectAll}
                aria-label="Select all events"
            />
            <span className="text-sm text-muted-foreground">
                {selectedEvents.length > 0
                    ? `${selectedEvents.length} selected`
                    : 'Select events'}
            </span>
        </div>

        {selectedEvents.length > 0 && (
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkSkip}
                    className="gap-2"
                >
                    <EyeOff className="h-4 w-4" />
                    Skip Selected
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkUnskip}
                    className="gap-2"
                >
                    <Eye className="h-4 w-4" />
                    Activate Selected
                </Button>
            </div>
        )}
    </div>
</div>
```

### 2. 颜色选择器增强
**文件**: `tabs/calendar/components/EventColorPicker.tsx`

```typescript
import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { EventSource } from '../../../shared/types';

// 预设颜色（高对比度）
const PRESET_COLORS = [
    { name: 'Blue', value: '#3b82f6', contrast: 'high' },
    { name: 'Green', value: '#10b981', contrast: 'high' },
    { name: 'Purple', value: '#8b5cf6', contrast: 'high' },
    { name: 'Orange', value: '#f59e0b', contrast: 'medium' },
    { name: 'Pink', value: '#ec4899', contrast: 'high' },
    { name: 'Teal', value: '#14b8a6', contrast: 'high' },
] as const;

interface EventColorPickerProps {
    source: EventSource;
    value: string;
    onChange: (color: string) => void;
}

export const EventColorPicker: React.FC<EventColorPickerProps> = ({
    source,
    value,
    onChange,
}) => {
    const [customColor, setCustomColor] = useState(value);

    const handlePresetClick = (color: string) => {
        setCustomColor(color);
        onChange(color);
    };

    const handleCustomChange = (color: string) => {
        setCustomColor(color);
        onChange(color);
    };

    return (
        <div className="space-y-3">
            <Label htmlFor={`color-${source}`} className="capitalize">
                {source} Events
            </Label>

            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-2"
                        aria-label={`Choose color for ${source} events`}
                    >
                        <div
                            className="h-6 w-6 rounded-md border-2 border-border"
                            style={{ backgroundColor: value }}
                        />
                        <span className="flex-1 text-left">{value}</span>
                    </Button>
                </PopoverTrigger>

                <PopoverContent className="w-64">
                    <div className="space-y-4">
                        {/* 预设颜色 */}
                        <div>
                            <Label className="text-xs text-muted-foreground mb-2 block">
                                Preset Colors
                            </Label>
                            <div className="grid grid-cols-6 gap-2">
                                {PRESET_COLORS.map((preset) => (
                                    <button
                                        key={preset.value}
                                        type="button"
                                        className="
                                            h-10 w-10 rounded-md border-2
                                            transition-all
                                            hover:scale-110
                                            focus:ring-2 focus:ring-primary focus:ring-offset-2
                                        "
                                        style={{
                                            backgroundColor: preset.value,
                                            borderColor: value === preset.value ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                                        }}
                                        onClick={() => handlePresetClick(preset.value)}
                                        aria-label={`${preset.name} - ${preset.contrast} contrast`}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* 自定义颜色 */}
                        <div>
                            <Label htmlFor="custom-color" className="text-xs text-muted-foreground mb-2 block">
                                Custom Color
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="custom-color"
                                    type="color"
                                    value={customColor}
                                    onChange={(e) => handleCustomChange(e.target.value)}
                                    className="w-16 h-10 p-1"
                                />
                                <Input
                                    type="text"
                                    value={customColor}
                                    onChange={(e) => handleCustomChange(e.target.value)}
                                    className="flex-1"
                                    placeholder="#3b82f6"
                                />
                            </div>
                        </div>

                        {/* 重置按钮 */}
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                                const defaultColors = {
                                    schedule: '#3b82f6',
                                    todo: '#10b981',
                                    custom: '#8b5cf6',
                                };
                                handleCustomChange(defaultColors[source]);
                            }}
                        >
                            Reset to Default
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
};
```

**UX 亮点**：
- ✅ 预设高对比度颜色（无障碍友好）
- ✅ 视觉预览（色块）
- ✅ 支持手动输入十六进制值
- ✅ 重置为默认颜色
- ✅ 悬停时放大效果

### 3. Loading 状态优化

#### useTransition 加载状态
```typescript
const [isPending, startTransition] = useTransition();

// 在 UI 中显示 pending 状态
<FullCalendarView
    events={calendarEvents}
    isPending={isPending} // 传递 pending 状态
    className={cn(
        'transition-opacity',
        isPending && 'opacity-50 pointer-events-none'
    )}
/>
```

---

## ✅ 优化后的验收标准

### 性能验收（新增）
- [ ] **并行加载**：所有周次数据并行加载，总时间 < 200ms
- [ ] **Bundle 大小**：FullCalendar 分离到独立 chunk，主 bundle 减少 ~150KB
- [ ] **首次渲染**：Calendar Tab 首次加载 < 1s（使用骨架屏）
- [ ] **重渲染优化**：筛选器变更时仅相关组件重渲染
- [ ] **虚拟滚动**：长列表（>100 项）使用虚拟滚动
- [ ] **SWR 缓存**：同一数据多次请求自动去重

### 无障碍性验收（新增）
- [ ] **颜色对比度**：所有文本对比度 ≥ 4.5:1
- [ ] **焦点指示器**：所有交互元素有清晰焦点环
- [ ] **ARIA 标签**：图标按钮有 aria-label
- [ ] **键盘导航**：Tab 键顺序符合视觉顺序
- [ ] **屏幕阅读器**：使用 NVDA/VoiceOver 测试通过

### 触摸友好验收（新增）
- [ ] **触摸目标**：所有按钮 ≥ 44x44px
- [ ] **加载按钮**：异步操作时禁用按钮并显示加载指示器
- [ ] **错误提示**：错误消息显示在问题区域附近
- [ ] **Cursor Pointer**：所有可点击元素有 cursor-pointer

### 功能验收
- [ ] **修复 Recurring Rule 问题**：Calendar Tab 正确显示所有周次的事件（并行加载）
- [ ] **修复 Skip UI 问题**：提供便捷的 Skip/Unskip 操作（表格悬停 + 编辑器）
- [ ] Calendar Tab 支持多源事件聚合（课程表/Todo/自定义）
- [ ] 拖放功能正常，使用乐观更新提升体验
- [ ] 日期范围限制生效，无法导航到学期外日期
- [ ] Semester Schedule Tab 新增日历视图专门显示课程表
- [ ] Skipped 事件提供两种显示模式：灰度显示/隐藏
- [ ] 不同事件来源使用不同颜色区分（预设高对比度颜色）
- [ ] Settings 中可配置事件颜色（颜色选择器组件）
- [ ] 事件总线正常工作，Tab 间数据自动同步（使用 SWR mutate）

### UI/UX 验收
- [ ] UI 风格与项目其他部分一致（shadcn/ui 组件库）
- [ ] FullCalendar 样式与主题匹配（浅色/深色模式）
- [ ] 不同来源事件颜色清晰可辨（对比度检查）
- [ ] Skipped 事件的灰度效果使用 opacity + grayscale
- [ ] 移动端响应式布局正常（最小 375px）
- [ ] 加载状态使用骨架屏（而非 Spinner）
- [ ] 动画时长符合规范（150-300ms）
- [ ] prefers-reduced-motion 生效

### 技术验收
- [ ] 无控制台错误或警告
- [ ] 代码遵循项目规范（ESLint、Prettier）
- [ ] TypeScript 类型检查通过
- [ ] 所有组件使用 Tailwind CSS 和 shadcn/ui
- [ ] Settings 组件使用 `SettingsSection`
- [ ] Tab 组件遵循布局规范（`h-full flex flex-col`）
- [ ] 使用 React.memo、useMemo、useCallback 优化性能
- [ ] 使用 SWR 管理数据获取和缓存
- [ ] 使用 useTransition 处理非紧急更新

---

## ⚠️ 风险与缓解措施

### 1. 并行加载性能风险
**风险**：同时发起 20 个请求可能导致浏览器并发限制
**缓解**：
- 使用 `p-limit` 库限制并发数为 6
- 实现渐进式加载：先加载当前周，再加载其他周
- 使用 HTTP/2 多路复用优化

```typescript
import pLimit from 'p-limit';

const limit = pLimit(6); // 限制并发为 6

const weekPromises = Array.from({ length: maxWeek }, (_, i) =>
    limit(() => scheduleService.getSemesterSchedule(semesterId, { week: i + 1 }))
);
```

### 2. 数据同步冲突
**风险**：多个 Tab 同时修改同一事件导致冲突
**缓解**：
- 使用 SWR 的 `mutate` 函数统一管理数据
- 乐观更新 + 冲突检测
- 后端添加版本号/时间戳检查

### 3. FullCalendar 性能问题
**风险**：大量事件（>1000）可能导致卡顿
**缓解**：
- 动态导入 FullCalendar（已实现）
- 事件聚合（月视图下合并同类事件）
- 使用 `eventDidMount` 钩子优化事件渲染

### 4. 内存泄漏风险
**风险**：事件总线订阅未正确清理
**缓解**：
- 使用自定义 Hook `useEventBus` 自动清理
- 在 useEffect cleanup 中取消订阅
- 定期审查组件卸载逻辑

---

## 📚 参考资料

- **Vercel React Best Practices**：性能优化规则
- **UI/UX Pro Max**：设计系统和无障碍性指南
- **插件开发规范**：`PLUGIN_DEVELOPMENT.md`
- **FullCalendar 文档**：https://fullcalendar.io/docs
- **shadcn/ui 文档**：https://ui.shadcn.com
- **Tailwind CSS v4**：https://tailwindcss.com
- **React Hooks**：https://react.dev/reference/react
- **SWR**：https://swr.vercel.app
- **TanStack Virtual**：https://tanstack.com/virtual

---

**文档版本**：3.0
**最后更新**：2026-02-09
**作者**：Claude Code Assistant
**更新内容**：基于 Vercel React Best Practices 和 UI/UX Pro Max 优化性能与用户体验
