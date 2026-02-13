export interface TodoBehaviorSettings {
  moveCompletedToCompletedSection: boolean;
}

export const DEFAULT_TODO_BEHAVIOR_SETTINGS: TodoBehaviorSettings = {
  moveCompletedToCompletedSection: true,
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const normalizeTodoBehaviorSettings = (settings: unknown): TodoBehaviorSettings => {
  const root = isRecord(settings) ? settings : {};
  const source = isRecord(root.todoBehavior) ? root.todoBehavior : {};

  return {
    moveCompletedToCompletedSection:
      typeof source.moveCompletedToCompletedSection === 'boolean'
        ? source.moveCompletedToCompletedSection
        : DEFAULT_TODO_BEHAVIOR_SETTINGS.moveCompletedToCompletedSection,
  };
};

export const patchTodoBehaviorSettings = (
  settings: unknown,
  patch: Partial<TodoBehaviorSettings>,
): Record<string, unknown> => {
  const root = isRecord(settings) ? settings : {};
  const current = normalizeTodoBehaviorSettings(settings);

  return {
    ...root,
    todoBehavior: {
      ...current,
      ...patch,
    },
  };
};
