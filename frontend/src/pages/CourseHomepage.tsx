import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
import api from '../services/api';
import { reportError } from '../services/appStatus';
import { Container } from '../components/Container';
import { CourseDataProvider, useCourseData } from '../contexts/CourseDataContext';
import { BuiltinTabProvider } from '../contexts/BuiltinTabContext';
import { useDashboardWidgets } from '../hooks/useDashboardWidgets';
import { useDashboardTabs } from '../hooks/useDashboardTabs';
import { TabRegistry } from '../services/tabRegistry';
import { useStickyCollapse } from '../hooks/useStickyCollapse';
import { CourseSettingsPanel } from '../components/CourseSettingsPanel';
import { PluginSettingsCard } from '../components/PluginSettingsCard';
import { PluginTabSkeleton } from '../plugin-system/PluginLoadSkeleton';
import { getResolvedTabMetadataByType, getWidgetCatalogItemByType, hasTabPluginForType } from '../plugin-system';
import { useHomepageBuiltinTabs } from '../hooks/useHomepageBuiltinTabs';
import { useTabSettingsRegistry, useWidgetGlobalSettingsRegistry } from '../services/pluginSettingsRegistry';
import { timetableEventBus } from '../plugins/builtin-event-core/shared/eventBus';
import {
    COURSE_HOMEPAGE_BUILTIN_TAB_CONFIG,
    HOMEPAGE_DASHBOARD_TAB_TYPE,
    HOMEPAGE_SETTINGS_TAB_TYPE,
} from '../utils/homepageBuiltinTabs';

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
import { cn } from '@/lib/utils';

