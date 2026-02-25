// input:  [widget collection, edit-mode flags, v2 RGL width hook, local/commit layout callbacks, layout normalization utilities]
// output: [`DashboardGrid` component and dashboard layout type contracts]
// pos:    [Core responsive dashboard renderer for widget placement plus split local-sync and commit persistence flows]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useMemo, useRef } from 'react';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { DashboardWidgetWrapper } from './DashboardWidgetWrapper';
import { getResolvedWidgetLayoutByType } from '../../plugin-system';
import { useTouchDevice } from '../../hooks/useTouchDevice';
import {
    normalizeLayoutX,
    normalizeLayoutY,
    normalizeWidgetSize,
    resolveWidgetLayoutConstraints
} from '../../utils/widgetLayout';

import { Responsive, useContainerWidth } from 'react-grid-layout';
const GRID_BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 } as const;
const GRID_COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 } as const;
const GRID_MARGIN: [number, number] = [16, 16];
const GRID_CONTAINER_PADDING: [number, number] = [0, 0];
const DEFAULT_GRID_UNIT = 85;
const MOBILE_BREAKPOINTS = new Set<keyof typeof GRID_BREAKPOINTS>(['sm', 'xs', 'xxs']);

export type DeviceLayoutMode = 'desktop' | 'mobile';

export interface WidgetLayout {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface WidgetResponsiveLayout {
    desktop?: WidgetLayout;
    mobile?: WidgetLayout;
}

const getDeviceLayoutModeByBreakpoint = (breakpoint: keyof typeof GRID_BREAKPOINTS): DeviceLayoutMode => {
    return MOBILE_BREAKPOINTS.has(breakpoint) ? 'mobile' : 'desktop';
};

const getBreakpointByWidth = (width: number): keyof typeof GRID_BREAKPOINTS => {
    const sorted = (Object.entries(GRID_BREAKPOINTS) as Array<[keyof typeof GRID_BREAKPOINTS, number]>)
        .sort((left, right) => right[1] - left[1]);
    for (const [breakpoint, minWidth] of sorted) {
        if (width >= minWidth) return breakpoint;
    }
    return 'xxs';
};

const computeGridUnitSize = (
    width: number,
    cols: number,
    margin: readonly [number, number],
    containerPadding: readonly [number, number]
): number => {
    const safeCols = Math.max(1, cols);
    if (!Number.isFinite(width) || width <= 0) return DEFAULT_GRID_UNIT;
    const totalMargin = margin[0] * (safeCols - 1);
    const totalPadding = containerPadding[0] * 2;
    const availableWidth = width - totalMargin - totalPadding;
    if (availableWidth <= 0) return DEFAULT_GRID_UNIT;
    // Grid unit is always square: one width unit equals one height unit.
    return availableWidth / safeCols;
};

export interface WidgetItem {
    id: string;
    type: string;
    title: string;
    settings?: any;
    layout?: WidgetResponsiveLayout;
    is_removable?: boolean;
}

interface DashboardGridProps {
    widgets: WidgetItem[];
    onWidgetsChange?: (newWidgets: WidgetItem[]) => void;
    /** Local in-memory layout sync (fires on responsive reflow and user interactions). */
    onLayoutChange: (layout: Layout, deviceMode: DeviceLayoutMode, maxCols: number) => void;
    /** Persist layout to backend (user commit actions only). */
    onLayoutCommit?: (layout: Layout, deviceMode: DeviceLayoutMode, maxCols: number) => void;
    onEditWidget?: (widget: WidgetItem) => void;
    onRemoveWidget?: (id: string) => void;
    /** For immediate updates (modals, delete, etc.) */
    onUpdateWidget?: (id: string, newSettings: any) => Promise<void>;
    /** For frequent updates (typing) - debounced by framework */
    onUpdateWidgetDebounced?: (id: string, newSettings: any) => void;
    semesterId?: string;
    courseId?: string;
    updateCourse?: (updates: any) => void;
    /** Enable widget edit mode for dragging/resizing and header actions */
    isEditMode?: boolean;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({
    widgets,
    onLayoutChange,
    onLayoutCommit,
    onEditWidget,
    onRemoveWidget,
    onUpdateWidget,
    onUpdateWidgetDebounced,
    semesterId,
    courseId,
    updateCourse,
    isEditMode = false
}) => {
    const isTouchDevice = useTouchDevice();
    const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true });
    const activeBreakpointRef = useRef<keyof typeof GRID_BREAKPOINTS>('lg');
    const rowHeight = useMemo(() => {
        const breakpoint = getBreakpointByWidth(width);
        return computeGridUnitSize(width, GRID_COLS[breakpoint], GRID_MARGIN, GRID_CONTAINER_PADDING);
    }, [width]);

    const getActiveLayoutContext = React.useCallback(() => {
        const breakpoint = activeBreakpointRef.current;
        return {
            deviceMode: getDeviceLayoutModeByBreakpoint(breakpoint),
            maxCols: GRID_COLS[breakpoint]
        };
    }, []);

    const syncLocalLayout = React.useCallback((layout: Layout) => {
        const context = getActiveLayoutContext();
        onLayoutChange(layout, context.deviceMode, context.maxCols);
    }, [getActiveLayoutContext, onLayoutChange]);

    const commitUserLayout = React.useCallback((layout: Layout) => {
        if (!isEditMode || !onLayoutCommit) return;
        const context = getActiveLayoutContext();
        onLayoutCommit(layout, context.deviceMode, context.maxCols);
    }, [getActiveLayoutContext, isEditMode, onLayoutCommit]);

