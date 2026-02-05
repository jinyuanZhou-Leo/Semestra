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
import { DashboardSkeleton } from '../components/Skeleton/DashboardSkeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedNumber } from '../components/AnimatedNumber';
import api from '../services/api';
import { reportError } from '../services/appStatus';
import { Container } from '../components/Container';
import { CourseDataProvider, useCourseData } from '../contexts/CourseDataContext';
import { BuiltinTabProvider } from '../contexts/BuiltinTabContext';
import { useDashboardWidgets } from '../hooks/useDashboardWidgets';
import { useDashboardTabs } from '../hooks/useDashboardTabs';
import { TabRegistry } from '../services/tabRegistry';
import { useWidgetRegistry, resolveAllowedContexts } from '../services/widgetRegistry';
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
    const { course, updateCourse, refreshCourse, isLoading } = useCourseData();
    const navigate = useNavigate();
    const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
    const [isAddTabOpen, setIsAddTabOpen] = useState(false);
    const [editingWidget, setEditingWidget] = useState<WidgetItem | null>(null);
    const [activeTabId, setActiveTabId] = useState('dashboard');
    const [isShrunk, setIsShrunk] = useState(false);
    const [isNavbarVisible, setIsNavbarVisible] = useState(true);
    const [programName, setProgramName] = useState<string | null>(null);
    const [semesterName, setSemesterName] = useState<string | null>(null);
    const shouldCollapseProgram = Boolean(course?.program_id && course?.semester_id);
    const shouldShowProgramDirect = Boolean(course?.program_id && !shouldCollapseProgram);
    const shouldShowSemester = Boolean(course?.semester_id);
    const lastScrollY = React.useRef(0);
    const isShrunkRef = React.useRef(false);
    const isTransitioningRef = React.useRef(false);
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const heroRef = React.useRef<HTMLDivElement | null>(null);
    const isShrunkStateRef = React.useRef(isShrunk);
    const [heroHeights, setHeroHeights] = useState({ expanded: 0, shrunk: 0 });

    useEffect(() => {
        let ticking = false;

        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const currentScrollY = window.scrollY;

                    // Navbar Visibility Logic
                    if (currentScrollY < 10) {
                        setIsNavbarVisible(true);
                    } else if (currentScrollY > lastScrollY.current && currentScrollY > 60) {
                        setIsNavbarVisible(false);
                    } else if (currentScrollY < lastScrollY.current) {
                        setIsNavbarVisible(true);
                    }

                    // 1. If transitioning, ignore scroll events to prevent flickering
                    if (isTransitioningRef.current) {
                        lastScrollY.current = currentScrollY;
                        ticking = false;
                        return;
                    }

                    // 2. Logic: Expand ONLY at scrollY === 0
                    const newIsShrunk = currentScrollY > 0;

                    // 3. Only update state if changed
                    if (newIsShrunk !== isShrunkRef.current) {
                        isShrunkRef.current = newIsShrunk;
                        setIsShrunk(newIsShrunk);

                        // Lock updates during transition (300ms)
                        isTransitioningRef.current = true;
                        if (timeoutRef.current) clearTimeout(timeoutRef.current);
                        timeoutRef.current = setTimeout(() => {
                            isTransitioningRef.current = false;

                            // Check state again after transition
                            const finalScrollY = window.scrollY;
                            const finalIsShrunk = finalScrollY > 0;
                            if (finalIsShrunk !== isShrunkRef.current) {
                                isShrunkRef.current = finalIsShrunk;
                                setIsShrunk(finalIsShrunk);
                            }
                        }, 300);
                    }

                    lastScrollY.current = currentScrollY;
                    ticking = false;
                });
                ticking = true;
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

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

    useEffect(() => {
        isShrunkStateRef.current = isShrunk;
    }, [isShrunk]);

    useEffect(() => {
        const element = heroRef.current;
        if (!element || typeof ResizeObserver === 'undefined') return;

        const measure = () => {
            const height = element.getBoundingClientRect().height;
            setHeroHeights(prev => {
                const key = isShrunkStateRef.current ? 'shrunk' : 'expanded';
                if (Math.abs(prev[key] - height) < 1) return prev;
                return { ...prev, [key]: height };
            });
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    // Derived styles
    const heroTop = isNavbarVisible ? '60px' : '0px';
    const topContentOpacity = isShrunk ? 0 : 1;
    const topContentHeight = isShrunk ? 0 : 30;
    const titleSize = isShrunk ? 'clamp(1.1rem, 4vw, 1.5rem)' : 'clamp(1.5rem, 6vw, 2rem)'; 
    const statsOpacity = isShrunk ? 0 : 1;
    const statsMaxHeight = isShrunk ? '0px' : '150px';
    const containerPadding = isShrunk ? '0.5rem 0' : '1.0rem 0';
    const shadowOpacity = isShrunk ? 0.1 : 0;
    const contentTopOffset = 0;
    const heroSpacerHeight = useMemo(() => {
        if (!heroHeights.expanded || !heroHeights.shrunk) return 0;
        return Math.max(0, heroHeights.expanded - heroHeights.shrunk);
    }, [heroHeights.expanded, heroHeights.shrunk]);



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

    const handleUpdateTabSettings = useCallback((tabId: string, newSettings: any) => {
        updateTabSettingsDebounced(tabId, { settings: JSON.stringify(newSettings) });
    }, [updateTabSettingsDebounced]);

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
        const settingsDef = TabRegistry.get('settings');
        return [
            {
                id: 'dashboard',
                label: dashboardDef?.name ?? 'Dashboard',
                icon: dashboardDef?.icon,
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
    }, [pluginTabItems]);

    const handleReorderTabs = useCallback((orderedIds: string[]) => {
        const pluginIdSet = new Set(tabs.map(tab => tab.id));
        reorderTabs(orderedIds.filter(id => pluginIdSet.has(id)));
    }, [reorderTabs, tabs]);

    useEffect(() => {
        if (activeTabId === 'dashboard' || activeTabId === 'settings') return;
        if (!tabs.some(tab => tab.id === activeTabId)) {
            setActiveTabId('dashboard');
        }
    }, [activeTabId, tabs]);

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

        if (sections.length === 0) return null;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {sections}
            </div>
        );
    }, [tabs, course?.id, handleUpdateTabSettings]);

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
            initialName: course?.name ?? '',
            initialSettings: {
                alias: course?.alias,
                credits: course?.credits,
                include_in_gpa: course?.include_in_gpa,
                hide_gpa: course?.hide_gpa
            },
            onSave: handleUpdateCourse,
            type: 'course' as const,
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
        <Layout>
            <BuiltinTabProvider value={builtinTabContext}>
                <div
                    className="hero-section"
                    ref={heroRef}
                    style={{
                    position: 'sticky',
                    top: heroTop,
                    left: 0,
                    right: 0,
                    zIndex: 40,
                    background: 'var(--gradient-hero)',
                    padding: containerPadding,
                    color: 'var(--color-text-primary)',
                    boxShadow: `0 4px 20px rgba(0,0,0,${shadowOpacity})`,
                    backdropFilter: 'blur(10px)',
                    transition: 'padding 0.1s, top 0.3s ease-in-out, min-height 0.3s ease-in-out',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                }}>
                <Container style={{
                    transition: 'padding-top 0.3s ease-in-out, padding-bottom 0.3s ease-in-out',
                    display: 'flex',
                    flexDirection: 'column', 
                }}>
                    <div style={{
                        height: `${topContentHeight}px`,
                        opacity: topContentOpacity,
                        overflow: 'hidden',
                        marginBottom: isShrunk ? '0' : '0.25rem',
                        transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s, margin-bottom 0.3s'
                    }}>
                            <Breadcrumb>
                                <BreadcrumbList
                                    style={{
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        letterSpacing: '0.05em',
                                        color: 'var(--color-primary)',
                                        marginBottom: '0.5rem',
                                        textTransform: 'uppercase'
                                    }}
                                >
                                    <BreadcrumbItem>
                                        <BreadcrumbLink asChild className="text-primary">
                                            <Link to="/">Academic</Link>
                                        </BreadcrumbLink>
                                    </BreadcrumbItem>
                                    {shouldCollapseProgram && (
                                        <>
                                            <BreadcrumbSeparator />
                                            <BreadcrumbItem>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button size="sm" variant="secondary">
                                                            {/* <Button size="icon-sm" variant="ghost"> */}
                                                            <BreadcrumbEllipsis />
                                                            <span className="sr-only">Toggle menu</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent
                                                        align="start"
                                                    >
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
                                                <BreadcrumbLink asChild className="text-primary normal-case">
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
                                                <BreadcrumbLink asChild className="text-primary normal-case">
                                                    <Link to={`/semesters/${course?.semester_id}`}>
                                                        {semesterName || 'Semester'}
                                                    </Link>
                                                </BreadcrumbLink>
                                            </BreadcrumbItem>
                                        </>
                                    )}
                                    <BreadcrumbSeparator />
                                    <BreadcrumbItem>
                                        <BreadcrumbPage className="text-primary normal-case">
                                            {course?.name || 'Course'}
                                        </BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                    </div>

                    <div className="page-header" style={{
                            marginBottom: isShrunk ? '0rem' : '1rem',
                        flexDirection: isShrunk ? 'row' : undefined,
                        alignItems: isShrunk ? 'center' : undefined,
                            gap: isShrunk ? '1rem' : undefined,
                            transition: 'margin-bottom 0.3s ease-in-out'
                    }}>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            flex: isShrunk ? '1' : undefined,
                            minWidth: 0 // Allow text truncation in flex child
                        }}>
                            {isLoading || !course ? (
                                    <Skeleton
                                        className="w-3/5"
                                        style={{ height: titleSize, marginBottom: isShrunk ? 0 : '0.5rem' }}
                                    />
                            ) : (
                                        <>
                                    <h1 className="noselect text-truncate" style={{
                                        fontSize: titleSize,
                                        margin: 0,
                                        fontWeight: 800,
                                        letterSpacing: '-0.02em',
                                        background: 'linear-gradient(to right, var(--color-text-primary), var(--color-text-secondary))',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        transition: 'font-size 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }}>
                                        {course.name}
                                    </h1>
                                            {!isShrunk && course.alias && (
                                                <div style={{
                                                    fontSize: '0.875rem',
                                                    color: 'var(--color-text-secondary)',
                                                    marginTop: '0.25rem',
                                                    opacity: 0.8
                                                }}>
                                                    {course.alias}
                                                </div>
                                            )}
                                        </>
                            )}

                            <div className="noselect stats-row" style={{
                                maxHeight: statsMaxHeight, 
                                opacity: statsOpacity,
                                overflow: 'hidden',
                                marginTop: isShrunk ? '0' : '0.75rem',
                                transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s, margin-top 0.3s',
                                flexWrap: 'wrap',
                                height: 'auto'
                            }}>
                                <div style={{ minWidth: 0, flex: '0 0 auto' }}>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.8, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Credits</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600, width: '3.5rem', color: course?.credits === 0 ? 'var(--color-danger)' : 'inherit' }}>
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
                                <div style={{ minWidth: 0, flex: '0 0 auto' }}>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.8, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Grade</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600, width: '5.5rem' }}>
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
                                <div style={{ minWidth: 0, flex: '0 0 auto' }}>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.8, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>GPA (Scaled)</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600, width: '4rem' }}>
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
                    <Tabs
                        items={tabBarItems}
                        activeId={activeTabId}
                        onSelect={setActiveTabId}
                        onRemove={handleRemoveTab}
                        onReorder={handleReorderTabs}
                        onAdd={() => setIsAddTabOpen(true)}
                    />
                </Container>
                </div>

                <Container style={{
                    paddingTop: '1rem',
                    paddingBottom: '1rem',
                    marginTop: contentTopOffset,
                    transition: 'margin-top 0.3s ease-in-out'
                }}>


                {isLoading || !course || !course.id ? (  /* Check course.id since useDashboardWidgets needs it */
                    <DashboardSkeleton />
                ) : (
                    (() => {
                        if (activeTabId === 'dashboard' || activeTabId === 'settings') {
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
                                    updateSettings={() => {}}
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
                            <React.Suspense fallback={<div style={{ padding: '2rem' }}>Loading tab...</div>}>
                                <TabComponent
                                    tabId={activeTab.id}
                                    settings={activeTab.settings || {}}
                                    courseId={course.id}
                                    updateSettings={(newSettings) => handleUpdateTabSettings(activeTab.id, newSettings)}
                                />
                            </React.Suspense>
                        );
                    })()
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
                            {editingWidget && (
                                <WidgetSettingsModal
                                    isOpen={!!editingWidget}
                                    onClose={() => setEditingWidget(null)}
                                    widget={editingWidget}
                                    onSave={handleUpdateWidget}
                                />
                            )}
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
