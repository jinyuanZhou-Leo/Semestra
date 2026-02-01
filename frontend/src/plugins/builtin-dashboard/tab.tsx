import React from 'react';
import { Button } from '../../components/Button';
import { DashboardSkeleton } from '../../components/Skeleton/DashboardSkeleton';
import { DashboardGrid } from '../../components/widgets/DashboardGrid';
import { useBuiltinTabContext } from '../../contexts/BuiltinTabContext';
import type { TabDefinition, TabProps } from '../../services/tabRegistry';

const BuiltinDashboardTabComponent: React.FC<TabProps> = () => {
    const { isLoading, dashboard } = useBuiltinTabContext();

    // Use a unique key for each dashboard (semester or course)
    const storageKey = `dashboard-locked-${dashboard.semesterId || dashboard.courseId || 'default'}`;

    // Initialize locked state from localStorage
    const [isLocked, setIsLocked] = React.useState(() => {
        try {
            const stored = localStorage.getItem(storageKey);
            return stored === 'true';
        } catch {
            return false;
        }
    });

    // Sync state when storageKey changes (navigating between dashboards)
    React.useEffect(() => {
        try {
            const stored = localStorage.getItem(storageKey);
            setIsLocked(stored === 'true');
        } catch {
            setIsLocked(false);
        }
    }, [storageKey]);

    // Persist locked state to localStorage
    const toggleLock = React.useCallback(() => {
        setIsLocked(prev => {
            const newValue = !prev;
            try {
                localStorage.setItem(storageKey, String(newValue));
            } catch {
                // Ignore storage errors
            }
            return newValue;
        });
    }, [storageKey]);

    if (isLoading) {
        return <DashboardSkeleton />;
    }

    return (
        <>
            {/* Lock Button */}
            <Button
                onClick={toggleLock}
                size="md"
                variant="glass"
                shape="rounded"
                aria-label={isLocked ? "Unlock widgets" : "Lock widgets"}
                title={isLocked ? "Unlock widgets" : "Lock widgets"}
                style={{
                    position: 'fixed',
                    right: '2rem',
                    bottom: '6rem',
                    width: '3.25rem',
                    height: '3.25rem',
                    padding: 0,
                    borderRadius: '999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 20,
                    opacity: isLocked ? 1 : 0.7,
                    transition: 'opacity 0.2s'
                }}
            >
                {isLocked ? (
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
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                ) : (
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
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                    </svg>
                )}
            </Button>

            {/* Add Widget Button */}
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
                isLocked={isLocked}
            />
        </>
    );
};
export const BuiltinDashboardTab = BuiltinDashboardTabComponent;

export const BuiltinDashboardTabDefinition: TabDefinition = {
    type: 'dashboard',
    name: 'Dashboard',
    component: BuiltinDashboardTab,
    maxInstances: 0,
    allowedContexts: ['semester', 'course']
};
