// input:  [widget collection, edit-mode flags, responsive-grid callbacks, layout metadata resolvers]
// output: [`DashboardGrid` component and dashboard layout type contracts]
// pos:    [Core responsive dashboard renderer for widget placement and layout persistence]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useMemo, useRef, useState } from 'react';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { DashboardWidgetWrapper } from './DashboardWidgetWrapper';
import { getResolvedWidgetLayoutByType } from '../../plugin-system';
import { useTouchDevice } from '../../hooks/useTouchDevice';

import { Responsive } from 'react-grid-layout';
import { WidthProvider } from './WidthProvider';

const ResponsiveGridLayout = WidthProvider(Responsive);
const GRID_BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 } as const;
const GRID_COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 } as const;
const GRID_MARGIN: [number, number] = [16, 16];
const GRID_CONTAINER_PADDING: [number, number] = [0, 0];
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
    onLayoutChange: (layouts: Layout[], deviceMode: DeviceLayoutMode, maxCols: number) => void;
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
    const [activeCols, setActiveCols] = useState<number>(GRID_COLS.lg);
    const [activeWidth, setActiveWidth] = useState<number | null>(null);
    const activeBreakpointRef = useRef<keyof typeof GRID_BREAKPOINTS>('lg');

    const rowHeight = useMemo(() => {
        if (!activeWidth || activeCols <= 0) return 85;
        const totalMargin = GRID_MARGIN[0] * (activeCols - 1);
        const totalPadding = GRID_CONTAINER_PADDING[0] * 2;
        const availableWidth = activeWidth - totalMargin - totalPadding;
        if (availableWidth <= 0) return 85;
        // Keep grid units square so width:height ratio is always 1:1.
        return availableWidth / activeCols;
    }, [activeWidth, activeCols]);

    const commitUserLayout = React.useCallback((layout: Layout[]) => {
        if (!isEditMode) return;
        const breakpoint = activeBreakpointRef.current;
        onLayoutChange(layout, getDeviceLayoutModeByBreakpoint(breakpoint), GRID_COLS[breakpoint]);
    }, [isEditMode, onLayoutChange]);

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
        return widgets.map((w, i) => {
            const layoutDef = getResolvedWidgetLayoutByType(w.type) || { w: 4, h: 4, minW: 2, minH: 2 };
            const minW = layoutDef.minW || 2;
            const minH = layoutDef.minH || 2;
            const maxCols = cols;
            const effectiveMinW = Math.min(minW, maxCols);
            const sourceLayout = getWidgetLayoutForDevice(w.layout, deviceMode);
            const rawW = sourceLayout?.w ?? layoutDef.w;
            const rawH = sourceLayout?.h ?? layoutDef.h;
            const safeW = Math.min(Math.max(rawW, effectiveMinW), maxCols);
            const safeH = Math.max(rawH, minH);

            return {
                i: w.id,
                x: sourceLayout?.x ?? (i * layoutDef.w) % maxCols,
                y: sourceLayout?.y ?? Math.floor(i / 3) * layoutDef.h,
                w: safeW,
                h: safeH,
                minW: effectiveMinW,
                minH,
                maxW: layoutDef.maxW ? Math.min(layoutDef.maxW, maxCols) : maxCols,
                maxH: layoutDef.maxH,
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
        <ResponsiveGridLayout
            className={`layout${isEditMode ? ' layout--editing' : ''}`}
            layouts={layouts}
            breakpoints={GRID_BREAKPOINTS}
            cols={GRID_COLS}
            rowHeight={rowHeight}
            margin={GRID_MARGIN}
            containerPadding={GRID_CONTAINER_PADDING}
            // Do not persist via onLayoutChange because it also fires during responsive reflow.
            // Persist only on explicit user actions to keep layout stable after resize/restore.
            onDragStop={(layout: Layout[]) => commitUserLayout(layout)}
            onResizeStop={(layout: Layout[]) => commitUserLayout(layout)}
            onBreakpointChange={(newBreakpoint: string) => {
                if (newBreakpoint in GRID_BREAKPOINTS) {
                    activeBreakpointRef.current = newBreakpoint as keyof typeof GRID_BREAKPOINTS;
                }
            }}
            onWidthChange={(width: number, _margin: [number, number], currentCols: number) => {
                setActiveWidth(width);
                setActiveCols(currentCols);
            }}
            draggableHandle={isTouchDevice ? ".drag-surface" : ".drag-handle"}
            draggableCancel=".nodrag, input, textarea, button, select, option, a, [contenteditable='true'], [data-widget-control]"
            isDraggable={isEditMode}
            isResizable={isEditMode && !isTouchDevice}
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
        </ResponsiveGridLayout>
    );
};
