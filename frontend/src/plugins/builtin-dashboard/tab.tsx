import React from 'react';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '../../components/skeletons';
import { DashboardGrid } from '../../components/widgets/DashboardGrid';
import { useBuiltinTabContext } from '../../contexts/BuiltinTabContext';
import type { TabDefinition, TabProps } from '../../services/tabRegistry';
import { Lock, LockOpen, Plus } from 'lucide-react';

const BuiltinDashboardTabComponent: React.FC<TabProps> = () => {
    const { isLoading, dashboard } = useBuiltinTabContext();
    const glassButtonClassName =
        "border border-border bg-[color:var(--color-bg-glass)] text-foreground backdrop-blur-md shadow-none hover:bg-[color:var(--color-bg-glass)] hover:text-foreground hover:shadow-md";

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
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <CardSkeleton key={i} className="h-[240px]" />
                ))}
            </div>
        );
    }

    return (
        <>
            {/* Lock Button */}
            <Button
                onClick={toggleLock}
                variant="outline"
                className={glassButtonClassName}
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
                    <Lock className="h-5 w-5" aria-hidden="true" />
                ) : (
                        <LockOpen className="h-5 w-5" aria-hidden="true" />
                )}
            </Button>

            {/* Add Widget Button */}
            <Button
                onClick={dashboard.onAddWidgetClick}
                variant="outline"
                className={glassButtonClassName}
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
                <Plus className="h-5 w-5" aria-hidden="true" />
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
