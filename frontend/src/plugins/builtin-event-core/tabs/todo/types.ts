export type TodoPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TodoSortMode = 'created' | 'due-date' | 'priority' | 'title';
export type TodoSortDirection = 'asc' | 'desc';

export type TodoListSource = 'course' | 'semester-custom';

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

export interface SemesterCustomListStorage extends TodoListStorage {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface TodoListModel extends TodoListStorage {
  id: string;
  name: string;
  source: TodoListSource;
  editableName: boolean;
  courseId?: string;
}

export interface SemesterCourseListState extends TodoListStorage {
  courseId: string;
  courseName: string;
  tabId?: string;
  baseSettings: Record<string, unknown>;
}

export interface TaskDraft {
  title: string;
  description: string;
  sectionId: string;
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
