// input:  [Program Home pinned-item settings helpers, resolved Program/Semester/Course entities, and user-driven Focus Board drag targets]
// output: [`FOCUS_BOARD_ROWS`, Focus Board layout item types, two-row packing/drag solver helpers, and settings/layout reconciliation utilities]
// pos:    [Program Focus Board layout engine that owns bounded two-row packing, row-aware collision avoidance, drag preview solving, and settings normalization outside the view component]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { Course, Semester } from '@/services/api';
import {
  getProgramHomeCardDimensions,
  getProgramHomeItemKey,
  resolveProgramHomeEntities,
  setProgramHomeItemLayout,
  sortProgramHomeEntities,
  type ProgramHomeEntityType,
  type ProgramHomeResolvedEntity,
  type ProgramHomeSettings,
} from '@/utils/programHome';

export const FOCUS_BOARD_ROWS = 2;

export interface FocusBoardLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ResponsiveStripLayouts = {
  lg: FocusBoardLayoutItem[];
  sm: FocusBoardLayoutItem[];
};

export type FocusBoardSizeMap = Map<string, { w: number; h: number }>;

type ProgramCourseWithContext = Course & {
  semesterName: string;
  semesterStartDate?: string | null;
};

type StripLayout = { x: number; y: number; w: number; h: number };

type BoardDevice = 'desktop' | 'mobile';

const clampStripY = (y: number, h: number) => Math.max(0, Math.min(y, FOCUS_BOARD_ROWS - h));

const normalizeStripLayoutItem = (
  layout: StripLayout,
  size: { w: number; h: number },
): StripLayout => ({
  x: Math.max(0, Math.round(layout.x)),
  y: clampStripY(Math.round(layout.y), size.h),
  w: size.w,
  h: size.h,
});

const overlaps = (left: StripLayout, right: StripLayout) => (
  left.x < right.x + right.w
  && left.x + left.w > right.x
  && left.y < right.y + right.h
  && left.y + left.h > right.y
);

const canPlace = (
  placed: readonly FocusBoardLayoutItem[],
  candidate: StripLayout,
  ignoreId?: string,
) => (
  placed.every((item) => item.i === ignoreId || !overlaps(item, candidate))
);

const getPreferredRows = (height: number, preferredY: number | undefined) => {
  const allowedRows = getAllowedRows(height);
  if (allowedRows.length === 1) {
    return allowedRows;
  }
  const normalizedPreferredY = clampStripY(preferredY ?? 0, height);
  return allowedRows[0] === normalizedPreferredY
    ? allowedRows
    : [normalizedPreferredY, ...allowedRows.filter((row) => row !== normalizedPreferredY)];
};

const findBestPlacement = (
  placed: readonly FocusBoardLayoutItem[],
  candidate: StripLayout,
  minX: number,
  preferredY = candidate.y,
  ignoreId?: string,
) => {
  let nextX = Math.max(0, minX);
  const preferredRows = getPreferredRows(candidate.h, preferredY);

  while (true) {
    for (const row of preferredRows) {
      const nextCandidate = { ...candidate, x: nextX, y: row };
      if (canPlace(placed, nextCandidate, ignoreId)) {
        return nextCandidate;
      }
    }
    nextX += 1;
  }
};

const getAllowedRows = (height: number): number[] => {
  if (height >= FOCUS_BOARD_ROWS) {
    return [0];
  }
  return [0, 1];
};

const placeFirstFit = (
  placed: readonly FocusBoardLayoutItem[],
  size: { w: number; h: number },
  startX = 0,
) => {
  let scanX = Math.max(0, startX);
  const allowedRows = getAllowedRows(size.h);

  while (true) {
    for (const row of allowedRows) {
      const candidate = { x: scanX, y: row, w: size.w, h: size.h };
      if (canPlace(placed, candidate)) {
        return candidate;
      }
    }
    scanX += 1;
  }
};

const toLayoutMap = (layout: readonly FocusBoardLayoutItem[]) => {
  const map = new Map<string, FocusBoardLayoutItem>();
  layout.forEach((item) => map.set(item.i, item));
  return map;
};

const sortByPosition = (layout: readonly FocusBoardLayoutItem[]) => (
  [...layout].sort((left, right) => {
    if (left.x !== right.x) {
      return left.x - right.x;
    }
    if (left.y !== right.y) {
      return left.y - right.y;
    }
    return left.i.localeCompare(right.i);
  })
);

