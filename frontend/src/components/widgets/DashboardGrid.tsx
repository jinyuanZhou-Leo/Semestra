import React, { useMemo, useState } from 'react';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { DashboardWidgetWrapper } from './DashboardWidgetWrapper';
import { WidgetRegistry } from '../../services/widgetRegistry';
import { useTouchDevice } from '../../hooks/useTouchDevice';

import { Responsive } from 'react-grid-layout';
import { WidthProvider } from './WidthProvider';

const ResponsiveGridLayout = WidthProvider(Responsive);
const GRID_BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 } as const;
const GRID_COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 } as const;
const GRID_MARGIN: [number, number] = [16, 16];
const GRID_CONTAINER_PADDING: [number, number] = [0, 0];

export interface WidgetItem {
    id: string;
    type: string;
    title: string;
    settings?: any;
    layout?: { x: number, y: number, w: number, h: number };
    is_removable?: boolean;
}

interface DashboardGridProps {
    widgets: WidgetItem[];
    onWidgetsChange?: (newWidgets: WidgetItem[]) => void;
    onLayoutChange: (layouts: any) => void;
    onEditWidget?: (widget: WidgetItem) => void;
    onRemoveWidget?: (id: string) => void;
    /** For immediate updates (modals, delete, etc.) */
    onUpdateWidget?: (id: string, newSettings: any) => Promise<void>;
    /** For frequent updates (typing) - debounced by framework */
    onUpdateWidgetDebounced?: (id: string, newSettings: any) => void;
    semesterId?: string;
    courseId?: string;
    updateCourse?: (updates: any) => void;
    /** Lock widgets to prevent dragging and resizing */
    isLocked?: boolean;
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
    isLocked = false
}) => {
    const isTouchDevice = useTouchDevice();
    const [activeCols, setActiveCols] = useState<number>(GRID_COLS.lg);
    const [activeWidth, setActiveWidth] = useState<number | null>(null);

    const rowHeight = useMemo(() => {
        if (!activeWidth || activeCols <= 0) return 85;
        const totalMargin = GRID_MARGIN[0] * (activeCols - 1);
        const totalPadding = GRID_CONTAINER_PADDING[0] * 2;
        const columnWidth = (activeWidth - totalMargin - totalPadding) / activeCols;

        // Use responsive scale factor for row height
        // Desktop: full square (1.0x), Tablet: slightly compressed (0.8x), Mobile: more compressed (0.6x)
        let scale = 1.0;
        if (activeCols <= 2) {
            // xxs breakpoint
            scale = 0.6;
        } else if (activeCols <= 4) {
            // xs breakpoint
            scale = 0.6;
        } else if (activeCols <= 6) {
            // sm breakpoint
            scale = 0.8;
        }

        const scaledRowHeight = columnWidth * scale;
        return Math.max(40, Math.floor(scaledRowHeight));
    }, [activeWidth, activeCols]);

    // Convert widgets to RGL layout format
    const layouts = useMemo(() => {
        return {
            lg: widgets.map((w, i) => {
                const def = WidgetRegistry.get(w.type);
                const layout = def?.layout || { w: 4, h: 4, minW: 2, minH: 2 };
                const minW = layout.minW || 2;
                const minH = layout.minH || 2;
                const rawW = w.layout?.w ?? layout.w;
                const rawH = w.layout?.h ?? layout.h;
                const safeW = Math.max(rawW, minW);
                const safeH = Math.max(rawH, minH);
                return {
                    i: w.id,
                    x: w.layout?.x ?? (i * layout.w) % 12,
                    y: w.layout?.y ?? Math.floor(i / 3) * layout.h,
                    w: safeW,
                    h: safeH,
                    minW,
                    minH,
                    maxW: layout.maxW,
                    maxH: layout.maxH,
                    static: isLocked // Disable drag and resize when locked
                };
            })
        };
    }, [widgets, isLocked]);

    if (widgets.length === 0) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '3rem',
                marginTop: '2rem',
                border: '2px dashed var(--color-border)',
                borderRadius: 'var(--radius-widget)',
                color: 'var(--color-text-secondary)',
                backgroundColor: 'var(--color-bg-secondary)'
            }}>
                <h3>No Widgets</h3>
                <p>Click "Add Widget" to customize your dashboard.</p>
            </div>
        );
    }

    return (
        <ResponsiveGridLayout
            key={`grid-${isLocked ? 'locked' : 'unlocked'}`}
            className="layout"
            layouts={layouts}
            breakpoints={GRID_BREAKPOINTS}
            cols={GRID_COLS}
            rowHeight={rowHeight}
            margin={GRID_MARGIN}
            containerPadding={GRID_CONTAINER_PADDING}
            onLayoutChange={(layout: Layout[]) => onLayoutChange(layout)}
            onWidthChange={(width: number, _margin: [number, number], currentCols: number) => {
                setActiveWidth(width);
                setActiveCols(currentCols);
            }}
            draggableHandle={isTouchDevice ? ".drag-surface" : ".drag-handle"}
            draggableCancel=".nodrag, input, textarea, button, select, option, a, [contenteditable='true'], [data-widget-control]"
            isDraggable={!isLocked}
            isResizable={!isLocked && !isTouchDevice}
        >
            {widgets.map((widget, index) => {
                const isRemovable = widget.is_removable !== false;

                return (
                    <div key={widget.id} style={{ border: '1px solid transparent' }}>
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
                            isLocked={isLocked}
                        />
                    </div>
                );
            })}
        </ResponsiveGridLayout>
    );
};
