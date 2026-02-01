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
            <Button
                onClick={dashboard.onAddWidgetClick}
                size="md"
                variant="glass"
                shape="rounded"
                aria-label="Add widget"
                style={{
                    position: 'fixed',
                    right: '2rem',
                    bottom: '2rem',
                    width: '3.25rem',
                    height: '3.25rem',
                    padding: 0,
                    borderRadius: '999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 20
                }}
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            </Button>
            <DashboardGrid
                widgets={dashboard.widgets}
                onLayoutChange={dashboard.onLayoutChange}
                onRemoveWidget={dashboard.onRemoveWidget}
                onEditWidget={dashboard.onEditWidget}
                onUpdateWidget={dashboard.onUpdateWidget}
                onUpdateWidgetDebounced={dashboard.onUpdateWidgetDebounced}
                semesterId={dashboard.semesterId}
                courseId={dashboard.courseId}
                updateCourse={dashboard.updateCourse}
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
