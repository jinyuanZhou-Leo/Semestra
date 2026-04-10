// input:  [Program-scoped tab-settings payloads, Semester/Course records, and Program Home UI mutations from pages and settings panels]
// output: [Program Home constants, typed config helpers, pin/layout mutation utilities, card-dimension helpers, and deterministic sorting/layout builders]
// pos:    [Shared Program Home state helper layer that keeps the active Program landing page, settings toggles, responsive Focus Board persistence, and layout sizing on one schema]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { Course, Semester, TabSetting } from '@/services/api';

export const PROGRAM_HOME_TAB_TYPE = 'builtin-program-home';

export type ProgramHomeCardSize = 'small' | 'medium' | 'large';
export type ProgramHomeSortMode = 'manual' | 'type' | 'name' | 'chronology';
export type ProgramHomeEntityType = 'semester' | 'course';

export interface ProgramHomeLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ProgramHomeResponsiveLayout {
  desktop?: ProgramHomeLayout;
  mobile?: ProgramHomeLayout;
}

export interface ProgramHomeItem {
  entity_type: ProgramHomeEntityType;
  entity_id: string;
  size: ProgramHomeCardSize;
  layout?: ProgramHomeResponsiveLayout;
  created_at?: string;
}

export interface ProgramHomeSettings {
  sort_mode: ProgramHomeSortMode;
  items: ProgramHomeItem[];
}

export interface ProgramHomeResolvedEntity {
  entityType: ProgramHomeEntityType;
  entityId: string;
  title: string;
  subtitle?: string;
  chronologyKey: string;
  item: ProgramHomeItem;
  semester?: Semester;
  course?: Course & {
    semesterName: string;
    semesterStartDate?: string | null;
  };
}

export const DEFAULT_PROGRAM_HOME_SETTINGS: ProgramHomeSettings = {
  sort_mode: 'manual',
  items: [],
};

const PROGRAM_HOME_DESKTOP_SIZE_MAP: Record<ProgramHomeCardSize, { w: number; h: number }> = {
  small: { w: 1, h: 2 },
  medium: { w: 2, h: 1 },
  large: { w: 2, h: 2 },
};

const PROGRAM_HOME_MOBILE_SIZE_MAP: Record<ProgramHomeCardSize, { w: number; h: number }> = {
  small: { w: 1, h: 2 },
  medium: { w: 2, h: 1 },
  large: { w: 2, h: 2 },
};

export const getProgramHomeCardDimensions = (
  size: ProgramHomeCardSize,
  device: 'desktop' | 'mobile',
): { w: number; h: number } => (
  device === 'desktop' ? PROGRAM_HOME_DESKTOP_SIZE_MAP[size] : PROGRAM_HOME_MOBILE_SIZE_MAP[size]
);

const parseJsonObject = (value: string | Record<string, unknown> | null | undefined): Record<string, unknown> => {
  if (!value) {
    return {};
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const normalizeLayout = (value: unknown): ProgramHomeLayout | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  const { x, y, w, h } = candidate;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(w) || !isFiniteNumber(h)) {
    return undefined;
  }
  return { x, y, w, h };
};

const normalizeResponsiveLayout = (value: unknown): ProgramHomeResponsiveLayout | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  const desktop = normalizeLayout(candidate.desktop);
  const mobile = normalizeLayout(candidate.mobile);
  if (!desktop && !mobile) {
    return undefined;
  }
  return { desktop, mobile };
};

const normalizeItem = (value: unknown): ProgramHomeItem | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const entityType = candidate.entity_type;
  const entityId = candidate.entity_id;
  const size = candidate.size;
  if ((entityType !== 'semester' && entityType !== 'course') || typeof entityId !== 'string' || !entityId) {
    return null;
  }
  if (size !== 'small' && size !== 'medium' && size !== 'large') {
    return null;
  }

  return {
    entity_type: entityType,
    entity_id: entityId,
    size,
    layout: normalizeResponsiveLayout(candidate.layout),
    created_at: typeof candidate.created_at === 'string' ? candidate.created_at : undefined,
  };
};

export const getProgramHomeItemKey = (entityType: ProgramHomeEntityType, entityId: string) => `${entityType}:${entityId}`;

