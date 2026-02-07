import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { Layout } from '../components/Layout';
import { Button } from '@/components/ui/button';

import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { AddWidgetModal } from '../components/AddWidgetModal';
import { AddTabModal } from '../components/AddTabModal';
import { Tabs } from '../components/Tabs';
import type { WidgetItem } from '../components/widgets/DashboardGrid';
import { WidgetSettingsModal } from '../components/WidgetSettingsModal';
import { Skeleton } from '@/components/ui/skeleton';
import { CardSkeleton } from '../components/skeletons';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Container } from '../components/Container';
import { useDashboardWidgets } from '../hooks/useDashboardWidgets';
import { useDashboardTabs } from '../hooks/useDashboardTabs';
import { SemesterDataProvider, useSemesterData } from '../contexts/SemesterDataContext';
import { TabRegistry, useTabRegistry } from '../services/tabRegistry';
import { BuiltinTabProvider } from '../contexts/BuiltinTabContext';
import { useWidgetRegistry, resolveAllowedContexts } from '../services/widgetRegistry';
import { useStickyCollapse } from '../hooks/useStickyCollapse';


import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const BUILTIN_TIMETABLE_TAB_ID = 'builtin-academic-timetable';
const LEGACY_SCHEDULE_TAB_ID = 'schedule';

