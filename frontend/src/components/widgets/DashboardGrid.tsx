import React from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy
} from '@dnd-kit/sortable';
import { WidgetContainer } from './WidgetContainer';
import { CourseListWidget } from './CourseListWidget';
import { CounterWidget } from './CounterWidget';
// Import other widgets here

// Widget Schema
export interface WidgetItem {
    id: string;
    type: 'course-list' | 'counter';
    title: string;
    // Layout props could be here if using grid-layout
    settings?: any;
}

interface DashboardGridProps {
    widgets: WidgetItem[];
    onWidgetsChange: (newWidgets: WidgetItem[]) => void;
    onEditWidget?: (widget: WidgetItem) => void;
    // Context data
    semesterId?: number;
    courseId?: number;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({
    widgets,
    onWidgetsChange,
    onEditWidget,
    semesterId
}) => {
    // ... sensors ...
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = widgets.findIndex((w) => w.id === active.id);
            const newIndex = widgets.findIndex((w) => w.id === over.id);

            onWidgetsChange(arrayMove(widgets, oldIndex, newIndex));
        }
    };

    const removeWidget = (id: string) => {
        onWidgetsChange(widgets.filter(w => w.id !== id));
    };

    const renderWidgetContent = (widget: WidgetItem) => {
        switch (widget.type) {
            case 'course-list':
                return semesterId ? <CourseListWidget semesterId={semesterId} /> : <div>N/A for Course</div>;
            case 'counter':
                return <CounterWidget widgetId={widget.id} settings={widget.settings || {}} />;
            default:
                return <div>Unknown Widget Type</div>;
        }
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={widgets.map(w => w.id)}
                strategy={rectSortingStrategy}
            >
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                    gap: '1.5rem',
                    paddingBottom: '2rem',
                    gridAutoFlow: 'dense' // Important for variable sizes
                }}>
                    {widgets.map((widget) => {
                        const size = widget.settings?.size || 'medium';
                        let gridColumn = 'span 1';
                        let height = '400px';

                        if (size === 'large') {
                            gridColumn = 'span 2';
                            height = '600px';
                        } else if (size === 'wide') {
                            gridColumn = 'span 2';
                        } else if (size === 'small') {
                            height = '200px';
                        }

                        return (
                            <div key={widget.id} style={{ height, gridColumn }}>
                                <WidgetContainer
                                    id={widget.id}
                                    title={widget.title}
                                    onRemove={() => removeWidget(widget.id)}
                                    onEdit={onEditWidget ? () => onEditWidget(widget) : undefined}
                                >
                                    {renderWidgetContent(widget)}
                                </WidgetContainer>
                            </div>
                        );
                    })}
                </div>
            </SortableContext>
        </DndContext>
    );
};
