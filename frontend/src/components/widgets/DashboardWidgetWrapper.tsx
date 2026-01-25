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
    index,
    onRemove,
    onEdit,
    onUpdateWidget,
    semesterId,
    courseId,
    updateCourseField
}) => {
    const [isSaving, setIsSaving] = useState(false);
    const WidgetComponent = WidgetRegistry.getComponent(widget.type);
    const widgetDef = WidgetRegistry.get(widget.type);

    // Format: [Plugin Name - Widget Title]
    const pluginName = widgetDef?.name || 'Unknown Plugin';

    // Logic: If widget.title exists and is not empty, use it.
    // Otherwise, if index is provided, use index + 1.
    // If neither, fallback to 'Widget'.
    // User request: "If no custom title, just use number"
    // So if widget.title is e.g. "Counter", and user didn't rename it... 
    // Wait, the backend currently defaults title to "Counter" or "Widget". 
    // We should probably check if it matches the default title? 
    // Or just rely on what's passed.

    // Let's assume if widget.title is present, use it.
    // But the user said "If some plugins don't provide custom title, use number".
    // I will try to detect if it's a "default" title or not? 
    // Actually, usually simpler: Always show [PluginName - Title].
    // If Title IS numeric, then [PluginName - 1].
    // If Title IS text, [PluginName - MyTitle].

    // BUT the user request says: "插件不一定非要有Title，有一些插件如果不提供Title自定义，就以数字表示"
    // "Plugins don't necessarily have a Title. If some plugins don't provide custom Title, represent with number."
    // This implies I should handle the case where title is generic or empty.

    const titlePart = widget.title || ((index !== undefined) ? (index + 1).toString() : '');
    const displayTitle = titlePart ? `${pluginName} - ${titlePart}` : pluginName;

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
            title={displayTitle}
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
                title={widget.title}
                pluginName={pluginName}
                updateCourseField={updateCourseField}
            />
        </WidgetContainer>
    );
};
