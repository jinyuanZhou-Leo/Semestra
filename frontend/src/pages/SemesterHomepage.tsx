// input:  [semester context, app-side Program resource queries plus cache helpers, Program->Semester runtime plugin management payloads, dashboard tab/widget hooks, plugin metadata/settings/load-state registries, host-owned semester course management settings, plugin host navigation provider, unavailable-widget cleanup actions, active tab selection state, plugin-derived homepage shell-tab rules, page-scoped global-command actions including semester-course navigation, shared GPA-percentage formatting, and shared business empty-state wrappers]
// output: [`SemesterHomepage` and internal `SemesterHomepageContent` composition component]
// pos:    [Semester workspace page with workspace navigation, flattened Program/Semester breadcrumb reuse, runtime-governed plugin availability, plugin-derived dashboard/settings shell tabs, global command actions for current-semester tab switching and semester-course navigation plus widget creation, host-owned semester course management settings, plugin-identified settings sections with manifest icons, workspace-scoped plugin host wiring, dashboard-only overview stats, and standardized unavailable/not-found empty states]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { programKeys } from '@/data/keys';
import type { Program, Semester } from '@/services/api';
import {
    getProgramDetailQueryOptions,
    invalidateProgramDetailQuery,
    setProgramDetailQueryData,
} from '@/data/resources';
import api from '../services/api';
import { Layout } from '../components/Layout';
import { AppEmptyState } from '../components/AppEmptyState';
import { Button } from '@/components/ui/button';

import { AddWidgetModal } from '../components/AddWidgetModal';
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
import { SemesterPluginManagementPanel } from '../components/SemesterPluginManagementPanel';
import { SemesterCourseManagementSection } from '../components/SemesterCourseManagementSection';
import { SemesterSettingsPanel } from '../components/SemesterSettingsPanel';
import { WorkspaceNav } from '../components/WorkspaceNav';
import { WorkspaceOverviewStats } from '../components/WorkspaceOverviewStats';
import { BookOpen, GraduationCap, Percent, Plus, Settings, LayoutDashboard } from 'lucide-react';
import { formatGpaPercentage } from '@/utils/percentage';
import type { LayoutCommandGroup } from '../components/GlobalCommandPalette';