const SemesterHomepageContent: React.FC = () => {
    const { semester, updateSemester, refreshSemester, isLoading } = useSemesterData();
    const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
    const [isAddTabOpen, setIsAddTabOpen] = useState(false);
    const [editingWidget, setEditingWidget] = useState<WidgetItem | null>(null);
    const [activeTabId, setActiveTabId] = useState('dashboard');

    // Subscribe to tab registry changes so we re-render when builtin tabs are loaded
    const registeredTabs = useTabRegistry();

    const [programName, setProgramName] = useState<string | null>(null);

    const { isShrunk, heroRef, heroSpacerHeight } = useStickyCollapse();

    useEffect(() => {
        let isActive = true;
        const programId = semester?.program_id;
        if (!programId) {
            setProgramName(null);
            return () => {
                isActive = false;
            };
        }
        api.getProgram(programId)
            .then((program) => {
                if (isActive) {
                    setProgramName(program.name);
                }
            })
            .catch(() => {
                if (isActive) {
                    setProgramName(null);
                }
            });
        return () => {
            isActive = false;
        };
    }, [semester?.program_id]);

    const {
        widgets,
        addWidget: handleAddWidget,
        updateWidget: handleUpdateWidget,
        updateWidgetDebounced: handleUpdateWidgetDebounced,
        removeWidget: handleRemoveWidget,
        updateLayout: handleLayoutChange
    } = useDashboardWidgets({
        semesterId: semester?.id,
        initialWidgets: semester?.widgets,
        onRefresh: refreshSemester
    });

    const {
        tabs: customTabs,
        addTab: handleAddTab,
        removeTab: handleRemoveTab,
        updateTabSettingsDebounced,
        reorderTabs
    } = useDashboardTabs({
        semesterId: semester?.id,
        initialTabs: semester?.tabs,
        onRefresh: refreshSemester
    });

    const onAddWidgetInner = (type: string) => {
        handleAddWidget(type);
        setIsAddWidgetOpen(false);
    };

    const onUpdateWidgetInner = async (id: string, data: any) => {
        await handleUpdateWidget(id, data);
        if (editingWidget && editingWidget.id === id) {
            setEditingWidget(null);
        }
    };

    const onAddTabInner = (type: string) => {
        handleAddTab(type);
        setIsAddTabOpen(false);
    };

    const handleUpdateTabSettings = useCallback((tabId: string, newSettings: any) => {
        updateTabSettingsDebounced(tabId, { settings: JSON.stringify(newSettings) });
    }, [updateTabSettingsDebounced]);

    // Create a lookup for registered tab types to trigger re-render when tabs load
    const registeredTabTypes = useMemo(() => new Set(registeredTabs.map(t => t.type)), [registeredTabs]);

    const scheduleTabId = useMemo(
        () => (registeredTabTypes.has(BUILTIN_TIMETABLE_TAB_ID) ? BUILTIN_TIMETABLE_TAB_ID : LEGACY_SCHEDULE_TAB_ID),
        [registeredTabTypes]
    );

    const pluginTabItems = useMemo(() => {
        return customTabs.map(tab => {
            const definition = TabRegistry.get(tab.type);
            return {
                id: tab.id,
                label: definition?.name ?? tab.title ?? tab.type,
                icon: definition?.icon,
                removable: tab.is_removable !== false,
                draggable: tab.is_removable !== false
            };
        });
    }, [customTabs]);

    const tabBarItems = useMemo(() => {
        const dashboardDef = TabRegistry.get('dashboard');
        const scheduleDef = TabRegistry.get(scheduleTabId);
        const settingsDef = TabRegistry.get('settings');
        return [
            {
                id: 'dashboard',
                label: dashboardDef?.name ?? 'Dashboard',
                icon: dashboardDef?.icon,
                draggable: false,
                removable: false
            },
            {
                id: scheduleTabId,
                label: scheduleDef?.name ?? 'Schedule',
                icon: scheduleDef?.icon,
                draggable: false,
                removable: false
            },
            ...pluginTabItems,
            {
                id: 'settings',
                label: settingsDef?.name ?? 'Settings',
                icon: settingsDef?.icon,
                draggable: false,
                removable: false
            }
        ];
    }, [pluginTabItems, scheduleTabId]);

    const handleReorderTabs = useCallback((orderedIds: string[]) => {
        const pluginIdSet = new Set(customTabs.map(tab => tab.id));
        reorderTabs(orderedIds.filter(id => pluginIdSet.has(id)));
    }, [reorderTabs, customTabs]);



    const breadcrumb = useMemo(() => (
        <Breadcrumb>
            <BreadcrumbList className="text-xs font-medium text-muted-foreground">
                <BreadcrumbItem>
                    <BreadcrumbLink asChild className="text-muted-foreground hover:text-foreground transition-colors">
                        <Link to="/">Academics</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                {semester?.program_id && (
                    <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild className="text-muted-foreground hover:text-foreground transition-colors">
                                <Link to={`/programs/${semester.program_id}`}>
                                    {programName || 'Program'}
                                </Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                    </>
                )}
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbPage className="text-foreground font-semibold">
                        {semester?.name || 'Semester'}
                    </BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    ), [semester?.program_id, semester?.name, programName]);

    const dashboardContent = useMemo(() => {
        if (!semester) return null;
        if (activeTabId === 'dashboard' || activeTabId === 'settings' || activeTabId === scheduleTabId) {
            const BuiltinComponent = TabRegistry.getComponent(activeTabId);
            if (!BuiltinComponent) {
                return (
                    <Empty className="bg-muted/40">
                        <EmptyHeader>
                            <EmptyTitle>Builtin tab not found</EmptyTitle>
                            <EmptyDescription>
                                The requested tab is unavailable.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                );
            }
            return (
                <BuiltinComponent
                    tabId={activeTabId}
                    settings={{}}
                    semesterId={semester.id}
                    updateSettings={() => { }}
                />
            );
        }
        const activeTab = customTabs.find(tab => tab.id === activeTabId);
        const TabComponent = activeTab ? TabRegistry.getComponent(activeTab.type) : undefined;
        if (!activeTab) {
            return (
                <Empty className="bg-muted/40">
                    <EmptyHeader>
                        <EmptyTitle>Tab not found</EmptyTitle>
                        <EmptyDescription>
                            The requested tab is unavailable.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            );
        }
        if (!TabComponent) {
            return (
                <Empty className="bg-muted/40">
                    <EmptyHeader>
                        <EmptyTitle>Unknown tab type</EmptyTitle>
                        <EmptyDescription>
                            {activeTab.type}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            );
        }
        return (
            <React.Suspense fallback={<div className="p-8">Loading tab...</div>}>
                <TabComponent
                    tabId={activeTab.id}
                    settings={activeTab.settings || {}}
                    semesterId={semester.id}
                    updateSettings={(newSettings) => handleUpdateTabSettings(activeTab.id, newSettings)}
                />
            </React.Suspense>
        );
    }, [activeTabId, semester, customTabs, handleUpdateTabSettings, registeredTabTypes, scheduleTabId]);

    const handleUpdateSemester = async (data: any) => {
        if (!semester) return;
        try {
            await updateSemester(data);
            refreshSemester();
        } catch (error) {
            console.error("Failed to update semester", error);
        }
    };

    // Tab settings sections logic from CourseHomepage if needed, otherwise simplified as in original?
    // Original SemesterHomepage didn't have the explicit settings sections renderer in the settings tab, 
    // it seems `BuiltinTabContext` handles settings usually? 
    // Wait, the `settings` tab in `BuiltinTabContext` takes `extraSections`.
    // Let's implement that to match CourseHomepage logic.

    const tabSettingsSections = useMemo(() => {
        const sections = customTabs.map(tab => {
            const definition = TabRegistry.get(tab.type);
            const SettingsComponent = definition?.settingsComponent;
            if (!SettingsComponent) return null;
            return (
                <div key={tab.id} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        paddingLeft: '0.25rem'
                    }}>
                        <div className="text-[0.65rem] uppercase tracking-[0.05em] text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 font-semibold">
                            Plugin
                        </div>
                        <h3 className="m-0 text-[0.85rem] font-semibold text-muted-foreground uppercase tracking-[0.05em]">
                            {definition?.name ?? tab.title ?? tab.type}
                        </h3>
                    </div>

                    <SettingsComponent
                        tabId={tab.id}
                        settings={tab.settings || {}}
                        semesterId={semester?.id}
                        updateSettings={(newSettings) => handleUpdateTabSettings(tab.id, newSettings)}
                    />
                </div>
            );
        }).filter(Boolean);

        if (sections.length === 0) return null;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {sections}
            </div>
        );
    }, [customTabs, semester?.id, handleUpdateTabSettings]);

    // Widget plugin global settings sections
    const widgetDefinitions = useWidgetRegistry();
    const widgetSettingsSections = useMemo(() => {
        const sections = widgetDefinitions
            .filter(def => {
                // Only show settings for widgets allowed in semester context
                const allowedContexts = resolveAllowedContexts(def);
                return allowedContexts.includes('semester') && def.globalSettingsComponent;
            })
            .map(def => {
                const GlobalSettingsComponent = def.globalSettingsComponent!;
                return (
                    <div key={def.type} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            paddingLeft: '0.25rem'
                        }}>
                            <div className="text-[0.65rem] uppercase tracking-[0.05em] text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 font-semibold">
                                Plugin
                            </div>
                            <h3 className="m-0 text-[0.85rem] font-semibold text-muted-foreground uppercase tracking-[0.05em]">
                                {def.name}
                            </h3>
                        </div>
                        <GlobalSettingsComponent
                            semesterId={semester?.id}
                            onRefresh={refreshSemester}
                        />
                    </div>
                );
            });

        if (sections.length === 0) return null;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {sections}
            </div>
        );
    }, [widgetDefinitions, semester?.id, refreshSemester]);

    const builtinTabContext = useMemo(() => ({
        isLoading: isLoading,
        dashboard: {
            widgets: widgets,
            onAddWidgetClick: () => setIsAddWidgetOpen(true),
            onRemoveWidget: handleRemoveWidget,
            onEditWidget: setEditingWidget,
            onUpdateWidget: handleUpdateWidget,
            onUpdateWidgetDebounced: handleUpdateWidgetDebounced,
            onLayoutChange: handleLayoutChange,
            semesterId: semester?.id
        },
        settings: {
            initialName: semester?.name || '',
            initialSettings: {}, // Semester might not have extra settings yet
            onSave: handleUpdateSemester,
            type: 'semester' as const,
            extraSections: (
                <>
                    {widgetSettingsSections}
                    {tabSettingsSections}
                </>
            )
        }
    }), [
        isLoading,
        widgets,
        handleRemoveWidget,
        handleUpdateWidget,
        handleUpdateWidgetDebounced,
        handleLayoutChange,
        semester,
        handleUpdateSemester,
        tabSettingsSections,
        widgetSettingsSections
    ]);

    return (
        <Layout breadcrumb={breadcrumb}>
            <BuiltinTabProvider value={builtinTabContext}>
                <div
                    ref={heroRef}
                    className={`sticky left-0 right-0 z-40 top-[60px] border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-[padding,box-shadow] duration-300 ease-out ${isShrunk ? 'shadow-sm' : 'shadow-none'}`}
                    style={{
                        paddingTop: isShrunk ? '8px' : '16px',
                        paddingBottom: isShrunk ? '8px' : '16px'
                    }}
                >
                    <Container className="flex flex-wrap items-center">
                        <div className="flex flex-col gap-2 relative w-full">
                            <div className="min-w-0">
                                {isLoading || !semester ? (
                                    <Skeleton className="h-12 w-3/5" />
                                ) : (
                                        <h1
                                            className="noselect text-truncate font-bold tracking-tight origin-left"
                                            style={{
                                                fontSize: '2.25rem',
                                                lineHeight: '2.5rem',
                                                transformOrigin: 'left center',
                                                transform: isShrunk ? 'scale(0.8)' : 'scale(1)',
                                                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                            }}
                                        >
                                            {semester.name}
                                    </h1>
                                )}

                                <div
                                    className="noselect flex flex-wrap gap-6 overflow-hidden"
                                    style={{
                                        maxHeight: isShrunk ? '0px' : '140px',
                                        opacity: isShrunk ? 0 : 1,
                                        marginTop: isShrunk ? '0' : '0.75rem',
                                        transform: isShrunk ? 'translateY(-8px)' : 'translateY(0)',
                                        transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease, margin-top 0.3s ease, transform 0.3s ease'
                                    }}
                                >
                                    {/* Stats content ... unchanged */}
                                    <div className="min-w-[72px]">
                                        <div className="text-xs uppercase tracking-wider text-muted-foreground/80">Credits</div>
                                        <div className="text-2xl font-semibold">
                                            {isLoading || !semester ? (
                                                <Skeleton className="h-6 w-8" />
                                            ) : (
                                                <AnimatedNumber
                                                    value={semester.courses?.reduce((sum, course) => sum + (course.credits || 0), 0) || 0}
                                                    format={(val) => val.toFixed(2)}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <div className="min-w-[96px]">
                                        <div className="text-xs uppercase tracking-wider text-muted-foreground/80">Avg</div>
                                        <div className="text-2xl font-semibold">
                                            {isLoading || !semester ? (
                                                <Skeleton className="h-6 w-12" />
                                            ) : (
                                                <AnimatedNumber
                                                    value={semester.average_percentage}
                                                    format={(val) => `${val.toFixed(1)}%`}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <div className="min-w-[80px]">
                                        <div className="text-xs uppercase tracking-wider text-muted-foreground/80">GPA</div>
                                        <div className="text-2xl font-semibold">
                                            {isLoading || !semester ? (
                                                <Skeleton className="h-6 w-10" />
                                            ) : (
                                                <AnimatedNumber
                                                    value={semester.average_scaled}
                                                    format={(val) => val.toFixed(2)}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="w-full mt-4">
                            <Tabs
                                items={tabBarItems}
                                activeId={activeTabId}
                                onSelect={setActiveTabId}
                                onRemove={handleRemoveTab}
                                onReorder={handleReorderTabs}
                                onAdd={() => setIsAddTabOpen(true)}
                            />
                        </div>
                    </Container>
                </div>

                <Container className="py-4">
                    {isLoading || !semester ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <CardSkeleton key={i} className="h-[240px]" />
                            ))}
                        </div>
                    ) : (
                            dashboardContent
                    )}
                </Container>
                <div
                    aria-hidden="true"
                    style={{ height: isShrunk ? heroSpacerHeight : 0 }}
                />

                {semester && (
                    <>
                        <AddWidgetModal
                            isOpen={isAddWidgetOpen}
                            onClose={() => setIsAddWidgetOpen(false)}
                            onAdd={onAddWidgetInner}
                            context="semester"
                            widgets={widgets}
                        />
                        <AddTabModal
                            isOpen={isAddTabOpen}
                            onClose={() => setIsAddTabOpen(false)}
                            onAdd={onAddTabInner}
                            context="semester"
                            tabs={customTabs}
                        />
                        <WidgetSettingsModal
                            isOpen={!!editingWidget}
                            onClose={() => setEditingWidget(null)}
                            widget={editingWidget}
                            onSave={onUpdateWidgetInner}
                        />
                    </>
                )}
            </BuiltinTabProvider>
        </Layout>
    );
};

export const SemesterHomepage: React.FC = () => {
    const { id } = useParams<{ id: string }>();

    if (!id) {
        return (
            <Layout>
                <Container>
                    <Empty className="my-16">
                        <EmptyHeader>
                            <EmptyTitle>Semester not found</EmptyTitle>
                            <EmptyDescription>No semester ID provided.</EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Link to="/">
                                <Button>Back to Home</Button>
                            </Link>
                        </EmptyContent>
                    </Empty>
                </Container>
            </Layout>
        );
    }

    return (
        <SemesterDataProvider semesterId={id}>
            <SemesterHomepageContent />
        </SemesterDataProvider>
    );
};
