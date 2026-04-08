// input:  [current Program data, Program-level Semester/Course collections, shared Program Home config helpers, shadcn dialog/dropdown/select primitives, and the Focus Board two-row layout engine]
// output: [`ProgramFocusBoard` component rendering the Program Home Focus Board add/sort/drag flows plus split Semester/Course add lists and absolute-positioned horizontally scrolling card layouts]
// pos:    [Program-home-only board surface that lets users pin Semesters/Courses, distinguish them visually, reorder them inside a fixed-height horizontal strip, and persist fixed discrete desktop/mobile card layouts without introducing a separate backend model]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { ResponsiveDialogDrawer } from '@/components/ResponsiveDialogDrawer';
import { AppEmptyState } from '@/components/AppEmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Course, Program, Semester } from '@/services/api';
import {
  FOCUS_BOARD_ROWS,
  applyStripLayoutToSettings,
  buildStripLayouts,
  buildResponsiveLayoutsFromStrip,
  getFocusBoardLayoutCols,
  rebuildFocusBoardLayouts,
  sanitizeInteractiveStripLayout,
  solveFocusBoardDragLayout,
  type FocusBoardLayoutItem,
  type ResponsiveStripLayouts,
} from './FocusBoardLayout';
import {
  getProgramHomeItemKey,
  isProgramHomePinned,
  removeProgramHomeItem,
  resolveProgramHomeEntities,
  sortProgramHomeEntities,
  type ProgramHomeCardSize,
  type ProgramHomeEntityType,
  type ProgramHomeResolvedEntity,
  type ProgramHomeSettings,
  type ProgramHomeSortMode,
  upsertProgramHomeItem,
  updateProgramHomeItemSize,
} from '@/utils/programHome';
import { getCourseBadgeStyle, resolveCourseColor } from '@/utils/courseCategoryBadge';
import {
  BookOpen,
  CalendarDays,
  Check,
  Ellipsis,
  Pencil,
  Pin,
  Plus,
  Rows3,
} from 'lucide-react';

const GRID_BREAKPOINTS = { lg: 768 } as const;
const BOARD_METRICS = {
  desktop: {
    columnWidth: 88,
    rowHeight: 88,
    gap: 8,
  },
  mobile: {
    columnWidth: 72,
    rowHeight: 72,
    gap: 8,
  },
} as const;
const AUTO_SCROLL_EDGE_PX = 80;
const AUTO_SCROLL_MAX_STEP = 20;

const getColsForPixelWidth = (
  pixelWidth: number,
  metrics: { columnWidth: number; gap: number },
) => {
  if (pixelWidth <= 0) {
    return 1;
  }
  return Math.max(1, Math.floor((pixelWidth + metrics.gap) / (metrics.columnWidth + metrics.gap)));
};

const getAxisSpan = (length: number, unit: number, gap: number) => (
  length * unit + Math.max(0, length - 1) * gap
);

type CandidateSortMode = 'name' | 'chronology';

type ProgramCourseWithContext = Course & {
  semesterName: string;
  semesterStartDate?: string | null;
};

type DragRuntimeState = {
  id: string;
  device: 'desktop' | 'mobile';
  grabOffsetX: number;
  grabOffsetY: number;
};

type ViewportLayoutState = {
  isReady: boolean;
  isMobile: boolean;
  desktopVisibleCols: number;
  mobileVisibleCols: number;
};

const areLayoutItemsEqual = (
  left: readonly FocusBoardLayoutItem[],
  right: readonly FocusBoardLayoutItem[],
) => {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftItem = left[index];
    const rightItem = right[index];
    if (
      leftItem.i !== rightItem.i
      || leftItem.x !== rightItem.x
      || leftItem.y !== rightItem.y
      || leftItem.w !== rightItem.w
      || leftItem.h !== rightItem.h
    ) {
      return false;
    }
  }

  return true;
};

interface ProgramFocusBoardProps {
  program: Program & { semesters?: Semester[] };
  programCourses: ProgramCourseWithContext[];
  settings: ProgramHomeSettings;
  onCommit: (settings: ProgramHomeSettings) => Promise<void>;
}

