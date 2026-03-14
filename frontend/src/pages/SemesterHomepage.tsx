// input:  [semester context, dashboard tab/widget hooks, plugin metadata/settings/load-state registries, unavailable-widget cleanup actions, active tab selection state, and shared business empty-state wrappers]
// output: [`SemesterHomepage` and internal `SemesterHomepageContent` composition component]
// pos:    [Semester workspace page with workspace navigation, dashboard-only overview stats, and standardized unavailable/not-found empty states]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { Layout } from '../components/Layout';
import { AppEmptyState } from '../components/AppEmptyState';
import { Button } from '@/components/ui/button';

import { AddWidgetModal } from '../components/AddWidgetModal';
import { AddTabModal } from '../components/AddTabModal';
import { Tabs } from '../components/Tabs';
import type { WidgetItem } from '../components/widgets/DashboardGrid';
import { WidgetSettingsModal } from '../components/WidgetSettingsModal';
import { CardSkeleton } from '../components/skeletons';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Container } from '../components/Container';
import { useDashboardWidgets } from '../hooks/useDashboardWidgets';
import { useDashboardTabs } from '../hooks/useDashboardTabs';
import { useVisibleTabSettingsPreload } from '../hooks/useVisibleTabSettingsPreload';
import { SemesterDataProvider, useSemesterData } from '../contexts/SemesterDataContext';
import { BuiltinTabProvider } from '../contexts/BuiltinTabContext';
import { SemesterSettingsPanel } from '../components/SemesterSettingsPanel';
import { WorkspaceNav } from '../components/WorkspaceNav';
import { WorkspaceOverviewStats } from '../components/WorkspaceOverviewStats';
import { BookOpen, GraduationCap, Percent } from 'lucide-react';

