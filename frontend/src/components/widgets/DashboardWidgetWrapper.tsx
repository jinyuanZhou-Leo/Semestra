import React, { useState } from 'react';
import { WidgetContainer } from './WidgetContainer';
import { WidgetRegistry } from '../../services/widgetRegistry';
import type { WidgetItem } from './DashboardGrid';

interface DashboardWidgetWrapperProps {
    widget: WidgetItem;
    index?: number;
    onRemove?: (id: string) => void;
    onEdit?: (widget: WidgetItem) => void;
    onUpdateWidget: (id: string, newSettings: any) => Promise<void>;
    semesterId?: string;
    courseId?: string;
    updateCourseField?: (field: string, value: any) => void;
}

export const DashboardWidgetWrapper: React.FC<DashboardWidgetWrapperProps> = ({
    widget,
    onRemove,
    onEdit,
    onUpdateWidget,
    semesterId,
    courseId,
    updateCourseField
}) => {
    const [isSaving, setIsSaving] = useState(false);
    const WidgetComponent = WidgetRegistry.getComponent(widget.type);

    if (!WidgetComponent) {
        return <div>Unknown Widget Type: {widget.type}</div>;
    }

    const handleUpdateSettings = async (newSettings: any) => {
        setIsSaving(true);
        try {
            await onUpdateWidget(widget.id, { settings: JSON.stringify(newSettings) });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <WidgetContainer
            id={widget.id}
            onRemove={onRemove ? () => onRemove(widget.id) : undefined}
            onEdit={onEdit ? () => onEdit(widget) : undefined}
            isSaving={isSaving}
        >
            <WidgetComponent
                widgetId={widget.id}
                settings={widget.settings || {}}
                semesterId={semesterId}
                courseId={courseId}
                updateSettings={handleUpdateSettings}
                setIsSaving={setIsSaving}
                updateCourseField={updateCourseField}
            />
        </WidgetContainer>
    );
};

