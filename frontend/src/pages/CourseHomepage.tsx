// input:  [course context, parent Program subject-color settings, dashboard tab/widget hooks, plugin metadata/settings/load-state registries, unavailable-widget cleanup actions, active tab selection state, and shared business empty-state wrappers]
// output: [`CourseHomepage` and internal `CourseHomepageContent` composition component]
// pos:    [Course workspace page with workspace navigation, Program-derived default course colors, plugin-global settings, and standardized unavailable/not-found empty states]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { AppEmptyState } from '../components/AppEmptyState';
import { Button } from '@/components/ui/button';
import { AddWidgetModal } from '../components/AddWidgetModal';
import { AddTabModal } from '../components/AddTabModal';
import { Tabs } from '../components/Tabs';
import type { WidgetItem } from '../components/widgets/DashboardGrid';
import { WidgetSettingsModal } from '../components/WidgetSettingsModal';
import { CardSkeleton } from '../components/skeletons';
import api from '../services/api';
import { reportError } from '../services/appStatus';
import { Container } from '../components/Container';
import { CourseDataProvider, useCourseData } from '../contexts/CourseDataContext';
import { BuiltinTabProvider } from '../contexts/BuiltinTabContext';
import { useDashboardWidgets } from '../hooks/useDashboardWidgets';
import { useDashboardTabs } from '../hooks/useDashboardTabs';
import { useVisibleTabSettingsPreload } from '../hooks/useVisibleTabSettingsPreload';
import { CourseSettingsPanel } from '../components/CourseSettingsPanel';
import { WorkspaceNav } from '../components/WorkspaceNav';

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
import { publishTimetableScheduleChange } from '../plugins/builtin-event-core/shared/publishTimetableScheduleChange';
import { BUILTIN_GRADEBOOK_TAB_TYPE, OPEN_GRADEBOOK_TAB_EVENT } from '../plugins/builtin-gradebook/shared';
import {
    COURSE_HOMEPAGE_BUILTIN_TAB_CONFIG,
    HOMEPAGE_DASHBOARD_TAB_TYPE,
    HOMEPAGE_SETTINGS_TAB_TYPE,
} from '../utils/homepageBuiltinTabs';
import { parseSubjectColorMap, resolveCourseColor } from '../utils/courseCategoryBadge';