export const getFocusBoardLayoutCols = (layout: readonly FocusBoardLayoutItem[]) => (
  Math.max(1, ...layout.map((item) => item.x + item.w))
);

export const buildFocusBoardSizeMap = (
  entities: readonly ProgramHomeResolvedEntity[],
  device: BoardDevice,
): FocusBoardSizeMap => {
  const sizeById: FocusBoardSizeMap = new Map();
  entities.forEach((entity) => {
    sizeById.set(
      getProgramHomeItemKey(entity.entityType, entity.entityId),
      getProgramHomeCardDimensions(entity.item.size, device),
    );
  });
  return sizeById;
};

export const sanitizeInteractiveStripLayoutWithSizeMap = (
  layout: readonly FocusBoardLayoutItem[],
  sizeById: FocusBoardSizeMap,
) => {
  const placed: FocusBoardLayoutItem[] = [];
  sortByPosition(layout).forEach((item) => {
    const size = sizeById.get(item.i) ?? { w: item.w, h: item.h };
    const normalized = normalizeStripLayoutItem(item, size);
    const nextPlacement = findBestPlacement(placed, normalized, normalized.x, normalized.y);
    placed.push({ i: item.i, ...nextPlacement });
  });

  const placedMap = toLayoutMap(placed);
  return layout.map((item) => placedMap.get(item.i) ?? item);
};

export const sanitizeInteractiveStripLayout = (
  layout: readonly FocusBoardLayoutItem[],
  entities: readonly ProgramHomeResolvedEntity[],
  device: BoardDevice,
) => {
  return sanitizeInteractiveStripLayoutWithSizeMap(layout, buildFocusBoardSizeMap(entities, device));
};

export const solveFocusBoardDragLayoutWithSizeMap = (
  layout: readonly FocusBoardLayoutItem[],
  draggedId: string,
  target: { x: number; y: number },
  sizeById: FocusBoardSizeMap,
) => {
  const originalMap = toLayoutMap(layout);
  const draggedOriginal = originalMap.get(draggedId);
  if (!draggedOriginal) {
    return [...layout];
  }

  const draggedSize = sizeById.get(draggedId) ?? { w: draggedOriginal.w, h: draggedOriginal.h };
  const draggedLayout = normalizeStripLayoutItem(
    { ...draggedOriginal, x: target.x, y: target.y },
    draggedSize,
  );

  const remainingItems = sortByPosition(
    layout.filter((item) => item.i !== draggedId),
  );

  const placed: FocusBoardLayoutItem[] = [{
    i: draggedId,
    ...draggedLayout,
  }];

  remainingItems.forEach((item) => {
    const size = sizeById.get(item.i) ?? { w: item.w, h: item.h };
    const normalized = normalizeStripLayoutItem(item, size);
    const nextPlacement = findBestPlacement(placed, normalized, 0, normalized.y);
    placed.push({ i: item.i, ...nextPlacement });
  });

  const nextMap = toLayoutMap(placed);
  return layout.map((item) => nextMap.get(item.i) ?? item);
};

export const solveFocusBoardDragLayout = (
  layout: readonly FocusBoardLayoutItem[],
  draggedId: string,
  target: { x: number; y: number },
  entities: readonly ProgramHomeResolvedEntity[],
  device: BoardDevice,
) => {
  return solveFocusBoardDragLayoutWithSizeMap(
    layout,
    draggedId,
    target,
    buildFocusBoardSizeMap(entities, device),
  );
};

