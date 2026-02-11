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
import { TabRegistry } from '../services/tabRegistry';
import { BuiltinTabProvider } from '../contexts/BuiltinTabContext';
import { useWidgetRegistry, resolveAllowedContexts } from '../services/widgetRegistry';
import { useStickyCollapse } from '../hooks/useStickyCollapse';
import { SemesterSettingsPanel } from '../components/SemesterSettingsPanel';
import { PluginTabSkeleton } from '../plugin-system/PluginLoadSkeleton';
import { getResolvedTabMetadataByType, hasTabPluginForType } from '../plugin-system';
import { useHomepageBuiltinTabs } from '../hooks/useHomepageBuiltinTabs';
import {
    HOMEPAGE_DASHBOARD_TAB_TYPE,
    HOMEPAGE_SETTINGS_TAB_TYPE,
    SEMESTER_HOMEPAGE_BUILTIN_TAB_CONFIG,
} from '../utils/homepageBuiltinTabs';


import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const SemesterHomepageContent: React.FC = () => {
    const { semester, updateSemester, refreshSemester, isLoading } = useSemesterData();
    const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
    const [isAddTabOpen, setIsAddTabOpen] = useState(false);
    const [editingWidget, setEditingWidget] = useState<WidgetItem | null>(null);
    const [activeTabId, setActiveTabId] = useState('');

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
        isInitialized: isTabsInitialized,
        addTab: handleAddTab,
        removeTab: handleRemoveTab,
        updateTabSettingsDebounced,
        reorderTabs
    } = useDashboardTabs({
        semesterId: semester?.id,
        initialTabs: semester?.tabs,
        onRefresh: refreshSemester
    });

    const onUpdateWidgetInner = async (id: string, data: any) => {
        await handleUpdateWidget(id, data);
        if (editingWidget && editingWidget.id === id) {
            setEditingWidget(null);
        }
    };

    const handleUpdateTabSettings = useCallback((tabId: string, newSettings: any) => {
        updateTabSettingsDebounced(tabId, { settings: JSON.stringify(newSettings) });
    }, [updateTabSettingsDebounced]);

    const ensureBuiltinTabInstance = useCallback((type: string) => {
        const isShellTab = type === HOMEPAGE_DASHBOARD_TAB_TYPE || type === HOMEPAGE_SETTINGS_TAB_TYPE;
        return handleAddTab(type, { isRemovable: false, isDraggable: !isShellTab });
    }, [handleAddTab]);

    // Centralize builtin-tab visibility/loading/order rules for homepage tabs.
    const {
        registeredTabTypes,
        isActiveTabPluginLoading,
        tabBarItems,
        visibleTabs,
        areBuiltinTabsReady,
        filterReorderableTabIds,
    } = useHomepageBuiltinTabs({
        tabs: customTabs,
        activeTabId,
        config: SEMESTER_HOMEPAGE_BUILTIN_TAB_CONFIG,
        isTabsInitialized,
        ensureBuiltinTabInstance,
    });

    const handleReorderTabs = useCallback((orderedIds: string[]) => {
        reorderTabs(filterReorderableTabIds(orderedIds));
    }, [filterReorderableTabIds, reorderTabs]);

    useEffect(() => {
        if (tabBarItems.length === 0) {
            if (activeTabId) setActiveTabId('');
            return;
        }
        if (!activeTabId && !areBuiltinTabsReady) return;
        if (!activeTabId || !tabBarItems.some(tab => tab.id === activeTabId)) {
            setActiveTabId(tabBarItems[0].id);
        }
    }, [activeTabId, areBuiltinTabsReady, tabBarItems]);



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
        if (!activeTabId) return <PluginTabSkeleton />;
        const activeTab = visibleTabs.find(tab => tab.id === activeTabId);
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
            if (isActiveTabPluginLoading && hasTabPluginForType(activeTab.type)) {
                return <PluginTabSkeleton />;
            }
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
    }, [activeTabId, semester, visibleTabs, handleUpdateTabSettings, isActiveTabPluginLoading]);

    const handleUpdateSemester = async (data: any) => {
        if (!semester) return;
        try {
            await updateSemester(data);
            refreshSemester();
        } catch (error) {
            console.error("Failed to update semester", error);
        }
    };

    const tabSettingsSections = useMemo(() => {
        const sections = visibleTabs
            .map(tab => {
            const definition = registeredTabTypes.has(tab.type) ? TabRegistry.get(tab.type) : undefined;
            const metadata = getResolvedTabMetadataByType(tab.type);
            const SettingsComponent = definition?.settingsComponent;
            if (!SettingsComponent) return null;
            return (
                <div key={tab.id} className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 pl-1">
                        <div className="text-[0.65rem] uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 font-semibold">
                            Plugin
                        </div>
                        <h3 className="m-0 text-[0.85rem] font-semibold text-muted-foreground uppercase tracking-wider">
                            {metadata.name ?? tab.title ?? tab.type}
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
            <div className="flex flex-col gap-8">
                {sections}
            </div>
        );
    }, [
        visibleTabs,
        semester?.id,
        handleUpdateTabSettings,
        registeredTabTypes
    ]);

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
                    <div key={def.type} className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 pl-1">
                            <div className="text-[0.65rem] uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 font-semibold">
                                Plugin
                            </div>
                            <h3 className="m-0 text-[0.85rem] font-semibold text-muted-foreground uppercase tracking-wider">
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
            <div className="flex flex-col gap-8">
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
            content: (
                <SemesterSettingsPanel
                    initialName={semester?.name || ''}
                    initialSettings={{
                        start_date: semester?.start_date,
                        end_date: semester?.end_date,
                    }}
                    onSave={handleUpdateSemester}
                />
            ),
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
                    className={`sticky-page-header sticky left-0 right-0 z-40 top-[60px] border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-[padding,box-shadow] duration-300 ease-out ${isShrunk ? 'shadow-sm' : 'shadow-none'}`}
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
                                            className="select-none truncate font-bold tracking-tight origin-left"
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
                                    className="select-none flex flex-wrap gap-6 overflow-hidden"
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
                            onAdd={handleAddWidget}
                            context="semester"
                            widgets={widgets}
                        />
                        <AddTabModal
                            isOpen={isAddTabOpen}
                            onClose={() => setIsAddTabOpen(false)}
                            onAdd={handleAddTab}
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