const entityMeta = {
  semester: {
    icon: CalendarDays,
    cardClassName: 'bg-background',
  },
  course: {
    icon: BookOpen,
    cardClassName: 'bg-background',
  },
} satisfies Record<ProgramHomeEntityType, {
  icon: React.ComponentType<{ className?: string }>;
  cardClassName: string;
}>;

const sortLabelMap: Record<ProgramHomeSortMode, string> = {
  manual: 'Manual',
  type: 'Type',
  name: 'Name',
  chronology: 'Chronology',
};

const resolveLinkTarget = (entity: ProgramHomeResolvedEntity): string => (
  entity.entityType === 'semester'
    ? `/semesters/${entity.entityId}`
    : `/courses/${entity.entityId}`
);

const formatSemesterDateRange = (semester: Semester) => {
  if (!semester.start_date || !semester.end_date) {
    return 'Dates not set';
  }
  return `${semester.start_date} to ${semester.end_date}`;
};

const focusBoardCardShellClassName: Record<ProgramHomeCardSize, string> = {
  small: 'flex h-full w-full flex-col items-center justify-center gap-1.5 overflow-hidden px-2 py-2 text-center',
  medium: 'flex h-full w-full items-center gap-2 overflow-hidden px-2.5 py-2 text-left',
  large: 'flex h-full w-full flex-col items-start justify-center gap-2 overflow-hidden px-3 py-2.5 text-left',
};

const focusBoardIconClassName: Record<ProgramHomeCardSize, string> = {
  small: 'size-8',
  medium: 'size-8',
  large: 'size-9',
};

const focusBoardBodyClassName: Record<ProgramHomeCardSize, string> = {
  small: 'min-w-0 max-w-full space-y-1',
  medium: 'min-w-0 flex-1 space-y-1',
  large: 'min-w-0 w-full space-y-1.5',
};

const focusBoardTitleClassName: Record<ProgramHomeCardSize, string> = {
  small: 'line-clamp-2 text-[14px] font-semibold leading-[1.15]',
  medium: 'truncate text-[15px] font-semibold leading-[1.15]',
  large: 'line-clamp-2 text-[15px] font-semibold leading-[1.15]',
};

const focusBoardMetaTextClassName = 'truncate text-[11px] leading-[1.2] text-muted-foreground';
const focusBoardMetaRowClassName = 'flex min-w-0 items-center gap-1.5 overflow-hidden text-[11px] leading-[1.2] text-muted-foreground';
const focusBoardBadgeClassName = 'h-5 border-0 px-1.5 text-[10px] font-medium';

