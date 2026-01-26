import React, { useMemo } from 'react';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { DashboardWidgetWrapper } from './DashboardWidgetWrapper';
import { WidgetRegistry } from '../../services/widgetRegistry';

import { Responsive } from 'react-grid-layout';
import { WidthProvider } from './WidthProvider';

const ResponsiveGridLayout = WidthProvider(Responsive);

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
    onUpdateWidget?: (id: string, newSettings: any) => Promise<void>;
    semesterId?: string;
    courseId?: string;
    updateCourseField?: (field: string, value: any) => void;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({
    widgets,
    onLayoutChange,
    onEditWidget,
    onRemoveWidget,
    onUpdateWidget,
    semesterId,
    courseId,
    updateCourseField
}) => {

    // Convert widgets to RGL layout format
    const layouts = useMemo(() => {
        return {
            lg: widgets.map((w, i) => {
                const def = WidgetRegistry.get(w.type);
                const defaultLayout = def?.defaultLayout || { w: 4, h: 4, minW: 2, minH: 2 };
                return {
                    i: w.id,
                    x: w.layout?.x ?? (i * defaultLayout.w) % 12,
                    y: w.layout?.y ?? Math.floor(i / 3) * defaultLayout.h,
                    w: w.layout?.w ?? defaultLayout.w,
                    h: w.layout?.h ?? defaultLayout.h,
                    minW: defaultLayout.minW || 2,
                    minH: defaultLayout.minH || 2
                };
            })
        };
    }, [widgets]);

    if (widgets.length === 0) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '3rem',
                border: '2px dashed var(--color-border)',
                borderRadius: 'var(--radius-lg)',
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
            className="layout"
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={60}
            margin={[16, 16]}
            onLayoutChange={(layout: Layout[]) => onLayoutChange(layout)}
            isDraggable
            isResizable
            draggableHandle=".drag-handle"
            draggableCancel=".nodrag"
        >
            {widgets.map((widget, index) => {
                // Default to true if undefined
                const isRemovable = widget.is_removable !== false;

                return (
                    <div key={widget.id} style={{ border: '1px solid transparent' }}>
                        <DashboardWidgetWrapper
                            widget={widget}
                            index={index}
                            onRemove={onRemoveWidget && isRemovable ? onRemoveWidget : undefined}
                            onEdit={onEditWidget}
                            onUpdateWidget={onUpdateWidget || (async () => { })}
                            semesterId={semesterId}
                            courseId={courseId}
                            updateCourseField={updateCourseField}
                        />
                    </div>
                );
            })}
        </ResponsiveGridLayout>
    );
};