export const buildStripLayouts = (
  entities: readonly ProgramHomeResolvedEntity[],
  device: BoardDevice,
  useManualLayouts: boolean,
) => {
  const placed: FocusBoardLayoutItem[] = [];
  const layouts = new Map<string, StripLayout>();

  const manualEntries = useManualLayouts
    ? entities
      .map((entity, index) => {
        const size = getProgramHomeCardDimensions(entity.item.size, device);
        const manual = device === 'desktop' ? entity.item.layout?.desktop : entity.item.layout?.mobile;
        if (!manual || manual.w !== size.w || manual.h !== size.h) {
          return null;
        }
        return {
          entity,
          index,
          manual: normalizeStripLayoutItem(manual, size),
        };
      })
      .filter((entry): entry is { entity: ProgramHomeResolvedEntity; index: number; manual: StripLayout } => entry !== null)
      .sort((left, right) => {
        if (left.manual.x !== right.manual.x) {
          return left.manual.x - right.manual.x;
        }
        if (left.manual.y !== right.manual.y) {
          return left.manual.y - right.manual.y;
        }
        return left.index - right.index;
      })
    : [];

  manualEntries.forEach(({ entity, manual }) => {
    const key = getProgramHomeItemKey(entity.entityType, entity.entityId);
    const nextPlacement = findBestPlacement(placed, manual, manual.x, manual.y);
    const resolved = { i: key, ...nextPlacement };
    placed.push(resolved);
    layouts.set(key, { x: resolved.x, y: resolved.y, w: resolved.w, h: resolved.h });
  });

  const manualKeys = new Set(manualEntries.map(({ entity }) => getProgramHomeItemKey(entity.entityType, entity.entityId)));
  const appendStartX = getFocusBoardLayoutCols(placed);

  entities.forEach((entity) => {
    const key = getProgramHomeItemKey(entity.entityType, entity.entityId);
    if (manualKeys.has(key)) {
      return;
    }
    const size = getProgramHomeCardDimensions(entity.item.size, device);
    const nextLayout = placeFirstFit(placed, size, useManualLayouts ? appendStartX : 0);
    const resolved = { i: key, ...nextLayout };
    placed.push(resolved);
    layouts.set(key, nextLayout);
  });

  return {
    layouts,
    cols: getFocusBoardLayoutCols(placed),
  };
};

export const buildResponsiveLayoutsFromStrip = (
  entities: readonly ProgramHomeResolvedEntity[],
  desktopStrip: { layouts: Map<string, StripLayout> },
  mobileStrip: { layouts: Map<string, StripLayout> },
): ResponsiveStripLayouts => ({
  lg: entities.map((entity) => {
    const key = getProgramHomeItemKey(entity.entityType, entity.entityId);
    const layout = desktopStrip.layouts.get(key);
    const size = getProgramHomeCardDimensions(entity.item.size, 'desktop');
    return { i: key, x: layout?.x ?? 0, y: layout?.y ?? 0, w: size.w, h: size.h };
  }),
  sm: entities.map((entity) => {
    const key = getProgramHomeItemKey(entity.entityType, entity.entityId);
    const layout = mobileStrip.layouts.get(key);
    const size = getProgramHomeCardDimensions(entity.item.size, 'mobile');
    return { i: key, x: layout?.x ?? 0, y: layout?.y ?? 0, w: size.w, h: size.h };
  }),
});

export const rebuildFocusBoardLayouts = (
  nextSettings: ProgramHomeSettings,
  semesters: Semester[] | undefined,
  programCourses: ProgramCourseWithContext[],
) => {
  const nextEntities = sortProgramHomeEntities(
    resolveProgramHomeEntities(nextSettings, semesters, programCourses),
    nextSettings.sort_mode,
  );
  const useManualLayouts = nextSettings.sort_mode === 'manual';
  const nextDesktopStrip = buildStripLayouts(nextEntities, 'desktop', useManualLayouts);
  const nextMobileStrip = buildStripLayouts(nextEntities, 'mobile', useManualLayouts);

  let normalizedSettings = nextSettings;
  nextEntities.forEach((entity) => {
    const key = getProgramHomeItemKey(entity.entityType, entity.entityId);
    const desktopLayout = nextDesktopStrip.layouts.get(key);
    const mobileLayout = nextMobileStrip.layouts.get(key);

    if (desktopLayout) {
      normalizedSettings = setProgramHomeItemLayout(
        normalizedSettings,
        entity.entityType,
        entity.entityId,
        'desktop',
        desktopLayout,
      );
    }

    if (mobileLayout) {
      normalizedSettings = setProgramHomeItemLayout(
        normalizedSettings,
        entity.entityType,
        entity.entityId,
        'mobile',
        mobileLayout,
      );
    }
  });

  return {
    settings: normalizedSettings,
    layouts: buildResponsiveLayoutsFromStrip(nextEntities, nextDesktopStrip, nextMobileStrip),
  };
};

export const applyStripLayoutToSettings = (
  settings: ProgramHomeSettings,
  layout: readonly FocusBoardLayoutItem[],
  device: BoardDevice,
): ProgramHomeSettings => {
  let nextSettings = settings;
  layout.forEach((item) => {
    const [entityType, entityId] = item.i.split(':') as [ProgramHomeEntityType, string];
    nextSettings = setProgramHomeItemLayout(nextSettings, entityType, entityId, device, {
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    });
  });
  return nextSettings;
};
