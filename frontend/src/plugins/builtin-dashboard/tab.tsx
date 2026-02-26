// input:  [builtin tab context state, dashboard widget callbacks (local layout sync + commit persistence), motion + icon dependencies]
// output: [`BuiltinDashboardTab` component and `BuiltinDashboardTabDefinition` plugin metadata]
// pos:    [Built-in dashboard tab UI entry handling edit mode state, floating action controls, and split layout callback wiring]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '../../components/skeletons';
import { DashboardGrid } from '../../components/widgets/DashboardGrid';
import { useBuiltinTabContext } from '../../contexts/BuiltinTabContext';
import type { TabDefinition, TabProps } from '../../services/tabRegistry';
import { Check, Pencil, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const BuiltinDashboardTabComponent: React.FC<TabProps> = () => {
    const { isLoading, dashboard } = useBuiltinTabContext();
    const glassButtonClassName =
        "border border-border/50 bg-background/70 text-foreground backdrop-blur-md backdrop-saturate-150 shadow-lg dark:shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:bg-background/90 hover:border-border hover:shadow-xl dark:hover:shadow-[0_14px_36px_rgba(0,0,0,0.62)] transition-all duration-200";
    const checkIconClassName =
        "h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300 dark:drop-shadow-[0_1px_3px_rgba(0,0,0,0.65)]";
    const pencilIconClassName =
        "h-5 w-5 shrink-0 text-foreground dark:text-slate-50 dark:drop-shadow-[0_1px_3px_rgba(0,0,0,0.65)]";

    // Use a unique key for each dashboard (semester or course)
    const dashboardKey = dashboard.semesterId || dashboard.courseId || 'default';
    const editModeStorageKey = `dashboard-edit-mode-${dashboardKey}`;
    const legacyLockedStorageKey = `dashboard-locked-${dashboardKey}`;

    // Initialize edit mode state from localStorage.
    // Falls back to the legacy "locked" key for backward compatibility.
    const [isEditMode, setIsEditMode] = React.useState(() => {
        try {
            const storedEditMode = localStorage.getItem(editModeStorageKey);
            if (storedEditMode !== null) {
                return storedEditMode === 'true';
            }
            const storedLocked = localStorage.getItem(legacyLockedStorageKey);
            if (storedLocked !== null) {
                return storedLocked !== 'true';
            }
            return true;
        } catch {
            return true;
        }
    });

    // Sync state when dashboard changes (navigating between dashboards)
    React.useEffect(() => {
        try {
            const storedEditMode = localStorage.getItem(editModeStorageKey);
            if (storedEditMode !== null) {
                setIsEditMode(storedEditMode === 'true');
                return;
            }
            const storedLocked = localStorage.getItem(legacyLockedStorageKey);
            if (storedLocked !== null) {
                setIsEditMode(storedLocked !== 'true');
                return;
            }
            setIsEditMode(true);
        } catch {
            setIsEditMode(true);
        }
    }, [editModeStorageKey, legacyLockedStorageKey]);

    // Persist edit mode state to localStorage
    const toggleEditMode = React.useCallback(() => {
        setIsEditMode(prev => {
            const newValue = !prev;
            try {
                localStorage.setItem(editModeStorageKey, String(newValue));
            } catch {
                // Ignore storage errors
            }
            return newValue;
        });
    }, [editModeStorageKey]);

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
        <div className="relative">
            {/* Bottom-right action dock */}
            <div className="pointer-events-none fixed right-4 bottom-4 z-30 flex items-center md:right-8 md:bottom-8">
                <AnimatePresence>
                    {isEditMode && (
                        <motion.div
                            initial={{ width: 0, opacity: 0, scale: 0.8 }}
                            animate={{ width: "auto", opacity: 1, scale: 1 }}
                            exit={{ width: 0, opacity: 0, scale: 0.8 }}
                            transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
                            className="pointer-events-auto origin-right flex items-center justify-end pr-2"
                        >
                            <Button
                                onClick={dashboard.onAddWidgetClick}
                                variant="outline"
                                className={`${glassButtonClassName.replace("transition-all", "transition-colors")} size-[3.25rem] p-0 rounded-full inline-flex items-center justify-center shrink-0 text-foreground hover:text-foreground dark:text-slate-100 dark:hover:text-white`}
                                aria-label="Add widget"
                            >
                                <Plus className="h-5 w-5 shrink-0" aria-hidden="true" />
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.button
                    layout
                    onClick={toggleEditMode}
                    className={`pointer-events-auto relative flex items-center justify-center shrink-0 shadow-lg cursor-pointer outline-none ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 size-[3.25rem] rounded-full p-0 ${isEditMode
                        ? "border border-emerald-500/60 bg-emerald-500/14 text-emerald-900 dark:border-emerald-400/55 dark:bg-slate-900/90 dark:text-slate-50 hover:text-emerald-900 dark:hover:text-white shadow-[0_0_0_1px_rgba(16,185,129,0.28),0_10px_24px_rgba(15,23,42,0.18)] dark:shadow-[0_0_0_1px_rgba(74,222,128,0.38),0_16px_34px_rgba(2,6,23,0.72)] backdrop-blur-md backdrop-saturate-150 hover:bg-emerald-500/18 dark:hover:bg-slate-900 transition-colors duration-200"
                        : `${glassButtonClassName.replace("transition-all", "transition-colors")} text-foreground hover:text-foreground dark:text-slate-50 dark:hover:text-white`
                        }`}
                    aria-label={isEditMode ? "Complete editing" : "Edit dashboard"}
                    aria-pressed={isEditMode}
                    title={isEditMode ? "Complete editing" : "Edit dashboard"}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                >
                    {/* Inner clip wrapper: clips the icon transition without touching the shadow */}
                    <span className="relative flex items-center justify-center overflow-hidden pointer-events-none w-full h-full rounded-full">
                        <AnimatePresence mode="popLayout" initial={false}>
                            {isEditMode ? (
                                <motion.div
                                    key="edit"
                                    initial={{ opacity: 0, scale: 0.5, rotate: -90, filter: "blur(4px)" }}
                                    animate={{ opacity: 1, scale: 1, rotate: 0, filter: "blur(0px)" }}
                                    exit={{ opacity: 0, scale: 0.5, rotate: 90, filter: "blur(4px)" }}
                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    className="flex items-center justify-center w-full h-full"
                                >
                                    <Check className={checkIconClassName} aria-hidden="true" />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="view"
                                    initial={{ opacity: 0, scale: 0.5, rotate: 45, filter: "blur(4px)" }}
                                    animate={{ opacity: 1, scale: 1, rotate: 0, filter: "blur(0px)" }}
                                    exit={{ opacity: 0, scale: 0.5, rotate: -45, filter: "blur(4px)" }}
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        className="flex items-center justify-center w-full h-full"
                                >
                                    <Pencil className={pencilIconClassName} aria-hidden="true" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </span>
                </motion.button>
            </div>

            <DashboardGrid
                widgets={dashboard.widgets}
                onLayoutChange={dashboard.onLayoutChange}
                onLayoutCommit={dashboard.onLayoutCommit}
                onRemoveWidget={dashboard.onRemoveWidget}
                onEditWidget={dashboard.onEditWidget}
                onUpdateWidget={dashboard.onUpdateWidget}
                onUpdateWidgetDebounced={dashboard.onUpdateWidgetDebounced}
                semesterId={dashboard.semesterId}
                courseId={dashboard.courseId}
                updateCourse={dashboard.updateCourse}
                isEditMode={isEditMode}
            />
        </div>
    );
};
export const BuiltinDashboardTab = BuiltinDashboardTabComponent;

export const BuiltinDashboardTabDefinition: TabDefinition = {
    type: 'dashboard',
    component: BuiltinDashboardTab,
};