import { PluginContentFadeIn, PluginTabSkeleton } from '../plugin-system/PluginLoadSkeleton';
import {
    getResolvedTabMetadataByType,
    getTabComponentByType,
    hasTabPluginForType,
    PluginHostProvider,
    PluginRuntimeInstanceProvider,
    PluginSettingsSectionsGroup,
    useTabPluginLoadState,
} from '../plugin-system';
import { useHomepageBuiltinTabs } from '../hooks/useHomepageBuiltinTabs';
import {
    HOMEPAGE_DASHBOARD_TAB_TYPE,
    HOMEPAGE_SETTINGS_TAB_TYPE,
    SEMESTER_HOMEPAGE_BUILTIN_TAB_CONFIG,
} from '../utils/homepageBuiltinTabs';
import { resolveSemesterActiveTabId } from './semesterHomepageNavigation';
import {
    PROGRAM_HOME_TAB_TYPE,
    isProgramHomePinned,
    parseProgramHomeSettings,
    removeProgramHomeItem,
    replaceProgramHomeTabSetting,
    serializeProgramHomeSettings,
    upsertProgramHomeItem,
} from '@/utils/programHome';
import {
    filterWidgetItemsByEnabledPlugins,
    resolveAvailableWidgetTypes,
    resolveEnabledPluginIds,
    resolveRuntimeTabs,
} from '../plugin-system/runtimeAvailability';


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
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
    const [editingWidget, setEditingWidget] = useState<WidgetItem | null>(null);
    const [activeTabId, setActiveTabId] = useState('');
    const lastActiveTabTypeRef = useRef<string | null>(null);
    const openAddWidgetModal = useCallback(() => {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) {
            activeElement.blur();
        }
        setIsAddWidgetOpen(true);
    }, []);
    const parentProgramQuery = useQuery({
        ...getProgramDetailQueryOptions(semester?.program_id ?? 'unknown'),
        queryFn: async () => {
            const programId = semester?.program_id;
            if (!programId) {
                throw new Error('Missing parent program ID.');
            }
            return api.getProgram(programId);
        },
        enabled: Boolean(semester?.program_id),
        staleTime: 300_000,
        initialData: (): (Program & { semesters: Semester[] }) | undefined => {
            const programId = semester?.program_id;
            if (!programId) return undefined;
            const cachedProgram = queryClient.getQueryData<Program & { semesters: Semester[] }>(programKeys.detail(programId));
            if (cachedProgram) {
                return cachedProgram;
            }
            if (!semester?.program) {
                return undefined;
            }
            return {
                ...semester.program,
                semesters: [],
            };
        },
    });
    const programName = parentProgramQuery.data?.name ?? null;
    const isPinnedToProgramHome = useMemo(() => {
        if (!parentProgramQuery.data || !semester?.id) {
            return false;
        }
        return isProgramHomePinned(
            parseProgramHomeSettings(parentProgramQuery.data.tab_settings),
            'semester',
            semester.id,
        );
    }, [parentProgramQuery.data, semester]);

    const runtimeTabs = useMemo(
        () => resolveRuntimeTabs(semester?.runtime, `semester:${semester?.id ?? 'unknown'}`),
        [semester?.id, semester?.runtime]
    );
    const enabledPluginIds = useMemo(() => resolveEnabledPluginIds(semester?.runtime), [semester?.runtime]);
    const availableWidgetTypes = useMemo(
        () => Array.from(resolveAvailableWidgetTypes(semester?.runtime)),
        [semester?.runtime]
    );
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
    const visibleWidgets = useMemo(
        () => filterWidgetItemsByEnabledPlugins(widgets, enabledPluginIds),
        [enabledPluginIds, widgets]
    );

    const {
        tabs: customTabs,
        isInitialized: isTabsInitialized,
        reorderTabs
    } = useDashboardTabs({
        semesterId: semester?.id,
        orderOwnerSemesterId: semester?.id,
        initialTabs: runtimeTabs,
        managed: true,
        onRefresh: refreshSemester
    });

    const onUpdateWidgetInner = async (id: string, data: any) => {
        await handleUpdateWidget(id, data);
        if (editingWidget && editingWidget.id === id) {
            setEditingWidget(null);
        }
    };

    const {
        isActiveTabPluginLoading,
        tabBarItems,
        visibleTabs,
        areBuiltinTabsReady,
        filterReorderableTabIds,
    } = useHomepageBuiltinTabs({
        tabs: customTabs,
        activeTabId,
        scopeKey: `semester:${semester?.id ?? 'unknown'}`,
        config: SEMESTER_HOMEPAGE_BUILTIN_TAB_CONFIG,
        isTabsInitialized,
    });

    const activeTabType = useMemo(
        () => visibleTabs.find((tab) => tab.id === activeTabId)?.type,
        [activeTabId, visibleTabs]
    );
    useEffect(() => {
        if (activeTabType) {
            lastActiveTabTypeRef.current = activeTabType;
        }
    }, [activeTabType]);
    const activeTabLoadState = useTabPluginLoadState(activeTabType);
    const isSettingsTabActive = activeTabType === HOMEPAGE_SETTINGS_TAB_TYPE;
    useVisibleTabSettingsPreload({
        tabs: visibleTabs,
        enabled: isSettingsTabActive,
        ignoredTypes: [HOMEPAGE_DASHBOARD_TAB_TYPE, HOMEPAGE_SETTINGS_TAB_TYPE],
    });

    const handleReorderTabs = useCallback((orderedIds: string[]) => {
        reorderTabs(filterReorderableTabIds(orderedIds));
    }, [filterReorderableTabIds, reorderTabs]);
    const semesterCourseItems = useMemo(() => {
        const courses = semester?.courses ?? [];
        return [...courses]
            .sort((left, right) => left.name.localeCompare(right.name))
            .map((course) => ({
                id: `semester-course-${course.id}`,
                title: course.name,
                keywords: ['semester course', 'course', course.alias ?? '', course.category ?? ''],
                icon: BookOpen,
                onSelect: () => navigate(`/courses/${course.id}`),
            }));
    }, [navigate, semester?.courses]);
    const layoutCommandGroups = useMemo<LayoutCommandGroup[]>(() => {
        if (!semester?.id) {
            return [];
        }

        const semesterTabItems = visibleTabs.map((tab) => {
            const metadata = getResolvedTabMetadataByType(tab.type);
            const displayName = metadata.name ?? tab.title ?? tab.type;

            return {
                id: `semester-open-tab-${tab.id}`,
                title: displayName,
                description: `Switch to the ${displayName} tab.`,
                keywords: ['semester tab', 'tab', tab.type, tab.title, displayName],
                icon: metadata.icon ?? (
                    tab.type === HOMEPAGE_DASHBOARD_TAB_TYPE
                        ? LayoutDashboard
                        : tab.type === HOMEPAGE_SETTINGS_TAB_TYPE
                            ? Settings
                            : undefined
                ),
                onSelect: () => setActiveTabId(tab.id),
            };
        });

        return [
            {
                heading: 'Semester',
                items: [
                    ...semesterTabItems,
                    {
                        id: `semester-add-widget-${semester.id}`,
                        title: 'Add Widget',
                        description: 'Open the Semester widget picker.',
                        keywords: ['new widget', 'semester widget'],
                        icon: Plus,
                        onSelect: openAddWidgetModal,
                    },
                ],
            },
            {
                heading: 'Courses',
                items: semesterCourseItems,
            },
        ];
    }, [openAddWidgetModal, semester, semesterCourseItems, visibleTabs]);

    useEffect(() => {
        if (visibleTabs.length === 0) {
            if (activeTabId) setActiveTabId('');
            return;
        }
        const nextTabId = resolveSemesterActiveTabId({
            activeTabId,
            lastActiveTabType: lastActiveTabTypeRef.current,
            visibleTabs,
            areBuiltinTabsReady,
        });
        if (nextTabId && nextTabId !== activeTabId) {
            setActiveTabId(nextTabId);
        }
    }, [activeTabId, areBuiltinTabsReady, visibleTabs]);



    const breadcrumb = (
        <Breadcrumb>
            <BreadcrumbList className="text-xs font-medium text-muted-foreground">
                {semester?.program_id && (
                    <>
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild className="text-muted-foreground hover:text-foreground transition-colors">
                                <Link to={`/programs/${semester.program_id}`}>
                                    {programName || 'Program'}
                                </Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                    </>
                )}
                {semester?.program_id && <BreadcrumbSeparator />}
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
                                format={formatGpaPercentage}
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
        if (activeTab.availability?.state === 'unavailable') {
            return (
                <AppEmptyState
                    scenario="unavailable"
                    size="section"
                    title={`${activeTab.title || activeTab.type} is unavailable`}
                    description={
                        activeTab.availability.reason_message
                        || 'This tab is currently unavailable in this semester.'
                    }
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
                <PluginRuntimeInstanceProvider
                    value={{
                        workspaceKind: 'semester',
                        workspaceId: semester.id,
                        slotKind: 'tab',
                        slotId: activeTab.id,
                        pluginType: activeTab.type,
                    }}
                >
                    <PluginContentFadeIn key={activeTab.id}>
                        <TabComponent
                            tabId={activeTab.id}
                            semesterId={semester.id}
                        />
                    </PluginContentFadeIn>
                </PluginRuntimeInstanceProvider>
            </React.Suspense>
        );
    }, [activeTabId, semester, visibleTabs, isActiveTabPluginLoading, activeTabLoadState.status]);

    const handleUpdateSemester = useCallback(async (data: any) => {
        if (!semester) return;
        try {
            await saveSemester(data);
        } catch (error) {
            console.error("Failed to update semester", error);
        }
    }, [saveSemester, semester]);

    const handleTogglePinnedToHomepage = useCallback(async (nextValue: boolean) => {
        const programId = semester?.program_id;
        if (!programId || !semester?.id) {
            return;
        }

        const currentProgram = parentProgramQuery.data ?? queryClient.getQueryData(programKeys.detail(programId));
        if (!currentProgram) {
            return;
        }

        const currentSettings = parseProgramHomeSettings(currentProgram.tab_settings);
        const nextSettings = nextValue
            ? upsertProgramHomeItem(currentSettings, 'semester', semester.id, 'medium')
            : removeProgramHomeItem(currentSettings, 'semester', semester.id);
        const nextTabSettings = replaceProgramHomeTabSetting(currentProgram.tab_settings, nextSettings);

        setProgramDetailQueryData(queryClient, programId, (current: any) => (
            current ? { ...current, tab_settings: nextTabSettings } : current
        ));

        try {
            await api.upsertProgramTabSettings(programId, PROGRAM_HOME_TAB_TYPE, {
                settings: serializeProgramHomeSettings(nextSettings),
            });
        } catch (error) {
            console.error('Failed to update Program Home pin state', error);
            await invalidateProgramDetailQuery(queryClient, programId);
            await queryClient.refetchQueries({ queryKey: programKeys.detail(programId), type: 'active' });
        }
    }, [parentProgramQuery.data, queryClient, semester]);

    const pluginSettingsSections = useMemo(() => {
        const pluginActivations = semester?.plugin_activations ?? [];
        if (pluginActivations.length === 0 || enabledPluginIds.size === 0) {
            return null;
        }

        return (
            <PluginSettingsSectionsGroup
                context="semester"
                enabledPluginIds={enabledPluginIds}
                pluginActivations={pluginActivations}
                semesterId={semester?.id}
                onRefresh={refreshSemester}
            />
        );
    }, [enabledPluginIds, refreshSemester, semester?.id, semester?.plugin_activations]);

    const semesterCourseManagementSection = useMemo(() => {
        if (!semester?.id || !semester.program_id) {
            return null;
        }

        return (
            <SemesterCourseManagementSection
                semesterId={semester.id}
                onRefresh={refreshSemester}
            />
        );
    }, [refreshSemester, semester]);

    const hasPluginSettings = Boolean(semesterCourseManagementSection || pluginSettingsSections);

    const builtinDashboardContext = useMemo(() => ({
        isLoading,
        dashboard: {
            widgets: visibleWidgets,
            overview: semesterOverview,
            onAddWidgetClick: openAddWidgetModal,
            onRemoveWidget: handleRemoveWidget,
            onRemoveUnavailableWidget: handleRemoveUnavailableWidget,
            onEditWidget: setEditingWidget,
            onUpdateWidget: handleUpdateWidget,
            onUpdateWidgetDebounced: handleUpdateWidgetDebounced,
            onLayoutChange: handleLayoutChange,
            onLayoutCommit: handleLayoutCommit,
            semesterId: semester?.id,
        },
    }), [
        isLoading,
        visibleWidgets,
        semesterOverview,
        openAddWidgetModal,
        handleRemoveWidget,
        handleRemoveUnavailableWidget,
        handleUpdateWidget,
        handleUpdateWidgetDebounced,
        handleLayoutChange,
        handleLayoutCommit,
        semester?.id,
    ]);

    const builtinSettingsContext = useMemo(() => ({
        isLoading,
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
                    initialPinnedToHomepage={isPinnedToProgramHome}
                    onTogglePinnedToHomepage={handleTogglePinnedToHomepage}
                    onSave={handleUpdateSemester}
                />
            ),
            extraSections: hasPluginSettings ? (
                <div className="space-y-6">
                    {semester?.program_id ? (
                        <SemesterPluginManagementPanel
                            semesterId={semester.id}
                            pluginActivations={semester.plugin_activations ?? []}
                            onChanged={refreshSemester}
                        />
                    ) : null}
                    {semesterCourseManagementSection}
                    {pluginSettingsSections}
                </div>
            ) : semester?.program_id ? (
                <SemesterPluginManagementPanel
                    semesterId={semester.id}
                    pluginActivations={semester.plugin_activations ?? []}
                    onChanged={refreshSemester}
                />
            ) : undefined,
        },
    }), [
        isLoading,
        semester,
        isPinnedToProgramHome,
        handleTogglePinnedToHomepage,
        handleUpdateSemester,
        hasPluginSettings,
        semesterCourseManagementSection,
        pluginSettingsSections,
        refreshSemester,
    ]);

    return (
        <Layout breadcrumb={breadcrumb} commandGroups={layoutCommandGroups}>
            <PluginHostProvider visibleTabs={visibleTabs} setActiveTabId={setActiveTabId}>
                <BuiltinTabProvider dashboard={builtinDashboardContext} settings={builtinSettingsContext}>
                    <WorkspaceNav
                        title={semester?.name || 'Semester'}
                        isLoading={isLoading || !semester}
                        tabsLoading={!areBuiltinTabsReady}
                        tabs={(
                            <Tabs
                                items={tabBarItems}
                                activeId={activeTabId}
                                onSelect={setActiveTabId}
                                onReorder={handleReorderTabs}
                            />
                        )}
                    />

                    <Container size="wide" className="py-5 sm:py-6">
                        {isLoading || !semester ? (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
                                widgets={visibleWidgets}
                                allowedTypes={availableWidgetTypes}
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
            </PluginHostProvider>
        </Layout>
    );
};

export const SemesterHomepage: React.FC = () => {
    const { id } = useParams<{ id: string }>();

    if (!id) {
        return (
            <Layout>
                <Container size="wide">
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
