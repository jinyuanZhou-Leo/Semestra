export interface TodoBehaviorSettings {
  moveCompletedToCompletedSection: boolean;
}

export const DEFAULT_TODO_BEHAVIOR_SETTINGS: TodoBehaviorSettings = {
  moveCompletedToCompletedSection: true,
};

export const normalizeTodoBehaviorSettings = (settings: Record<string, unknown>): TodoBehaviorSettings => {
  return {
    moveCompletedToCompletedSection:
      typeof settings.moveCompletedToCompletedSection === 'boolean'
        ? settings.moveCompletedToCompletedSection
        : DEFAULT_TODO_BEHAVIOR_SETTINGS.moveCompletedToCompletedSection,
  };
};