    const getWidgetLayoutForDevice = React.useCallback((layout: WidgetResponsiveLayout | undefined, deviceMode: DeviceLayoutMode) => {
        if (!layout) return undefined;
        if (deviceMode === 'desktop') {
            return layout.desktop ?? layout.mobile;
        }
        return layout.mobile ?? layout.desktop;
    }, []);

    const buildLayoutForBreakpoint = React.useCallback((breakpoint: keyof typeof GRID_BREAKPOINTS) => {
        const cols = GRID_COLS[breakpoint];
        const deviceMode = getDeviceLayoutModeByBreakpoint(breakpoint);
        let maxOccupiedY = 0;

        widgets.forEach((w) => {
            const sourceLayout = getWidgetLayoutForDevice(w.layout, deviceMode);
            if (!sourceLayout) return;

            const constraints = resolveWidgetLayoutConstraints(getResolvedWidgetLayoutByType(w.type), cols);
            const { h: safeH } = normalizeWidgetSize(sourceLayout.w, sourceLayout.h, constraints);
            const safeY = normalizeLayoutY(sourceLayout.y);
            maxOccupiedY = Math.max(maxOccupiedY, safeY + safeH);
        });

        // Place widgets without persisted layout below existing occupied area.
        let fallbackCursorX = 0;
        let fallbackCursorY = maxOccupiedY;
        let fallbackRowMaxH = 0;

        return widgets.map((w) => {
            const constraints = resolveWidgetLayoutConstraints(getResolvedWidgetLayoutByType(w.type), cols);
            const sourceLayout = getWidgetLayoutForDevice(w.layout, deviceMode);
            const { w: safeW, h: safeH } = sourceLayout
                ? normalizeWidgetSize(sourceLayout.w, sourceLayout.h, constraints)
                : normalizeWidgetSize(constraints.defaultW, constraints.defaultH, constraints);

            let x: number;
            let y: number;

            if (sourceLayout) {
                x = normalizeLayoutX(sourceLayout.x, cols, safeW);
                y = normalizeLayoutY(sourceLayout.y);
            } else {
                if (fallbackCursorX + safeW > cols) {
                    fallbackCursorX = 0;
                    fallbackCursorY += fallbackRowMaxH;
                    fallbackRowMaxH = 0;
                }

                x = fallbackCursorX;
                y = fallbackCursorY;
                fallbackCursorX += safeW;
                fallbackRowMaxH = Math.max(fallbackRowMaxH, safeH);
            }

            return {
                i: w.id,
                x,
                y,
                w: safeW,
                h: safeH,
                minW: constraints.minW,
                minH: constraints.minH,
                maxW: constraints.maxW,
                maxH: constraints.maxH,
            };
        });
    }, [getWidgetLayoutForDevice, widgets]);

    // Convert widgets to RGL layout format
    const layouts = useMemo(() => {
        return {
            lg: buildLayoutForBreakpoint('lg'),
            md: buildLayoutForBreakpoint('md'),
            sm: buildLayoutForBreakpoint('sm'),
            xs: buildLayoutForBreakpoint('xs'),
            xxs: buildLayoutForBreakpoint('xxs')
        };
    }, [buildLayoutForBreakpoint]);

    if (widgets.length === 0) {
        return (
            <div className="text-center p-12 mt-8 border-2 border-dashed border-border rounded-[var(--radius-widget)] text-muted-foreground bg-background">
                <h3>No Widgets</h3>
                <p>Click "Add Widget" to customize your dashboard.</p>
            </div>
        );
    }

    return (
        <div ref={containerRef} style={{ width: '100%' }}>
            {mounted && (
                <Responsive
                    className={`layout${isEditMode ? ' layout--editing' : ''}`}
                    layouts={layouts}
                    breakpoints={GRID_BREAKPOINTS}
                    cols={GRID_COLS}
                    width={width}
                    rowHeight={rowHeight}
                    margin={GRID_MARGIN}
                    containerPadding={GRID_CONTAINER_PADDING}
                    // Keep local widget state in sync with all RGL layout transitions, including reflow.
                    onLayoutChange={(layout: Layout) => {
                        syncLocalLayout(layout);
                    }}
                    // Persist only on explicit user actions to avoid reflow-driven backend writes.
                    onDragStop={(layout: Layout) => commitUserLayout(layout)}
                    onResizeStop={(layout: Layout) => commitUserLayout(layout)}
                    onBreakpointChange={(newBreakpoint: string) => {
                        if (newBreakpoint in GRID_BREAKPOINTS) {
                            activeBreakpointRef.current = newBreakpoint as keyof typeof GRID_BREAKPOINTS;
                        }
                    }}
                    dragConfig={{
                        enabled: isEditMode,
                        handle: isTouchDevice ? '.drag-surface' : '.drag-handle',
                        cancel: ".nodrag, input, textarea, button, select, option, a, [contenteditable='true'], [data-widget-control]"
                    }}
                    resizeConfig={{
                        enabled: isEditMode && !isTouchDevice
                    }}
                >
                    {widgets.map((widget, index) => {
                        const isRemovable = widget.is_removable !== false;

                        return (
                            <div key={widget.id} className="border border-transparent">
                                <DashboardWidgetWrapper
                                    widget={widget}
                                    index={index}
                                    onRemove={onRemoveWidget && isRemovable ? onRemoveWidget : undefined}
                                    onEdit={onEditWidget}
                                    onUpdateWidget={onUpdateWidget || (async () => { })}
                                    onUpdateWidgetDebounced={onUpdateWidgetDebounced}
                                    semesterId={semesterId}
                                    courseId={courseId}
                                    updateCourse={updateCourse}
                                    isEditMode={isEditMode}
                                />
                            </div>
                        );
                    })}
                </Responsive>
            )}
        </div>
    );
};
