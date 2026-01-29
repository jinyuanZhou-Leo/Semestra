import React from 'react';
import { Button } from '../../components/Button';
import { DashboardSkeleton } from '../../components/Skeleton/DashboardSkeleton';
import { DashboardGrid } from '../../components/widgets/DashboardGrid';
import { useBuiltinTabContext } from '../../contexts/BuiltinTabContext';
import type { TabDefinition, TabProps } from '../../services/tabRegistry';

const BuiltinDashboardTabComponent: React.FC<TabProps> = () => {
    const { isLoading, dashboard } = useBuiltinTabContext();

    if (isLoading) {
        return <DashboardSkeleton />;
    }

    return (
        <>
            <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem' }}>Dashboard</h2>
                <Button onClick={dashboard.onAddWidgetClick} size="md" variant="glass" shape="rounded">+ Add Widget</Button>
            </div>
            <DashboardGrid
                widgets={dashboard.widgets}
                onLayoutChange={dashboard.onLayoutChange}
                onRemoveWidget={dashboard.onRemoveWidget}
                onEditWidget={dashboard.onEditWidget}
                onUpdateWidget={dashboard.onUpdateWidget}
                onUpdateWidgetDebounced={dashboard.onUpdateWidgetDebounced}
                semesterId={dashboard.semesterId}
                courseId={dashboard.courseId}
                updateCourseField={dashboard.updateCourseField}
            />
        </>
    );
};

export const BuiltinDashboardTab = React.memo(BuiltinDashboardTabComponent);

export const BuiltinDashboardTabDefinition: TabDefinition = {
    type: 'dashboard',
    name: 'Dashboard',
    component: BuiltinDashboardTab,
    maxInstances: 0,
    allowedContexts: ['semester', 'course']
};