// Inner component that uses the context
const CourseHomepageContent: React.FC = () => {
    const { course, updateCourse, refreshCourse, isLoading } = useCourseData();
    const navigate = useNavigate();
    const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
    const [isAddTabOpen, setIsAddTabOpen] = useState(false);
    const [editingWidget, setEditingWidget] = useState<WidgetItem | null>(null);
    const [activeTabId, setActiveTabId] = useState('');
    const [programName, setProgramName] = useState<string | null>(null);
    const [semesterName, setSemesterName] = useState<string | null>(null);

    const { isShrunk, heroRef, heroSpacerHeight } = useStickyCollapse();

    const shouldCollapseProgram = Boolean(course?.program_id && course?.semester_id);
    const shouldShowProgramDirect = Boolean(course?.program_id && !shouldCollapseProgram);
    const shouldShowSemester = Boolean(course?.semester_id);


    useEffect(() => {
        let isActive = true;
        const programId = course?.program_id;
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
    }, [course?.program_id]);

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
        updateWidget: handleUpdateWidget,
        updateWidgetDebounced: handleUpdateWidgetDebounced,
        updateLayout: handleLayoutChange
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

    const tabSettingsDefinitions = useTabSettingsRegistry();
    const widgetGlobalSettingsDefinitions = useWidgetGlobalSettingsRegistry();

    const dashboardContent = useMemo(() => {
        if (!course) return null;
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
                    courseId={course.id}
                    updateSettings={(newSettings) => handleUpdateTabSettings(activeTab.id, newSettings)}
                />
            </React.Suspense>
        );
    }, [activeTabId, course, visibleTabs, handleUpdateTabSettings, isActiveTabPluginLoading]);

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

    const tabSettingsSections = useMemo(() => {
        const settingsByType = new Map(
            tabSettingsDefinitions.map((definition) => [definition.type, definition.component])
        );
        const sections = visibleTabs
            .map(tab => {
            const SettingsComponent = settingsByType.get(tab.type);
            const metadata = getResolvedTabMetadataByType(tab.type);
            if (!SettingsComponent) return null;
            return (
                <PluginSettingsCard key={tab.id} title={metadata.name ?? tab.title ?? tab.type}>
                    <SettingsComponent
                        tabId={tab.id}
                        settings={tab.settings || {}}
                        courseId={course?.id}
                        updateSettings={(newSettings) => handleUpdateTabSettings(tab.id, newSettings)}
                    />
                </PluginSettingsCard>
            );
        }).filter(Boolean);

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
        tabSettingsDefinitions
    ]);

    const widgetSettingsSections = useMemo(() => {
        const sections = widgetGlobalSettingsDefinitions
            .filter((definition) => {
                const metadata = getWidgetCatalogItemByType(definition.type);
                const allowedContexts = metadata?.allowedContexts ?? ['semester', 'course'];
                return allowedContexts.includes('course');
            })
            .map((definition) => {
                const GlobalSettingsComponent = definition.component;
                const metadata = getWidgetCatalogItemByType(definition.type);
                return (
                    <PluginSettingsCard key={definition.type} title={metadata?.name ?? definition.type}>
                        <GlobalSettingsComponent
                            courseId={course?.id}
                            onRefresh={refreshCourse}
                        />
                    </PluginSettingsCard>
                );
            });

        if (sections.length === 0) return null;

        return (
            <div className="flex flex-col gap-4">
                {sections}
            </div>
        );
    }, [widgetGlobalSettingsDefinitions, course?.id, refreshCourse]);

    const hasPluginSettings = Boolean(widgetSettingsSections || tabSettingsSections);

    const handleUpdateCourse = useCallback(async (data: any) => {
        if (!course) return;
        try {
            await api.updateCourse(course.id, data);
            timetableEventBus.publish('timetable:schedule-data-changed', {
                source: 'course',
                reason: 'course-updated',
                courseId: course.id,
                semesterId: course.semester_id,
            });
            await refreshCourse();
        } catch (error) {
            console.error("Failed to update course", error);
            reportError('Failed to update course. Please retry.');
        }
    }, [course, refreshCourse]);

    const builtinTabContext = useMemo(() => ({
        isLoading,
        dashboard: {
            widgets,
            onAddWidgetClick: () => setIsAddWidgetOpen(true),
            onRemoveWidget: handleRemoveWidget,
            onEditWidget: (widget: WidgetItem) => setEditingWidget(widget),
            onUpdateWidget: handleUpdateWidget,
            onUpdateWidgetDebounced: handleUpdateWidgetDebounced,
            onLayoutChange: handleLayoutChange,
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
                        credits: course?.credits,
                        include_in_gpa: course?.include_in_gpa,
                        hide_gpa: course?.hide_gpa
                    }}
                    onSave={handleUpdateCourse}
                />
            ),
            extraSections: hasPluginSettings ? (
                <div className="space-y-6">
                    {widgetSettingsSections}
                    {tabSettingsSections}
                </div>
            ) : undefined
        }
    }), [
        isLoading,
        widgets,
        handleRemoveWidget,
        handleUpdateWidget,
        handleUpdateWidgetDebounced,
        handleLayoutChange,
        course?.id,
        course?.name,
        course?.alias,
        course?.category,
        course?.credits,
        course?.include_in_gpa,
        course?.hide_gpa,
        updateCourse,
        handleUpdateCourse,
        hasPluginSettings,
        widgetSettingsSections,
        tabSettingsSections
    ]);

    if (!isLoading && !course) {
        return (
            <Layout>
                <Container>
                    <Empty className="my-16">
                        <EmptyHeader>
                            <EmptyTitle>Course not found</EmptyTitle>
                            <EmptyDescription>
                                The course you are looking for does not exist or has been deleted.
                            </EmptyDescription>
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
        <Layout breadcrumb={breadcrumb}>
            <BuiltinTabProvider value={builtinTabContext}>
                <div
                    ref={heroRef}
                    className={cn(
                        "sticky-page-header sticky left-0 right-0 z-40 top-[60px] border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-[padding,box-shadow] duration-300 ease-out",
                        isShrunk ? "shadow-sm" : "shadow-none"
                    )}
                    style={{
                        paddingTop: isShrunk ? '8px' : '16px',
                        paddingBottom: isShrunk ? '8px' : '16px'
                    }}
                >
                    <Container className="flex flex-wrap items-center">
                        <div className="flex flex-col gap-2 relative w-full">
                            <div className="min-w-0">
                                {isLoading || !course ? (
                                    <Skeleton className="h-12 w-3/5" />
                                ) : (
                                    <>
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
                                                {course.name}
                                        </h1>
                                        {course.alias && (
                                            <div
                                                className="mt-1 text-sm text-muted-foreground/80"
                                                    style={{
                                                        maxHeight: isShrunk ? '0px' : '20px',
                                                        opacity: isShrunk ? 0 : 1,
                                                        transform: isShrunk ? 'translateY(-4px)' : 'translateY(0)',
                                                        overflow: 'hidden',
                                                        transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease, transform 0.3s ease'
                                                    }}
                                            >
                                                {course.alias}
                                            </div>
                                        )}
                                    </>
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
                                        <div
                                            className={cn(
                                                "text-2xl font-semibold",
                                                course?.credits === 0 && "text-destructive"
                                            )}
                                        >
                                            {isLoading || !course ? (
                                                <Skeleton className="h-6 w-8" />
                                            ) : (
                                                <AnimatedNumber
                                                    value={course.credits}
                                                    format={(val) => val.toFixed(2)}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <div className="min-w-[96px]">
                                        <div className="text-xs uppercase tracking-wider text-muted-foreground/80">Grade</div>
                                        <div className="text-2xl font-semibold">
                                            {isLoading || !course ? (
                                                <Skeleton className="h-6 w-12" />
                                            ) : course.hide_gpa ? (
                                                '****'
                                            ) : (
                                                <AnimatedNumber
                                                    value={course.grade_percentage}
                                                    format={(val) => `${val.toFixed(1)}%`}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <div className="min-w-[110px]">
                                        <div className="text-xs uppercase tracking-wider text-muted-foreground/80">GPA (Scaled)</div>
                                        <div className="text-2xl font-semibold">
                                            {isLoading || !course ? (
                                                <Skeleton className="h-6 w-10" />
                                            ) : course.hide_gpa ? (
                                                '****'
                                            ) : (
                                                <AnimatedNumber
                                                    value={course.grade_scaled}
                                                    format={(val) => val.toFixed(2)}
                                                    rainbowThreshold={3.8}
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
                <div
                    aria-hidden="true"
                    style={{ height: isShrunk ? heroSpacerHeight : 0 }}
                />
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
                    <Empty className="my-16">
                        <EmptyHeader>
                            <EmptyTitle>Course not found</EmptyTitle>
                            <EmptyDescription>No course ID provided.</EmptyDescription>
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
        <CourseDataProvider courseId={id}>
            <CourseHomepageContent />
        </CourseDataProvider>
    );
};
