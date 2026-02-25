// input:  [mock tabs/tasks/layout state, react-grid-layout v2 hooks/runtime, demo widget interactions]
// output: [`SemesterDashboardMock` component]
// pos:    [Interactive dashboard demo used in the marketing landing page with container-width-driven responsive grid]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useMemo, useState } from 'react';
import { Responsive, useContainerWidth } from 'react-grid-layout';
import type { Layout, ResponsiveLayouts } from 'react-grid-layout';
import { CalendarDays, CheckCircle2, GripVertical, ListTodo, Plus, Settings2 } from 'lucide-react';

import { Tabs, type TabItem } from '@/components/Tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

type DashboardLayouts = ResponsiveLayouts;

type Task = {
  id: string;
  label: string;
  done: boolean;
};

const initialLayouts: DashboardLayouts = {
  lg: [
    { i: 'todo', x: 0, y: 0, w: 7, h: 6, minW: 4, minH: 4 },
    { i: 'schedule', x: 7, y: 0, w: 5, h: 3, minW: 4, minH: 3 },
    { i: 'notes', x: 7, y: 3, w: 5, h: 3, minW: 4, minH: 3 },
  ],
  md: [
    { i: 'todo', x: 0, y: 0, w: 6, h: 6, minW: 4, minH: 4 },
    { i: 'schedule', x: 6, y: 0, w: 4, h: 3, minW: 4, minH: 3 },
    { i: 'notes', x: 6, y: 3, w: 4, h: 3, minW: 4, minH: 3 },
  ],
  sm: [
    { i: 'todo', x: 0, y: 0, w: 6, h: 6, minW: 4, minH: 4 },
    { i: 'schedule', x: 0, y: 6, w: 6, h: 3, minW: 4, minH: 3 },
    { i: 'notes', x: 0, y: 9, w: 6, h: 3, minW: 4, minH: 3 },
  ],
  xs: [
    { i: 'todo', x: 0, y: 0, w: 4, h: 6, minW: 2, minH: 4 },
    { i: 'schedule', x: 0, y: 6, w: 4, h: 3, minW: 2, minH: 3 },
    { i: 'notes', x: 0, y: 9, w: 4, h: 3, minW: 2, minH: 3 },
  ],
  xxs: [
    { i: 'todo', x: 0, y: 0, w: 2, h: 6, minW: 2, minH: 4 },
    { i: 'schedule', x: 0, y: 6, w: 2, h: 3, minW: 2, minH: 3 },
    { i: 'notes', x: 0, y: 9, w: 2, h: 3, minW: 2, minH: 3 },
  ],
};

const initialTasks: Task[] = [
  { id: 'task-1', label: 'Review CS341 notes', done: false },
  { id: 'task-2', label: 'Submit STAT230 quiz', done: true },
  { id: 'task-3', label: 'Prepare lab report', done: false },
];

const scheduleItems = [
  { time: '10:00', label: 'CS341 Lecture' },
  { time: '13:30', label: 'MATH275 Discussion' },
  { time: '18:00', label: 'Team project sync' },
] as const;

const reorderTabsByIds = (items: TabItem[], orderedIds: string[]) => {
  const byId = new Map(items.map((item) => [item.id, item]));
  return orderedIds.map((id) => byId.get(id)).filter((item): item is TabItem => Boolean(item));
};