import { PluginContentFadeIn, PluginTabSkeleton } from '../plugin-system/PluginLoadSkeleton';
import {
    getTabPluginLoadState,
    getTabComponentByType,
    getTabSettingsComponentByType,
    hasTabPluginForType,
    PluginSettingsSectionRenderer,
    usePluginLoadStateVersion,
    usePluginSettingsRegistry,
    useTabPluginLoadState,
} from '../plugin-system';
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
    const { semester, saveSemester, refreshSemester, isLoading } = useSemesterData();
    const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
    const [isAddTabOpen, setIsAddTabOpen] = useState(false);
    const [editingWidget, setEditingWidget] = useState<WidgetItem | null>(null);
    const [activeTabId, setActiveTabId] = useState('');

    const [programName, setProgramName] = useState<string | null>(null);
    const openAddWidgetModal = useCallback(() => {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) {
            activeElement.blur();
        }
        setIsAddWidgetOpen(true);
    }, []);
    const openAddTabModal = useCallback(() => {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) {
            activeElement.blur();
        }
        setIsAddTabOpen(true);
    }, []);

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
        removeUnavailableWidget: handleRemoveUnavailableWidget,
        updateLayout: handleLayoutChange,
        commitLayout: handleLayoutCommit
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

    const pluginSettingsDefinitions = usePluginSettingsRegistry('semester');
    const activeTabType = useMemo(
        () => visibleTabs.find((tab) => tab.id === activeTabId)?.type,
        [activeTabId, visibleTabs]
    );
    const activeTabLoadState = useTabPluginLoadState(activeTabType);
    const isSettingsTabActive = activeTabType === HOMEPAGE_SETTINGS_TAB_TYPE;
    const pluginLoadStateVersion = usePluginLoadStateVersion();
    useVisibleTabSettingsPreload({
        tabs: visibleTabs,
        enabled: isSettingsTabActive,
        ignoredTypes: [HOMEPAGE_DASHBOARD_TAB_TYPE, HOMEPAGE_SETTINGS_TAB_TYPE],
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



    const breadcrumb = (
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
    );

    const semesterOverview = useMemo(() => {
        if (!semester) return null;

        const totalCredits = semester.courses?.reduce((sum, course) => sum + (course.credits || 0), 0) || 0;
        return (
            <WorkspaceOverviewStats
                items={[
                    {
                        label: 'Credits',
                        icon: <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />,
                        value: (
                            <AnimatedNumber
                                value={totalCredits}
                                format={(value) => value.toFixed(2)}
                            />
                        ),
                    },
                    {
                        label: 'Average',
                        icon: <Percent className="h-3.5 w-3.5" aria-hidden="true" />,
                        value: (
                            <AnimatedNumber
                                value={semester.average_percentage}
                                format={(value) => `${value.toFixed(1)}%`}
                            />
                        ),
                    },
                    {
                        label: 'GPA',
                        icon: <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />,
                        value: (
                            <AnimatedNumber
                                value={semester.average_scaled}
                                format={(value) => value.toFixed(2)}
                                rainbowThreshold={3.8}
                            />
                        ),
                    },
                ]}
            />
        );
    }, [semester]);

    const dashboardContent = useMemo(() => {
        if (!semester) return null;
        if (!activeTabId) return <PluginTabSkeleton />;
        const activeTab = visibleTabs.find(tab => tab.id === activeTabId);
        const TabComponent = activeTab ? getTabComponentByType(activeTab.type) : undefined;
        if (!activeTab) {
            return (
                <AppEmptyState
                    scenario="unavailable"
                    size="section"
                    title="Tab not found"
                    description="The requested tab is unavailable."
                />
            );
        }
        if (!TabComponent) {
            if (
                hasTabPluginForType(activeTab.type) &&
                (isActiveTabPluginLoading || activeTabLoadState.status === 'idle' || activeTabLoadState.status === 'loading')
            ) {
                return <PluginTabSkeleton />;
            }
            if (activeTabLoadState.status === 'error') {
                return (
                    <AppEmptyState
                        scenario="unavailable"
                        size="section"
                        title="Plugin failed to load"
                        description={activeTab.type}
                    />
                );
            }
            return (
                <AppEmptyState
                    scenario="unavailable"
                    size="section"
                    title="Unknown tab type"
                    description={activeTab.type}
                />
            );
        }
        return (
            <React.Suspense fallback={<PluginTabSkeleton />}>
                <PluginContentFadeIn key={activeTab.id}>
                    <TabComponent
                        tabId={activeTab.id}
                        settings={activeTab.settings || {}}
                        semesterId={semester.id}
                        updateSettings={(newSettings) => handleUpdateTabSettings(activeTab.id, newSettings)}
                    />
                </PluginContentFadeIn>
            </React.Suspense>
        );
    }, [activeTabId, semester, visibleTabs, handleUpdateTabSettings, isActiveTabPluginLoading, activeTabLoadState.status]);

    const handleUpdateSemester = useCallback(async (data: any) => {
        if (!semester) return;
        try {
            await saveSemester(data);
        } catch (error) {
            console.error("Failed to update semester", error);
        }
    }, [saveSemester, semester]);

    const tabInstanceSettingsSections = useMemo(() => {
        const sections = visibleTabs
            .filter((tab) => tab.type !== HOMEPAGE_DASHBOARD_TAB_TYPE && tab.type !== HOMEPAGE_SETTINGS_TAB_TYPE)
            .map((tab) => {
                const SettingsComponent = getTabSettingsComponentByType(tab.type);
                if (SettingsComponent) {
                    return (
                        <React.Fragment key={tab.id}>
                            <SettingsComponent
                                tabId={tab.id}
                                settings={tab.settings || {}}
                                semesterId={semester?.id}
                                updateSettings={(newSettings) => handleUpdateTabSettings(tab.id, newSettings)}
                            />
                        </React.Fragment>
                    );
                }
                if (!isSettingsTabActive) return null;

                if (!hasTabPluginForType(tab.type)) {
                    return (
                        <div
                            key={tab.id}
                            className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-muted-foreground"
                            role="status"
                            aria-live="polite"
                        >
                            Settings unavailable for {tab.title || tab.type}: unknown tab type.
                        </div>
                    );
                }

                const tabLoadState = getTabPluginLoadState(tab.type);
                if (tabLoadState.status === 'error') {
                    return (
                        <div
                            key={tab.id}
                            className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-muted-foreground"
                            role="status"
                            aria-live="polite"
                        >
                            Settings unavailable for {tab.title || tab.type}: plugin failed to load.
                        </div>
                    );
                }
                if (tabLoadState.status === 'loaded') return null;
                return (
                    <div
                        key={tab.id}
                        className="rounded-xl border border-border/70 bg-card/60 px-4 py-3 text-sm text-muted-foreground"
                        role="status"
                        aria-live="polite"
                    >
                        Loading settings for {tab.title || tab.type}...
                    </div>
                );
            })
            .filter(Boolean);

        if (sections.length === 0) return null;

        return (
            <div className="flex flex-col gap-4">
                {sections}
            </div>
        );
    }, [
        visibleTabs,
        semester?.id,
        handleUpdateTabSettings,
        isSettingsTabActive,
        pluginLoadStateVersion
    ]);

    const pluginSettingsSections = useMemo(() => {
        const sections = pluginSettingsDefinitions
            .map((definition) => {
                return (
                    <React.Fragment key={`${definition.pluginId}:${definition.id}`}>
                        <PluginSettingsSectionRenderer
                            pluginId={definition.pluginId}
                            component={definition.component}
                            semesterId={semester?.id}
                            onRefresh={refreshSemester}
                        />
                    </React.Fragment>
                );
            });

        if (sections.length === 0) return null;

        return (
            <div className="flex flex-col gap-4">
                {sections}
            </div>
        );
    }, [pluginSettingsDefinitions, semester?.id, refreshSemester]);

    const hasPluginSettings = Boolean(pluginSettingsSections || tabInstanceSettingsSections);

    const builtinTabContext = useMemo(() => ({
        isLoading: isLoading,
        dashboard: {
            widgets: widgets,
            overview: semesterOverview,
            onAddWidgetClick: openAddWidgetModal,
            onRemoveWidget: handleRemoveWidget,
            onRemoveUnavailableWidget: handleRemoveUnavailableWidget,
            onEditWidget: setEditingWidget,
            onUpdateWidget: handleUpdateWidget,
            onUpdateWidgetDebounced: handleUpdateWidgetDebounced,
            onLayoutChange: handleLayoutChange,
            onLayoutCommit: handleLayoutCommit,
            semesterId: semester?.id
        },
        settings: {
            content: (
                <SemesterSettingsPanel
                    initialName={semester?.name || ''}
                    initialSettings={{
                        start_date: semester?.start_date,
                        end_date: semester?.end_date,
                        reading_week_start: semester?.reading_week_start,
                        reading_week_end: semester?.reading_week_end,
                    }}
                    onSave={handleUpdateSemester}
                />
            ),
            extraSections: hasPluginSettings ? (
                <div className="space-y-6">
                    {pluginSettingsSections}
                    {tabInstanceSettingsSections}
                </div>
            ) : undefined
        }
    }), [
        isLoading,
        widgets,
        handleRemoveWidget,
        handleRemoveUnavailableWidget,
        handleUpdateWidget,
        handleUpdateWidgetDebounced,
        handleLayoutChange,
        handleLayoutCommit,
        semesterOverview,
        semester,
        handleUpdateSemester,
        hasPluginSettings,
        pluginSettingsSections,
        tabInstanceSettingsSections,
        openAddWidgetModal
    ]);

    return (
        <Layout breadcrumb={breadcrumb}>
            <BuiltinTabProvider value={builtinTabContext}>
                <WorkspaceNav
                    title={semester?.name || 'Semester'}
                    isLoading={isLoading || !semester}
                    tabsLoading={!areBuiltinTabsReady}
                    tabs={(
                        <Tabs
                            items={tabBarItems}
                            activeId={activeTabId}
                            onSelect={setActiveTabId}
                            onRemove={handleRemoveTab}
                            onReorder={handleReorderTabs}
                            onAdd={openAddTabModal}
                        />
                    )}
                />

                <Container className="py-5 sm:py-6">
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
                            semesterId={semester.id}
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
                    <AppEmptyState
                        scenario="not-found"
                        size="page"
                        title="Semester not found"
                        description="No semester ID provided."
                        primaryAction={(
                            <Link to="/">
                                <Button>Back to Home</Button>
                            </Link>
                        )}
                    />
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