const FocusBoardCard: React.FC<{
  entity: ProgramHomeResolvedEntity;
  isEditing: boolean;
  isDragging: boolean;
  onChangeSize: (size: ProgramHomeCardSize) => void;
  onRemove: () => void;
}> = ({ entity, isEditing, isDragging, onChangeSize, onRemove }) => {
  const meta = entityMeta[entity.entityType];
  const Icon = meta.icon;
  const size = entity.item.size;
  const target = resolveLinkTarget(entity);
  const baseCardClassName = cn(
    'group relative h-full overflow-hidden border-border/70 shadow-none select-none transition-[border-color,box-shadow,opacity]',
    isEditing && 'border-dashed border-primary/60 ring-1 ring-primary/20',
    !isEditing && 'hover:border-primary/40',
    isDragging && 'border-primary/70 shadow-lg shadow-primary/10 opacity-95',
    meta.cardClassName,
  );

  const editControls = isEditing ? (
    <div className="pointer-events-auto absolute right-2 top-2 z-10 flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-no-drag="true"
            className="size-7 rounded-full bg-background/70 text-muted-foreground hover:bg-background"
          >
            <Ellipsis />
            <span className="sr-only">Open actions for {entity.title}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Card Size</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={size} onValueChange={(value) => onChangeSize(value as ProgramHomeCardSize)}>
            <DropdownMenuRadioItem value="small">Tall</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="medium">Wide</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="large">Square</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onRemove}>Remove</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ) : null;

  if (entity.entityType === 'semester' && entity.semester) {
    const courseCount = entity.semester.courses?.length ?? 0;
    const content = (
      <Card className={baseCardClassName}>
        {editControls}
        <CardContent className="flex h-full p-0">
          <div className={focusBoardCardShellClassName[size]}>
            <div className={cn(
              'inline-flex shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/80 text-muted-foreground',
              focusBoardIconClassName[size],
            )}>
              <Icon className="size-4" />
            </div>
            <div className={focusBoardBodyClassName[size]}>
              <div className={focusBoardTitleClassName[size]}>
                {entity.semester.name}
              </div>
              {size === 'small' ? (
                <div className="min-w-0 space-y-0.5">
                  <div className={focusBoardMetaTextClassName}>
                    {formatSemesterDateRange(entity.semester)}
                  </div>
                  <Badge variant="secondary" className={cn(focusBoardBadgeClassName, 'max-w-full')}>
                    <span className="truncate">{courseCount} course{courseCount === 1 ? '' : 's'}</span>
                  </Badge>
                </div>
              ) : null}
              {size === 'medium' ? (
                <div className={focusBoardMetaRowClassName}>
                  <span className="truncate">{formatSemesterDateRange(entity.semester)}</span>
                  <Badge variant="secondary" className={cn(focusBoardBadgeClassName, 'max-w-[4.75rem] shrink-0')}>
                    <span className="truncate">{courseCount} course{courseCount === 1 ? '' : 's'}</span>
                  </Badge>
                </div>
              ) : null}
              {size === 'large' ? (
                <>
                  <div className={focusBoardMetaTextClassName}>
                    {formatSemesterDateRange(entity.semester)}
                  </div>
                  <div className={focusBoardMetaRowClassName}>
                    <Badge variant="secondary" className={cn(focusBoardBadgeClassName, 'max-w-full')}>
                      <span className="truncate">{courseCount} course{courseCount === 1 ? '' : 's'}</span>
                    </Badge>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    );
    return isEditing ? content : <Link to={target} className="block h-full">{content}</Link>;
  }

  if (entity.entityType === 'course' && entity.course) {
    const content = (
      <Card className={baseCardClassName}>
        {editControls}
        <CardContent className="flex h-full p-0">
          <div className={focusBoardCardShellClassName[size]}>
            <div className={cn(
              'inline-flex shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/30 text-muted-foreground',
              focusBoardIconClassName[size],
            )}>
              <Icon className="size-4" />
            </div>
            <div className={focusBoardBodyClassName[size]}>
              <div className={focusBoardTitleClassName[size]}>
                {entity.course.name}
              </div>
              {size === 'medium' ? (
                <div className={focusBoardMetaRowClassName}>
                  <span className="truncate">{entity.course.alias?.trim() || entity.course.semesterName}</span>
                  {entity.course.category?.trim() ? (
                    <Badge
                      variant="outline"
                      className={cn(focusBoardBadgeClassName, 'max-w-[4.75rem] shrink-0')}
                      style={getCourseBadgeStyle(resolveCourseColor(entity.course))}
                    >
                      <span className="truncate">{entity.course.category.trim()}</span>
                    </Badge>
                  ) : null}
                </div>
              ) : null}
              {size === 'large' ? (
                <>
                  <div className={focusBoardMetaTextClassName}>
                    {entity.course.alias?.trim() || entity.course.semesterName}
                  </div>
                  <div className="flex min-w-0 items-center">
                    {entity.course.category?.trim() ? (
                      <Badge
                        variant="outline"
                        className={cn(focusBoardBadgeClassName, 'max-w-full')}
                        style={getCourseBadgeStyle(resolveCourseColor(entity.course))}
                      >
                        <span className="truncate">{entity.course.category.trim()}</span>
                      </Badge>
                    ) : (
                      <span className="truncate">{entity.course.semesterName}</span>
                    )}
                  </div>
                </>
              ) : null}
              {size === 'small' ? (
                <div className="min-w-0 space-y-0.5">
                  <div className={focusBoardMetaTextClassName}>
                    {entity.course.alias?.trim() || entity.course.semesterName}
                  </div>
                  {entity.course.category?.trim() ? (
                    <Badge
                      variant="outline"
                      className={cn(focusBoardBadgeClassName, 'max-w-full')}
                      style={getCourseBadgeStyle(resolveCourseColor(entity.course))}
                    >
                      <span className="truncate">{entity.course.category.trim()}</span>
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    );
    return isEditing ? content : <Link to={target} className="block h-full">{content}</Link>;
  }

  return null;
};

export const ProgramFocusBoard: React.FC<ProgramFocusBoardProps> = ({
  program,
  programCourses,
  settings,
  onCommit,
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragRuntimeState | null>(null);
  const rafHandleRef = useRef<number | null>(null);
  const pointerMoveFrameRef = useRef<number | null>(null);
  const resizeRafRef = useRef<number | null>(null);
  const autoScrollVelocityRef = useRef(0);
  const latestPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);

  const [viewportState, setViewportState] = useState<ViewportLayoutState>({
    isReady: false,
    isMobile: false,
    desktopVisibleCols: 1,
    mobileVisibleCols: 1,
  });
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [candidateSort, setCandidateSort] = useState<CandidateSortMode>('chronology');
  const [pendingRemove, setPendingRemove] = useState<{ entityType: ProgramHomeEntityType; entityId: string; title: string } | null>(null);
  const [interactiveLayouts, setInteractiveLayouts] = useState<ResponsiveStripLayouts | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const updateViewportState = () => {
      const nextWidth = viewport.clientWidth;
      const nextDesktopVisibleCols = getColsForPixelWidth(nextWidth, BOARD_METRICS.desktop);
      const nextMobileVisibleCols = getColsForPixelWidth(nextWidth, BOARD_METRICS.mobile);
      const nextIsMobile = nextWidth > 0 && nextWidth < GRID_BREAKPOINTS.lg;

      setViewportState((current) => {
        if (
          current.isReady
          && current.isMobile === nextIsMobile
          && current.desktopVisibleCols === nextDesktopVisibleCols
          && current.mobileVisibleCols === nextMobileVisibleCols
        ) {
          return current;
        }
        return {
          isReady: true,
          isMobile: nextIsMobile,
          desktopVisibleCols: nextDesktopVisibleCols,
          mobileVisibleCols: nextMobileVisibleCols,
        };
      });
    };

    updateViewportState();
    const observer = new ResizeObserver(() => {
      if (resizeRafRef.current !== null) {
        window.cancelAnimationFrame(resizeRafRef.current);
      }
      resizeRafRef.current = window.requestAnimationFrame(() => {
        resizeRafRef.current = null;
        updateViewportState();
      });
    });
    observer.observe(viewport);
    return () => {
      observer.disconnect();
      if (resizeRafRef.current !== null) {
        window.cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
    };
  }, []);

  const blurActiveElement = () => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
  };

  const resolvedEntities = useMemo(
    () => resolveProgramHomeEntities(settings, program, programCourses),
    [program, programCourses, settings],
  );
  const visibleEntities = useMemo(
    () => sortProgramHomeEntities(resolvedEntities, settings.sort_mode),
    [resolvedEntities, settings.sort_mode],
  );

  const isMobileLayout = viewportState.isMobile;
  const activeDevice = isMobileLayout ? 'mobile' : 'desktop';
  const activeMetrics = isMobileLayout ? BOARD_METRICS.mobile : BOARD_METRICS.desktop;
  const activeLayoutKey = isMobileLayout ? 'sm' : 'lg';

  const pinnedKeys = useMemo(
    () => new Set(settings.items.map((item) => getProgramHomeItemKey(item.entity_type, item.entity_id))),
    [settings.items],
  );

  const addCandidates = useMemo(() => {
    const semesterCandidates = (program.semesters ?? [])
      .filter((semester) => semester.lifecycle_state !== 'draft')
      .map((semester) => ({
        entityType: 'semester' as const,
        entityId: semester.id,
        title: semester.name,
        subtitle: formatSemesterDateRange(semester),
        chronologyKey: semester.start_date ?? '',
      }));

    const courseCandidates = programCourses.map((course) => ({
      entityType: 'course' as const,
      entityId: course.id,
      title: course.name,
      subtitle: course.semesterName,
      chronologyKey: course.semesterStartDate ?? '',
      alias: course.alias?.trim() || '',
      category: course.category?.trim() || '',
      badgeStyle: getCourseBadgeStyle(resolveCourseColor(course)),
    }));

    return [...semesterCandidates, ...courseCandidates]
      .filter((candidate) => !pinnedKeys.has(getProgramHomeItemKey(candidate.entityType, candidate.entityId)))
      .filter((candidate) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) {
          return true;
        }
        return candidate.title.toLowerCase().includes(query) || candidate.subtitle?.toLowerCase().includes(query);
      })
      .sort((left, right) => {
        if (candidateSort === 'chronology' && left.chronologyKey !== right.chronologyKey) {
          return left.chronologyKey.localeCompare(right.chronologyKey);
        }
        return left.title.localeCompare(right.title);
      });
  }, [candidateSort, pinnedKeys, program.semesters, programCourses, searchQuery]);

  const semesterCandidates = useMemo(
    () => addCandidates.filter((candidate) => candidate.entityType === 'semester'),
    [addCandidates],
  );
  const courseCandidates = useMemo(
    () => addCandidates.filter((candidate) => candidate.entityType === 'course'),
    [addCandidates],
  );
  const hasAvailableCandidates = useMemo(() => {
    return (program.semesters ?? []).some((semester) => (
      semester.lifecycle_state !== 'draft' && !isProgramHomePinned(settings, 'semester', semester.id)
    )) || programCourses.some((course) => !isProgramHomePinned(settings, 'course', course.id));
  }, [program.semesters, programCourses, settings]);

  const desktopStrip = useMemo(
    () => buildStripLayouts(visibleEntities, 'desktop', settings.sort_mode === 'manual'),
    [settings.sort_mode, visibleEntities],
  );
  const mobileStrip = useMemo(
    () => buildStripLayouts(visibleEntities, 'mobile', settings.sort_mode === 'manual'),
    [settings.sort_mode, visibleEntities],
  );

  const layouts = useMemo(
    () => buildResponsiveLayoutsFromStrip(visibleEntities, desktopStrip, mobileStrip),
    [desktopStrip, mobileStrip, visibleEntities],
  );

  useEffect(() => {
    if (!dragStateRef.current) {
      setInteractiveLayouts(null);
    }
  }, [layouts]);

  useEffect(() => {
    if (!isEditing && dragStateRef.current) {
      dragStateRef.current = null;
      setDraggingId(null);
    }
  }, [isEditing]);

  const currentLayouts = interactiveLayouts ?? layouts;
  const activeLayout = currentLayouts[activeLayoutKey];
  const activeLayoutRef = useRef(activeLayout);
  const settingsRef = useRef(settings);
  const layoutsRef = useRef(layouts);
  const visibleEntitiesRef = useRef(visibleEntities);
  const visibleCols = isMobileLayout ? viewportState.mobileVisibleCols : viewportState.desktopVisibleCols;
  const activeCols = Math.max(getFocusBoardLayoutCols(activeLayout), visibleCols);
  const boardWidth = getAxisSpan(activeCols, activeMetrics.columnWidth, activeMetrics.gap);
  const boardHeight = getAxisSpan(FOCUS_BOARD_ROWS, activeMetrics.rowHeight, activeMetrics.gap);
  const unitX = activeMetrics.columnWidth + activeMetrics.gap;
  const unitY = activeMetrics.rowHeight + activeMetrics.gap;

  const activeLayoutMap = useMemo(() => {
    const nextMap = new Map<string, FocusBoardLayoutItem>();
    activeLayout.forEach((item) => nextMap.set(item.i, item));
    return nextMap;
  }, [activeLayout]);
  const activeLayoutMapRef = useRef(activeLayoutMap);

  useEffect(() => {
    activeLayoutRef.current = activeLayout;
    activeLayoutMapRef.current = activeLayoutMap;
  }, [activeLayout, activeLayoutMap]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    layoutsRef.current = layouts;
  }, [layouts]);

  useEffect(() => {
    visibleEntitiesRef.current = visibleEntities;
  }, [visibleEntities]);

  useEffect(() => {
    if (!draggingId) {
      return;
    }

    const stopAutoScroll = () => {
      autoScrollVelocityRef.current = 0;
      if (pointerMoveFrameRef.current !== null) {
        window.cancelAnimationFrame(pointerMoveFrameRef.current);
        pointerMoveFrameRef.current = null;
      }
      if (rafHandleRef.current !== null) {
        window.cancelAnimationFrame(rafHandleRef.current);
        rafHandleRef.current = null;
      }
    };

    const updateActiveLayout = (nextActiveLayout: readonly FocusBoardLayoutItem[]) => {
      const sanitized = sanitizeInteractiveStripLayout(nextActiveLayout, visibleEntitiesRef.current, activeDevice);
      const previousActiveLayout = activeLayoutRef.current;
      if (areLayoutItemsEqual(previousActiveLayout, sanitized)) {
        return sanitized;
      }

      activeLayoutRef.current = [...sanitized];
      activeLayoutMapRef.current = new Map(sanitized.map((item) => [item.i, item]));
      setInteractiveLayouts((current) => {
        const fallbackLayouts = current ?? layoutsRef.current;
        const nextLayouts = {
          lg: activeLayoutKey === 'lg' ? [...sanitized] : fallbackLayouts.lg,
          sm: activeLayoutKey === 'sm' ? [...sanitized] : fallbackLayouts.sm,
        };
        return nextLayouts;
      });
      return sanitized;
    };

    const commitActiveLayout = async (nextActiveLayout: readonly FocusBoardLayoutItem[]) => {
      const normalized = updateActiveLayout(nextActiveLayout);
      const nextSettings = applyStripLayoutToSettings({
        ...settingsRef.current,
        sort_mode: 'manual',
      }, normalized, activeDevice);
      await onCommit(nextSettings);
    };

    const resolvePreviewFromPointer = (clientX: number, clientY: number) => {
      const dragState = dragStateRef.current;
      const viewport = viewportRef.current;
      if (!dragState || !viewport) {
        return null;
      }

      const rect = viewport.getBoundingClientRect();
      const pointerLeft = clientX - rect.left + viewport.scrollLeft;
      const pointerTop = clientY - rect.top;
      const candidateLeft = pointerLeft - dragState.grabOffsetX;
      const candidateTop = pointerTop - dragState.grabOffsetY;
      const draggedLayout = activeLayoutMapRef.current.get(dragState.id);
      if (!draggedLayout) {
        return null;
      }

      const targetX = Math.max(0, Math.round(candidateLeft / unitX));
      const targetY = draggedLayout.h >= FOCUS_BOARD_ROWS
        ? 0
        : Math.max(0, Math.min(FOCUS_BOARD_ROWS - draggedLayout.h, Math.round(candidateTop / unitY)));

      return solveFocusBoardDragLayout(
        activeLayoutRef.current,
        dragState.id,
        { x: targetX, y: targetY },
        visibleEntitiesRef.current,
        dragState.device,
      );
    };

    const runAutoScroll = () => {
      const viewport = viewportRef.current;
      const pointer = latestPointerRef.current;
      if (!viewport || !pointer || autoScrollVelocityRef.current === 0 || !dragStateRef.current) {
        rafHandleRef.current = null;
        return;
      }

      viewport.scrollLeft = Math.max(0, viewport.scrollLeft + autoScrollVelocityRef.current);
      const preview = resolvePreviewFromPointer(pointer.clientX, pointer.clientY);
      if (preview) {
        updateActiveLayout(preview);
      }
      rafHandleRef.current = window.requestAnimationFrame(runAutoScroll);
    };

    const updateAutoScrollVelocity = (clientX: number) => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }
      const rect = viewport.getBoundingClientRect();
      const offsetLeft = clientX - rect.left;
      const offsetRight = rect.right - clientX;

      let velocity = 0;
      if (offsetLeft < AUTO_SCROLL_EDGE_PX) {
        velocity = -Math.ceil(((AUTO_SCROLL_EDGE_PX - offsetLeft) / AUTO_SCROLL_EDGE_PX) * AUTO_SCROLL_MAX_STEP);
      } else if (offsetRight < AUTO_SCROLL_EDGE_PX) {
        velocity = Math.ceil(((AUTO_SCROLL_EDGE_PX - offsetRight) / AUTO_SCROLL_EDGE_PX) * AUTO_SCROLL_MAX_STEP);
      }

      autoScrollVelocityRef.current = velocity;
      if (velocity !== 0 && rafHandleRef.current === null) {
        rafHandleRef.current = window.requestAnimationFrame(runAutoScroll);
      }
      if (velocity === 0) {
        stopAutoScroll();
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      latestPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
      if (pointerMoveFrameRef.current !== null) {
        return;
      }

      pointerMoveFrameRef.current = window.requestAnimationFrame(() => {
        pointerMoveFrameRef.current = null;
        const pointer = latestPointerRef.current;
        if (!pointer) {
          return;
        }
        updateAutoScrollVelocity(pointer.clientX);
        const preview = resolvePreviewFromPointer(pointer.clientX, pointer.clientY);
        if (preview) {
          updateActiveLayout(preview);
        }
      });
    };

    const finishDrag = (event: PointerEvent) => {
      latestPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
      const preview = resolvePreviewFromPointer(event.clientX, event.clientY);
      stopAutoScroll();
      dragStateRef.current = null;
      setDraggingId(null);
      if (preview) {
        void commitActiveLayout(preview);
      }
    };

    const cancelDrag = () => {
      stopAutoScroll();
      dragStateRef.current = null;
      setDraggingId(null);
      setInteractiveLayouts(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishDrag, { once: true });
    window.addEventListener('pointercancel', cancelDrag, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', cancelDrag);
      stopAutoScroll();
    };
  }, [activeDevice, activeLayoutKey, draggingId, onCommit, unitX, unitY]);

  const handleAddCandidate = (entityType: ProgramHomeEntityType, entityId: string) => {
    void onCommit(upsertProgramHomeItem(settings, entityType, entityId, 'medium'));
    setIsAddOpen(false);
    setSearchQuery('');
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Focus Board</h2>
          </div>
        </div>
        <div className="flex flex-wrap items-stretch gap-2 sm:flex-row sm:items-center">
          <Button type="button" size="icon" variant={isEditing ? 'default' : 'outline'} onClick={() => {
            blurActiveElement();
            setIsEditing((current) => !current);
          }}>
            {isEditing ? <Check /> : <Pencil />}
            <span className="sr-only">{isEditing ? 'Done editing board' : 'Edit board'}</span>
          </Button>
          <Select
            value={settings.sort_mode}
            onValueChange={async (value) => {
              await onCommit({ ...settings, sort_mode: value as ProgramHomeSortMode });
            }}
          >
            <SelectTrigger className="min-w-0 flex-1 sm:min-w-40 sm:flex-none">
              <Rows3 data-icon="inline-start" />
              <SelectValue placeholder="Arrange by" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Object.entries(sortLabelMap).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button type="button" onClick={() => {
            blurActiveElement();
            setIsAddOpen(true);
          }} disabled={!hasAvailableCandidates} className="flex-1 sm:flex-none">
            <Plus data-icon="inline-start" />
            Add to Focus Board
          </Button>
        </div>
      </div>

      {visibleEntities.length === 0 ? (
        <AppEmptyState
          scenario="create"
          size="section"
          title="Nothing pinned yet"
          description="Pin a Semester or Course to keep it visible on Program Home."
          primaryAction={(
            <Button type="button" onClick={() => {
              blurActiveElement();
              setIsAddOpen(true);
            }} disabled={!hasAvailableCandidates}>
              <Pin data-icon="inline-start" />
              Add First Item
            </Button>
          )}
        />
      ) : (
        <div
          ref={viewportRef}
          className={cn(
            'min-h-32 overflow-x-auto overflow-y-hidden overscroll-x-contain px-1 py-1',
            isEditing && draggingId && 'cursor-grabbing select-none',
          )}
        >
          {viewportState.isReady ? (
            <div className="min-w-full">
              <div
                className="relative min-w-max"
                style={{ width: `${boardWidth}px`, height: `${boardHeight}px` }}
              >
                {visibleEntities.map((entity) => {
                  const key = getProgramHomeItemKey(entity.entityType, entity.entityId);
                  const layout = activeLayoutMap.get(key);
                  if (!layout) {
                    return null;
                  }

                  const left = layout.x * unitX;
                  const top = layout.y * unitY;
                  const widthPx = getAxisSpan(layout.w, activeMetrics.columnWidth, activeMetrics.gap);
                  const heightPx = getAxisSpan(layout.h, activeMetrics.rowHeight, activeMetrics.gap);
                  const isDragging = draggingId === key;

                  return (
                    <div
                      key={key}
                      className={cn(
                        'absolute transition-[transform,width,height] duration-150 ease-out',
                        isEditing && 'cursor-grab',
                        isDragging && 'z-20',
                      )}
                      style={{
                        width: `${widthPx}px`,
                        height: `${heightPx}px`,
                        transform: `translate(${left}px, ${top}px)`,
                      }}
                      onPointerDown={isEditing ? (event) => {
                        const target = event.target instanceof HTMLElement ? event.target : null;
                        if (!target || target.closest("[data-no-drag='true'],button,a,input,select,textarea")) {
                          return;
                        }

                        const rect = event.currentTarget.getBoundingClientRect();
                        dragStateRef.current = {
                          id: key,
                          device: activeDevice,
                          grabOffsetX: event.clientX - rect.left,
                          grabOffsetY: event.clientY - rect.top,
                        };
                        latestPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
                        setDraggingId(key);
                        event.preventDefault();
                      } : undefined}
                    >
                      <FocusBoardCard
                        entity={entity}
                        isEditing={isEditing}
                        isDragging={isDragging}
                        onChangeSize={(size) => {
                          const resizedSettings = updateProgramHomeItemSize(
                            settings,
                            entity.entityType,
                            entity.entityId,
                            size,
                          );
                          const normalized = rebuildFocusBoardLayouts(resizedSettings, program, programCourses);
                          setInteractiveLayouts(normalized.layouts);
                          void onCommit(normalized.settings);
                        }}
                        onRemove={() => {
                          blurActiveElement();
                          setPendingRemove({
                            entityType: entity.entityType,
                            entityId: entity.entityId,
                            title: entity.title,
                          });
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <ResponsiveDialogDrawer
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) {
            setSearchQuery('');
          }
        }}
        title="Add to Focus Board"
        description="Select a Semester or Course from the current Program."
        desktopContentClassName="sm:max-w-[640px]"
      >
        <div className="flex min-h-[32rem] flex-col gap-4 px-4 md:px-0">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Search Semesters or Courses..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <Select value={candidateSort} onValueChange={(value) => setCandidateSort(value as CandidateSortMode)}>
              <SelectTrigger className="sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="chronology">Chronology</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="min-h-0 flex-1">
            {addCandidates.length === 0 ? (
              <div className="flex h-full items-center">
                <AppEmptyState
                  scenario="no-results"
                  size="section"
                  title="No more items to add"
                  description="Everything in this Program is already pinned, or the current search returned no match."
                />
              </div>
            ) : (
              <ScrollArea className="h-full pr-3">
                <div className="flex flex-col gap-2">
                  {[
                    { title: 'Semesters', items: semesterCandidates },
                    { title: 'Courses', items: courseCandidates },
                  ].map((section) => (
                    section.items.length > 0 ? (
                      <div key={section.title} className="flex flex-col gap-2">
                        <div className="px-1 text-sm font-medium text-muted-foreground">{section.title}</div>
                        {section.items.map((candidate) => {
                          const meta = entityMeta[candidate.entityType];
                          const Icon = meta.icon;
                          return (
                            <div
                              key={getProgramHomeItemKey(candidate.entityType, candidate.entityId)}
                              className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-3"
                            >
                              <div className="flex min-w-0 items-start gap-3">
                                <span className="inline-flex rounded-md border border-border/70 bg-muted/30 p-2 text-muted-foreground">
                                  <Icon className="size-4" />
                                </span>
                                <div className="min-w-0">
                                  <div className="truncate font-medium">{candidate.title}</div>
                                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                    <span className="truncate">{candidate.subtitle}</span>
                                    {candidate.entityType === 'course' && candidate.alias ? (
                                      <span className="truncate">{candidate.alias}</span>
                                    ) : null}
                                    {candidate.entityType === 'course' && candidate.category ? (
                                      <Badge
                                        variant="outline"
                                        className="border-0 font-medium"
                                        style={candidate.badgeStyle}
                                      >
                                        {candidate.category}
                                      </Badge>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                              <Button type="button" variant="outline" size="sm" onClick={() => handleAddCandidate(candidate.entityType, candidate.entityId)}>
                                <Plus data-icon="inline-start" />
                                Add
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    ) : null
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </ResponsiveDialogDrawer>

      <AlertDialog open={pendingRemove !== null} onOpenChange={(open) => {
        if (!open) {
          setPendingRemove(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Focus Board?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove ? `${pendingRemove.title} will no longer stay pinned on Program Home.` : 'Remove this item from Focus Board.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingRemove) {
                  return;
                }
                void onCommit(removeProgramHomeItem(
                  settings,
                  pendingRemove.entityType,
                  pendingRemove.entityId,
                ));
                setPendingRemove(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