export const SemesterDashboardMock = () => {
  const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true });
  const [layouts, setLayouts] = useState<DashboardLayouts>(initialLayouts);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [newTask, setNewTask] = useState('');
  const [notes, setNotes] = useState('Use drag handles to rearrange widgets for this semester workflow.');
  const [tabs, setTabs] = useState<TabItem[]>([
    { id: 'dashboard', label: 'Dashboard', removable: false, draggable: false },
    { id: 'planner', label: 'Planner', removable: true, draggable: true },
    { id: 'settings', label: 'Settings', removable: true, draggable: true },
  ]);
  const [activeTabId, setActiveTabId] = useState('dashboard');

  const completedTaskCount = useMemo(() => tasks.filter((task) => task.done).length, [tasks]);

  const handleToggleTask = (taskId: string) => {
    setTasks((previous) => previous.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task)));
  };

  const handleAddTask = () => {
    const label = newTask.trim();
    if (!label) return;
    setTasks((previous) => [...previous, { id: `task-${Date.now()}`, label, done: false }]);
    setNewTask('');
  };

  const handleReorderTabs = (orderedIds: string[]) => {
    setTabs((previous) => reorderTabsByIds(previous, orderedIds));
  };

  const handleAddTab = () => {
    const id = `custom-${Date.now()}`;
    const label = `Custom ${tabs.filter((tab) => tab.id.startsWith('custom-')).length + 1}`;
    const nextTabs = [...tabs, { id, label, removable: true, draggable: true }];
    setTabs(nextTabs);
    setActiveTabId(id);
  };

  const handleRemoveTab = (id: string) => {
    const nextTabs = tabs.filter((tab) => tab.id !== id);
    setTabs(nextTabs);
    if (activeTabId === id && nextTabs.length > 0) {
      setActiveTabId(nextTabs[0].id);
    }
  };

  const renderDashboardWidgets = () => (
    <div ref={containerRef} style={{ width: '100%' }}>
      {mounted && (
        <Responsive
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          width={width}
          rowHeight={44}
          margin={[10, 10]}
          containerPadding={[0, 0]}
          onLayoutChange={(_layout: Layout, nextLayouts: DashboardLayouts) => setLayouts(nextLayouts)}
          dragConfig={{
            enabled: true,
            handle: '.drag-handle',
            cancel: ".nodrag, input, textarea, button, select, option, a, [contenteditable='true']"
          }}
          resizeConfig={{ enabled: true }}
        >
          <div key="todo" className="overflow-hidden rounded-lg border border-border/60 bg-card">
            <div className="drag-handle flex cursor-grab items-center justify-between border-b border-border/60 bg-muted/40 px-2 py-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ListTodo className="h-3.5 w-3.5" />
                Todo
              </span>
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="nodrag space-y-2 p-2">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => handleToggleTask(task.id)}
                  className={`flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                    task.done
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-border/60 bg-background/70 text-foreground/90 hover:border-primary/40'
                  }`}
                >
                  <span className="truncate">{task.label}</span>
                  <CheckCircle2 className={`h-3.5 w-3.5 ${task.done ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                </button>
              ))}
              <div className="flex gap-1.5">
                <Input
                  value={newTask}
                  onChange={(event) => setNewTask(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAddTask();
                    }
                  }}
                  placeholder="Quick add task..."
                  className="h-8 text-xs"
                />
                <Button type="button" size="sm" className="h-8 px-2" onClick={handleAddTask}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <div key="schedule" className="overflow-hidden rounded-lg border border-border/60 bg-card">
            <div className="drag-handle flex cursor-grab items-center justify-between border-b border-border/60 bg-muted/40 px-2 py-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Today Schedule
              </span>
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="nodrag space-y-1.5 p-2">
              {scheduleItems.map((item) => (
                <div key={item.time} className="rounded-md border border-border/60 bg-background/70 px-2 py-1.5 text-xs">
                  <div className="text-muted-foreground">{item.time}</div>
                  <div className="font-medium text-foreground">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div key="notes" className="overflow-hidden rounded-lg border border-border/60 bg-card">
            <div className="drag-handle flex cursor-grab items-center justify-between border-b border-border/60 bg-muted/40 px-2 py-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Settings2 className="h-3.5 w-3.5" />
                Notes
              </span>
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="nodrag p-2">
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-[108px] resize-none text-xs"
              />
            </div>
          </div>
        </Responsive>
      )}
    </div>
  );

  return (
    <section
      aria-label="Interactive Semester Dashboard mock preview"
      className="mx-auto w-[min(100%-2rem,76rem)] rounded-2xl border border-border/60 bg-card/75 p-4 shadow-xl backdrop-blur-xl md:p-6"
    >
      <div className="sticky-page-header rounded-xl border border-border bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-3xl font-bold tracking-tight">Spring 2026</h3>
            <div className="mt-3 flex flex-wrap gap-6 overflow-hidden select-none">
              <div className="min-w-[72px]">
                <div className="text-xs uppercase tracking-wider text-muted-foreground/80">Credits</div>
                <div className="text-2xl font-semibold">18.0</div>
              </div>
              <div className="min-w-[96px]">
                <div className="text-xs uppercase tracking-wider text-muted-foreground/80">Avg</div>
                <div className="text-2xl font-semibold">92.1%</div>
              </div>
              <div className="min-w-[80px]">
                <div className="text-xs uppercase tracking-wider text-muted-foreground/80">GPA</div>
                <div className="text-2xl font-semibold">3.84</div>
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {completedTaskCount}/{tasks.length} tasks completed
          </div>
        </div>

        <div className="mt-4">
          <Tabs
            items={tabs}
            activeId={activeTabId}
            onSelect={setActiveTabId}
            onRemove={handleRemoveTab}
            onReorder={handleReorderTabs}
            onAdd={handleAddTab}
          />
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-border/60 bg-background/60 p-3">
        {activeTabId === 'dashboard' ? (
          renderDashboardWidgets()
        ) : activeTabId === 'planner' ? (
          <Card className="border-border/60 bg-background/75">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Planner</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Use Dashboard tab for drag-and-drop widgets.</p>
              <p>Planner tab is for semester-level planning notes and routines.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/60 bg-background/75">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Tab Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>This mirrors semester homepage tab-level settings placement.</p>
              <p>Try adding/removing/reordering tabs above.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
};