import {
    Breadcrumb,
    BreadcrumbEllipsis,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Inner component that uses the context
const CourseHomepageContent: React.FC = () => {
    const { course, updateCourse, saveCourse, refreshCourse, isLoading } = useCourseData();
    const navigate = useNavigate();
    const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
    const [isAddTabOpen, setIsAddTabOpen] = useState(false);
    const [editingWidget, setEditingWidget] = useState<WidgetItem | null>(null);
    const [activeTabId, setActiveTabId] = useState('');
    const [programName, setProgramName] = useState<string | null>(null);
    const [programSubjectColorMapJson, setProgramSubjectColorMapJson] = useState<string>('{}');
    const [semesterName, setSemesterName] = useState<string | null>(null);
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

    const shouldCollapseProgram = Boolean(course?.program_id && course?.semester_id);
    const shouldShowProgramDirect = Boolean(course?.program_id && !shouldCollapseProgram);
    const shouldShowSemester = Boolean(course?.semester_id);


    useEffect(() => {
        let isActive = true;
        const programId = course?.program_id;
        if (!programId) {
            setProgramName(null);
            setProgramSubjectColorMapJson('{}');
            return () => {
                isActive = false;
            };
        }
        api.getProgram(programId)
            .then((program) => {
                if (isActive) {
                    setProgramName(program.name);
                    setProgramSubjectColorMapJson(program.subject_color_map || '{}');
                }
            })
            .catch(() => {
                if (isActive) {
                    setProgramName(null);
                    setProgramSubjectColorMapJson('{}');
                }
            });
        return () => {
            isActive = false;
        };
    }, [course?.program_id]);

    const programSubjectColorMap = useMemo(
        () => parseSubjectColorMap(programSubjectColorMapJson),
        [programSubjectColorMapJson],
    );
    const resolvedDefaultColor = useMemo(() => {
        if (!course) return null;
        return resolveCourseColor({ ...course, color: null }, programSubjectColorMap);
    }, [course, programSubjectColorMap]);

    useEffect(() => {
        let isActive = true;
        const semesterId = course?.semester_id;
        if (!semesterId) {
            setSemesterName(null);
            return () => {
                isActive = false;
            };
        }
        api.getSemester(semesterId)
            .then((semester) => {
                if (isActive) {
                    setSemesterName(semester.name);
                }
            })
            .catch(() => {
                if (isActive) {
                    setSemesterName(null);
                }
            });
        return () => {
            isActive = false;
        };
    }, [course?.semester_id]);

    const {
        widgets,
        addWidget: handleAddWidget,
        removeWidget: handleRemoveWidget,
        removeUnavailableWidget: handleRemoveUnavailableWidget,
        updateWidget: handleUpdateWidget,
        updateWidgetDebounced: handleUpdateWidgetDebounced,
        updateLayout: handleLayoutChange,
        commitLayout: handleLayoutCommit
    } = useDashboardWidgets({
        courseId: course?.id,
        initialWidgets: course?.widgets,
        onRefresh: refreshCourse
    });

    const {
        tabs,
        isInitialized: isTabsInitialized,
        addTab: handleAddTab,
        removeTab: handleRemoveTab,
        updateTabSettingsDebounced,
        reorderTabs
    } = useDashboardTabs({
        courseId: course?.id,
        initialTabs: course?.tabs,
        onRefresh: refreshCourse
    });

    const breadcrumb = (
        <Breadcrumb>
            <BreadcrumbList className="text-xs font-medium text-muted-foreground">
                <BreadcrumbItem>
                    <BreadcrumbLink asChild className="text-muted-foreground hover:text-foreground transition-colors">
                        <Link to="/">Academics</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                {shouldCollapseProgram && (
                    <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                        <BreadcrumbEllipsis />
                                        <span className="sr-only">Toggle menu</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                    <DropdownMenuGroup>
                                        <DropdownMenuItem
                                            className="normal-case"
                                            onSelect={(event) => {
                                                event.preventDefault();
                                                if (course?.program_id) {
                                                    navigate(`/programs/${course.program_id}`);
                                                }
                                            }}
                                        >
                                            {programName || 'Program'}
                                        </DropdownMenuItem>
                                    </DropdownMenuGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </BreadcrumbItem>
                    </>
                )}
                {shouldShowProgramDirect && (
                    <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild className="text-muted-foreground hover:text-foreground transition-colors">
                                <Link to={`/programs/${course?.program_id}`}>
                                    {programName || 'Program'}
                                </Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                    </>
                )}
                {shouldShowSemester && (
                    <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild className="text-muted-foreground hover:text-foreground transition-colors">
                                <Link to={`/semesters/${course?.semester_id}`}>
                                    {semesterName || 'Semester'}
                                </Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                    </>
                )}
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbPage className="text-foreground font-semibold">
                        {course?.name || 'Course'}
                    </BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    );

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
        tabs,
        activeTabId,
        config: COURSE_HOMEPAGE_BUILTIN_TAB_CONFIG,
        isTabsInitialized,
        ensureBuiltinTabInstance,
    });

    const pluginSettingsDefinitions = usePluginSettingsRegistry('course');
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

    const dashboardContent = useMemo(() => {
        if (!course) return null;
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
                        semesterId={course.semester_id}
                        courseId={course.id}
                        updateSettings={(newSettings) => handleUpdateTabSettings(activeTab.id, newSettings)}
                    />
                </PluginContentFadeIn>
            </React.Suspense>
        );
    }, [activeTabId, course, visibleTabs, handleUpdateTabSettings, isActiveTabPluginLoading, activeTabLoadState.status]);

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

    useEffect(() => {
        const handleOpenGradebookTab = () => {
            const gradebookTab = visibleTabs.find((tab) => tab.type === BUILTIN_GRADEBOOK_TAB_TYPE);
            if (gradebookTab) {
                setActiveTabId(gradebookTab.id);
            }
        };

        window.addEventListener(OPEN_GRADEBOOK_TAB_EVENT, handleOpenGradebookTab);
        return () => {
            window.removeEventListener(OPEN_GRADEBOOK_TAB_EVENT, handleOpenGradebookTab);
        };
    }, [visibleTabs]);

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
                                semesterId={course?.semester_id}
                                courseId={course?.id}
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
        course?.id,
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
                            courseId={course?.id}
                            onRefresh={refreshCourse}
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
    }, [pluginSettingsDefinitions, course?.id, refreshCourse]);

    const hasPluginSettings = Boolean(pluginSettingsSections || tabInstanceSettingsSections);

    const handleUpdateCourse = useCallback(async (data: any) => {
        if (!course) return;
        try {
            await saveCourse(data);
            await publishTimetableScheduleChange({
                source: 'course',
                reason: 'course-updated',
                courseId: course.id,
                semesterId: course.semester_id,
            });
        } catch (error) {
            console.error("Failed to update course", error);
            reportError('Failed to update course. Please retry.');
        }
    }, [course, saveCourse]);

    const builtinTabContext = useMemo(() => ({
        isLoading,
        dashboard: {
            widgets,
            onAddWidgetClick: openAddWidgetModal,
            onRemoveWidget: handleRemoveWidget,
            onRemoveUnavailableWidget: handleRemoveUnavailableWidget,
            onEditWidget: (widget: WidgetItem) => setEditingWidget(widget),
            onUpdateWidget: handleUpdateWidget,
            onUpdateWidgetDebounced: handleUpdateWidgetDebounced,
            onLayoutChange: handleLayoutChange,
            onLayoutCommit: handleLayoutCommit,
            courseId: course?.id,
            updateCourse
        },
        settings: {
            content: (
                <CourseSettingsPanel
                    initialName={course?.name ?? ''}
                    initialSettings={{
                        alias: course?.alias,
                        category: course?.category,
                        color: course?.color,
                        credits: course?.credits,
                        include_in_gpa: course?.include_in_gpa,
                        hide_gpa: course?.hide_gpa
                    }}
                    resolvedDefaultColor={resolvedDefaultColor}
                    onSave={handleUpdateCourse}
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
        course?.id,
        course?.name,
        course?.alias,
        course?.category,
        course?.credits,
        course?.color,
        course?.include_in_gpa,
        course?.hide_gpa,
        resolvedDefaultColor,
        updateCourse,
        handleUpdateCourse,
        hasPluginSettings,
        pluginSettingsSections,
        tabInstanceSettingsSections,
        openAddWidgetModal
    ]);

    if (!isLoading && !course) {
        return (
            <Layout>
                <Container>
                    <AppEmptyState
                        scenario="not-found"
                        size="page"
                        title="Course not found"
                        description="The course you are looking for does not exist or has been deleted."
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
        <Layout breadcrumb={breadcrumb}>
            <BuiltinTabProvider value={builtinTabContext}>
                <WorkspaceNav
                    title={course?.name || 'Course'}
                    isLoading={isLoading || !course}
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
                {isLoading || !course || !course.id ? (  /* Check course.id since useDashboardWidgets needs it */
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <CardSkeleton key={i} className="h-[240px]" />
                            ))}
                        </div>
                ) : (
                            dashboardContent
                )}
                </Container>
                {
                    course && (
                        <>
                            <AddWidgetModal
                                isOpen={isAddWidgetOpen}
                                onClose={() => setIsAddWidgetOpen(false)}
                                onAdd={handleAddWidget}
                                context="course"
                                widgets={widgets}
                            />
                            <AddTabModal
                                isOpen={isAddTabOpen}
                                onClose={() => setIsAddTabOpen(false)}
                                onAdd={handleAddTab}
                                context="course"
                                tabs={tabs}
                            />
                            <WidgetSettingsModal
                                isOpen={!!editingWidget}
                                onClose={() => setEditingWidget(null)}
                                widget={editingWidget}
                                onSave={handleUpdateWidget}
                            />
                        </>
                    )
                }
            </BuiltinTabProvider>
        </Layout >
    );
};

// Outer component with Provider
export const CourseHomepage: React.FC = () => {
    const { id } = useParams<{ id: string }>();

    if (!id) {
        return (
            <Layout>
                <Container>
                    <AppEmptyState
                        scenario="not-found"
                        size="page"
                        title="Course not found"
                        description="No course ID provided."
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
        <CourseDataProvider courseId={id}>
            <CourseHomepageContent />
        </CourseDataProvider>
    );
};
