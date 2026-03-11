// input:  [Todo runtime state, dialog drafts, and calendar/todo synchronization metadata]
// output: [Todo domain types for tasks, sections, mirrored storage, and semester/course view models]
// pos:    [Type layer shared by the Todo tab runtime, helpers, dialogs, and calendar integration]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to
export type TodoPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TodoSortMode = 'created' | 'due-date' | 'priority' | 'title';
export type TodoSortDirection = 'asc' | 'desc';

export type TodoListSource = 'course' | 'semester';

export type TodoTabMode = 'course' | 'semester' | 'unsupported';

export interface TodoSection {
  id: string;
  name: string;
  order: number;
  isSystem?: boolean;
}

export interface TodoTask {
  id: string;
  title: string;
  description: string;
  sectionId: string;
  originSectionId: string | undefined;
  courseId: string;
  courseName: string;
  courseCategory: string;
  dueDate: string;
  dueTime: string;
  priority: TodoPriority;
  completed: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface TodoListStorage {
  sections: TodoSection[];
  tasks: TodoTask[];
}

export interface TodoCourseOption {
  id: string;
  name: string;
  category: string;
}

export interface TodoListModel extends TodoListStorage {
  id: string;
  name: string;
  source: TodoListSource;
  canManageSections: boolean;
  showCourseTag: boolean;
  courseId?: string;
}

export interface TodoSemesterState extends TodoListStorage {
  courseOptions: TodoCourseOption[];
}

export interface TaskDraft {
  title: string;
  description: string;
  sectionId: string;
  courseId: string;
  dueDate: string;
  dueTime: string;
  priority: TodoPriority;
}

export interface TodoPriorityOption {
  value: TodoPriority;
  label: string;
  className: string;
  weight: number;
}

export interface TodoSortOption {
  value: TodoSortMode;
  label: string;
}