export const parseProgramHomeSettings = (tabSettings: TabSetting[] | undefined): ProgramHomeSettings => {
  const tabSetting = tabSettings?.find((entry) => entry.settings_key === PROGRAM_HOME_TAB_TYPE);
  if (!tabSetting) {
    return DEFAULT_PROGRAM_HOME_SETTINGS;
  }
  const parsed = parseJsonObject(tabSetting.resolved_settings ?? tabSetting.settings);
  const sortMode = parsed.sort_mode;
  const items = Array.isArray(parsed.items)
    ? parsed.items.map(normalizeItem).filter((item): item is ProgramHomeItem => item !== null)
    : [];

  return {
    sort_mode: sortMode === 'type' || sortMode === 'name' || sortMode === 'chronology' ? sortMode : 'manual',
    items,
  };
};

export const serializeProgramHomeSettings = (settings: ProgramHomeSettings): string => {
  return JSON.stringify({
    sort_mode: settings.sort_mode,
    items: settings.items.map((item) => ({
      entity_type: item.entity_type,
      entity_id: item.entity_id,
      size: item.size,
      layout: item.layout,
      created_at: item.created_at,
    })),
  });
};

export const replaceProgramHomeTabSetting = (
  tabSettings: TabSetting[] | undefined,
  settings: ProgramHomeSettings,
): TabSetting[] => {
  const nextTabSetting: TabSetting = {
    id: PROGRAM_HOME_TAB_TYPE,
    settings_key: PROGRAM_HOME_TAB_TYPE,
    settings: serializeProgramHomeSettings(settings),
    resolved_settings: {
      sort_mode: settings.sort_mode,
      items: settings.items,
    },
  };
  const entries = tabSettings ?? [];
  const index = entries.findIndex((entry) => entry.settings_key === PROGRAM_HOME_TAB_TYPE);
  if (index < 0) {
    return [...entries, nextTabSetting];
  }
  return entries.map((entry, entryIndex) => (entryIndex === index ? nextTabSetting : entry));
};

const createDefaultLayout = (
  size: ProgramHomeCardSize,
  index: number,
): ProgramHomeResponsiveLayout => {
  const desktopSize = PROGRAM_HOME_DESKTOP_SIZE_MAP[size];
  const desktopCols = 12;
  const desktopColumnSpan = Math.max(1, Math.floor(desktopCols / desktopSize.w));
  const desktopRow = Math.floor(index / desktopColumnSpan);
  const desktopColumn = index % desktopColumnSpan;

  return {
    desktop: {
      x: desktopColumn * desktopSize.w,
      y: desktopRow * desktopSize.h,
      w: desktopSize.w,
      h: desktopSize.h,
    },
    mobile: {
      x: 0,
      y: index * getProgramHomeCardDimensions(size, 'mobile').h,
      w: getProgramHomeCardDimensions(size, 'mobile').w,
      h: getProgramHomeCardDimensions(size, 'mobile').h,
    },
  };
};

export const upsertProgramHomeItem = (
  settings: ProgramHomeSettings,
  entityType: ProgramHomeEntityType,
  entityId: string,
  size: ProgramHomeCardSize = 'medium',
): ProgramHomeSettings => {
  if (settings.items.some((item) => item.entity_type === entityType && item.entity_id === entityId)) {
    return settings;
  }
  const nextItem: ProgramHomeItem = {
    entity_type: entityType,
    entity_id: entityId,
    size,
    layout: createDefaultLayout(size, settings.items.length),
    created_at: new Date().toISOString(),
  };
  return {
    ...settings,
    items: [...settings.items, nextItem],
  };
};

export const removeProgramHomeItem = (
  settings: ProgramHomeSettings,
  entityType: ProgramHomeEntityType,
  entityId: string,
): ProgramHomeSettings => ({
  ...settings,
  items: settings.items.filter((item) => !(item.entity_type === entityType && item.entity_id === entityId)),
});

export const updateProgramHomeItemSize = (
  settings: ProgramHomeSettings,
  entityType: ProgramHomeEntityType,
  entityId: string,
  size: ProgramHomeCardSize,
): ProgramHomeSettings => ({
  ...settings,
  items: settings.items.map((item, index) => {
    if (item.entity_type !== entityType || item.entity_id !== entityId) {
      return item;
    }
    const nextDesktopLayout = item.layout?.desktop
      ? { ...item.layout.desktop, ...PROGRAM_HOME_DESKTOP_SIZE_MAP[size] }
      : createDefaultLayout(size, index).desktop;
    const nextMobileLayout = item.layout?.mobile
      ? { ...item.layout.mobile, ...getProgramHomeCardDimensions(size, 'mobile') }
      : createDefaultLayout(size, index).mobile;
    return {
      ...item,
      size,
      layout: {
        desktop: nextDesktopLayout,
        mobile: nextMobileLayout,
      },
    };
  }),
});

