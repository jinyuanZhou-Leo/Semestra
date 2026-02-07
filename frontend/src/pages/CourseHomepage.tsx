import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { TabRegistry, useTabRegistry } from '../services/tabRegistry';
import { useWidgetRegistry, resolveAllowedContexts } from '../services/widgetRegistry';
import { useStickyCollapse } from '../hooks/useStickyCollapse';
import { CourseSettingsPanel } from '../components/CourseSettingsPanel';

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

const BUILTIN_TIMETABLE_TAB_ID = 'builtin-academic-timetable';
const LEGACY_SCHEDULE_TAB_ID = 'schedule';

// Inner component that uses the context
const CourseHomepageContent: React.FC = () => {
    const { course, updateCourse, refreshCourse, isLoading } = useCourseData();
    const navigate = useNavigate();
    const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
    const [isAddTabOpen, setIsAddTabOpen] = useState(false);
    const [editingWidget, setEditingWidget] = useState<WidgetItem | null>(null);
    const [activeTabId, setActiveTabId] = useState('dashboard');

    // Subscribe to tab registry changes so we re-render when builtin tabs are loaded
    const registeredTabs = useTabRegistry();
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
        addTab: handleAddTab,
        removeTab: handleRemoveTab,
        updateTabSettingsDebounced,
        reorderTabs
    } = useDashboardTabs({
        courseId: course?.id,
        initialTabs: course?.tabs,
        onRefresh: refreshCourse
    });

    const breadcrumb = useMemo(() => (
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
    ), [shouldCollapseProgram, shouldShowProgramDirect, shouldShowSemester, course?.program_id, course?.semester_id, course?.name, programName, semesterName, navigate]);



    const handleUpdateTabSettings = useCallback((tabId: string, newSettings: any) => {
        updateTabSettingsDebounced(tabId, { settings: JSON.stringify(newSettings) });
    }, [updateTabSettingsDebounced]);

    // Create a lookup for registered tab types to trigger re-render when tabs load
    const registeredTabTypes = useMemo(() => new Set(registeredTabs.map(t => t.type)), [registeredTabs]);
    const scheduleTabId = useMemo(
        () => (registeredTabTypes.has(BUILTIN_TIMETABLE_TAB_ID) ? BUILTIN_TIMETABLE_TAB_ID : LEGACY_SCHEDULE_TAB_ID),
        [registeredTabTypes]
    );

    const dashboardContent = useMemo(() => {
        if (!course) return null;
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
                    courseId={course.id}
                    updateSettings={() => { }}
                />
            );
        }
        const activeTab = tabs.find(tab => tab.id === activeTabId);
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
                    courseId={course.id}
                    updateSettings={(newSettings) => handleUpdateTabSettings(activeTab.id, newSettings)}
                />
            </React.Suspense>
        );
    }, [activeTabId, course, tabs, handleUpdateTabSettings, registeredTabTypes, scheduleTabId]);

    const pluginTabItems = useMemo(() => {
        return tabs.map(tab => {
            const definition = TabRegistry.get(tab.type);
            return {
                id: tab.id,
                label: definition?.name ?? tab.title ?? tab.type,
                icon: definition?.icon,
                removable: tab.is_removable !== false,
                draggable: tab.is_removable !== false
            };
        });
    }, [tabs]);

    const tabBarItems = useMemo(() => {
        const dashboardDef = TabRegistry.get('dashboard');
        const scheduleDef = TabRegistry.get(scheduleTabId);
        const settingsDef = TabRegistry.get('settings');
        return [
            {
                id: 'dashboard',
                label: dashboardDef?.name ?? 'Dashboard',
                icon: dashboardDef?.icon,
                removable: false,
                draggable: false
            },
            {
                id: scheduleTabId,
                label: scheduleDef?.name ?? 'Schedule',
                icon: scheduleDef?.icon,
                removable: false,
                draggable: false
            },
            ...pluginTabItems,
            {
                id: 'settings',
                label: settingsDef?.name ?? 'Settings',
                icon: settingsDef?.icon,
                removable: false,
                draggable: false
            }
        ];
    }, [pluginTabItems, scheduleTabId]);

    const handleReorderTabs = useCallback((orderedIds: string[]) => {
        const pluginIdSet = new Set(tabs.map(tab => tab.id));
        reorderTabs(orderedIds.filter(id => pluginIdSet.has(id)));
    }, [reorderTabs, tabs]);

    useEffect(() => {
        if (activeTabId === 'dashboard' || activeTabId === 'settings' || activeTabId === scheduleTabId) return;
        if (!tabs.some(tab => tab.id === activeTabId)) {
            setActiveTabId('dashboard');
        }
    }, [activeTabId, tabs, scheduleTabId]);

    const tabSettingsSections = useMemo(() => {
        const sections = tabs.map(tab => {
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
                        <Badge variant="secondary" className="uppercase tracking-[0.05em]">
                            Plugin
                        </Badge>
                        <h3 style={{
                            margin: 0,
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: 'var(--color-text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            {definition?.name ?? tab.title ?? tab.type}
                        </h3>
                    </div>

                    <SettingsComponent
                        tabId={tab.id}
                        settings={tab.settings || {}}
                        courseId={course?.id}
                        updateSettings={(newSettings) => handleUpdateTabSettings(tab.id, newSettings)}
                    />
                </div>
            );
        }).filter(Boolean);

        const builtinScheduleDefinition = TabRegistry.get(scheduleTabId);
        const BuiltinScheduleSettingsComponent = builtinScheduleDefinition?.settingsComponent;
        if (BuiltinScheduleSettingsComponent) {
            sections.push(
                <div key={`builtin-${scheduleTabId}`} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        paddingLeft: '0.25rem'
                    }}>
                        <Badge variant="secondary" className="uppercase tracking-[0.05em]">
                            Plugin
                        </Badge>
                        <h3 style={{
                            margin: 0,
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: 'var(--color-text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            {builtinScheduleDefinition?.name ?? 'Timetable'}
                        </h3>
                    </div>
                    <BuiltinScheduleSettingsComponent
                        tabId={scheduleTabId}
                        settings={{}}
                        courseId={course?.id}
                        updateSettings={() => { }}
                    />
                </div>
            );
        }

        if (sections.length === 0) return null;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {sections}
            </div>
        );
    }, [tabs, course?.id, handleUpdateTabSettings, scheduleTabId]);

    // Widget plugin global settings sections
    const widgetDefinitions = useWidgetRegistry();
    const widgetSettingsSections = useMemo(() => {
        const sections = widgetDefinitions
            .filter(def => {
                // Only show settings for widgets allowed in course context
                const allowedContexts = resolveAllowedContexts(def);
                return allowedContexts.includes('course') && def.globalSettingsComponent;
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
                            <Badge variant="secondary" className="uppercase tracking-[0.05em]">
                                Plugin
                            </Badge>
                            <h3 style={{
                                margin: 0,
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                color: 'var(--color-text-secondary)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                {def.name}
                            </h3>
                        </div>
                        <GlobalSettingsComponent
                            courseId={course?.id}
                            onRefresh={refreshCourse}
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
    }, [widgetDefinitions, course?.id, refreshCourse]);

    const handleUpdateCourse = async (data: any) => {
        if (!course) return;
        try {
            await api.updateCourse(course.id, data);
            refreshCourse();
        } catch (error) {
            console.error("Failed to update course", error);
            reportError('Failed to update course. Please retry.');
        }
    };

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
        course?.id,
        course?.name,
        course?.alias,
        course?.credits,
        course?.include_in_gpa,
        course?.hide_gpa,
        updateCourse,
        handleUpdateCourse,
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
                        "sticky left-0 right-0 z-40 top-[60px] border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-[padding,box-shadow] duration-300 ease-out",
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
                                                className="noselect text-truncate font-bold tracking-tight origin-left"
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