export const setProgramHomeItemLayout = (
  settings: ProgramHomeSettings,
  entityType: ProgramHomeEntityType,
  entityId: string,
  device: 'desktop' | 'mobile',
  layout: ProgramHomeLayout,
): ProgramHomeSettings => ({
  ...settings,
  items: settings.items.map((item) => {
    if (item.entity_type !== entityType || item.entity_id !== entityId) {
      return item;
    }
    return {
      ...item,
      layout: {
        ...item.layout,
        [device]: layout,
      },
    };
  }),
});

export const isProgramHomePinned = (
  settings: ProgramHomeSettings,
  entityType: ProgramHomeEntityType,
  entityId: string,
): boolean => settings.items.some((item) => item.entity_type === entityType && item.entity_id === entityId);

export const resolveProgramHomeEntities = (
  settings: ProgramHomeSettings,
  semesters: Semester[] | undefined,
  programCourses: Array<Course & { semesterName: string; semesterStartDate?: string | null }>,
): ProgramHomeResolvedEntity[] => {
  const semesterMap = new Map(
    (semesters ?? [])
      .filter((semester) => semester.lifecycle_state !== 'draft')
      .map((semester) => [semester.id, semester] as const),
  );
  const courseMap = new Map(programCourses.map((course) => [course.id, course] as const));

  return settings.items.reduce<ProgramHomeResolvedEntity[]>((resolved, item) => {
    if (item.entity_type === 'semester') {
      const semester = semesterMap.get(item.entity_id);
      if (!semester) {
        return resolved;
      }
      resolved.push({
        entityType: 'semester' as const,
        entityId: semester.id,
        title: semester.name,
        chronologyKey: semester.start_date ?? '',
        item,
        semester,
      });
      return resolved;
    }

    const course = courseMap.get(item.entity_id);
    if (!course) {
      return resolved;
    }
    resolved.push({
      entityType: 'course' as const,
      entityId: course.id,
      title: course.name,
      subtitle: course.semesterName,
      chronologyKey: course.semesterStartDate ?? '',
      item,
      course,
    });
    return resolved;
  }, []);
};

export const sortProgramHomeEntities = (
  entities: ProgramHomeResolvedEntity[],
  sortMode: ProgramHomeSortMode,
): ProgramHomeResolvedEntity[] => {
  if (sortMode === 'manual') {
    return entities;
  }
  const sorted = [...entities];
  sorted.sort((left, right) => {
    if (sortMode === 'type') {
      if (left.entityType !== right.entityType) {
        return left.entityType.localeCompare(right.entityType);
      }
      return left.title.localeCompare(right.title);
    }
    if (sortMode === 'name') {
      if (left.title !== right.title) {
        return left.title.localeCompare(right.title);
      }
      return left.entityType.localeCompare(right.entityType);
    }
    if (left.chronologyKey !== right.chronologyKey) {
      return left.chronologyKey.localeCompare(right.chronologyKey);
    }
    if (left.entityType !== right.entityType) {
      return left.entityType.localeCompare(right.entityType);
    }
    return left.title.localeCompare(right.title);
  });
  return sorted;
};

export const buildArrangedProgramHomeLayouts = (
  entities: ProgramHomeResolvedEntity[],
  device: 'desktop' | 'mobile',
  colsOverride?: number,
): Map<string, ProgramHomeLayout> => {
  const layouts = new Map<string, ProgramHomeLayout>();
  const cols = colsOverride ?? (device === 'desktop' ? 12 : 4);
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  entities.forEach((entity) => {
    const nextSize = getProgramHomeCardDimensions(entity.item.size, device);
    if (cursorX + nextSize.w > cols) {
      cursorX = 0;
      cursorY += rowHeight;
      rowHeight = 0;
    }
    layouts.set(getProgramHomeItemKey(entity.entityType, entity.entityId), {
      x: cursorX,
      y: cursorY,
      w: nextSize.w,
      h: nextSize.h,
    });
    cursorX += nextSize.w;
    rowHeight = Math.max(rowHeight, nextSize.h);
  });

  return layouts;
};
