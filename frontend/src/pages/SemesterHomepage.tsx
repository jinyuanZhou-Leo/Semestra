import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
import { Container } from '../components/Container';
import { useDashboardWidgets } from '../hooks/useDashboardWidgets';
import { useDashboardTabs } from '../hooks/useDashboardTabs';
import { SemesterDataProvider, useSemesterData } from '../contexts/SemesterDataContext';
import { TabRegistry } from '../services/tabRegistry';
import { BuiltinTabProvider } from '../contexts/BuiltinTabContext';
import { useWidgetRegistry, resolveAllowedContexts } from '../services/widgetRegistry';
import api from '../services/api';
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
    const [activeTabId, setActiveTabId] = useState('dashboard');
    const [isShrunk, setIsShrunk] = useState(false);
    const [isNavbarVisible, setIsNavbarVisible] = useState(true);
    const [programName, setProgramName] = useState<string | null>(null);
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

                    // Navbar Visibility Logic (Mirrors Layout.tsx)
                    if (currentScrollY < 10) {
                        setIsNavbarVisible(true);
                    } else if (currentScrollY > lastScrollY.current && currentScrollY > 60) {
                        setIsNavbarVisible(false);
                    } else if (currentScrollY < lastScrollY.current) {
                        setIsNavbarVisible(true);
                    }


                    // 1. If transitioning, ignore scroll events to prevent flickering during animation
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

                        // Lock updates during transition (300ms matches CSS transition)
                        isTransitioningRef.current = true;
                        if (timeoutRef.current) clearTimeout(timeoutRef.current);
                        timeoutRef.current = setTimeout(() => {
                            isTransitioningRef.current = false;

                            // Double check state after transition ends
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

    // Binary states
    const topContentOpacity = isShrunk ? 0 : 1;
    const topContentHeight = isShrunk ? 0 : 30;
    const titleSize = isShrunk ? 'clamp(1.1rem, 4vw, 1.5rem)' : 'clamp(1.5rem, 6vw, 2rem)'; 
    const statsOpacity = isShrunk ? 0 : 1;
    // Use maxHeight for stats transition to allow wrapping on mobile
    const statsMaxHeight = isShrunk ? '0px' : '150px';
    const containerPadding = isShrunk ? '0.5rem 0' : '1.0rem 0'; // Kept reduced padding
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
        semesterId: semester?.id,
        initialWidgets: semester?.widgets,
        onRefresh: refreshSemester
    });

    const {
        tabs,
        addTab: handleAddTab,
        removeTab: handleRemoveTab,
        updateTabSettingsDebounced,
        reorderTabs
    } = useDashboardTabs({
        semesterId: semester?.id,
        initialTabs: semester?.tabs,
        onRefresh: refreshSemester
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
    }, [tabs, semester?.id, handleUpdateTabSettings]);

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

    const handleUpdateSemester = async (data: any) => {
        if (!semester) return;
        updateSemester(data);
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
            semesterId: semester?.id
        },
        settings: {
            initialName: semester?.name ?? '',
            initialSettings: {},
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
        semester?.id,
        semester?.name,
        handleUpdateSemester,
        widgetSettingsSections,
        tabSettingsSections
    ]);

    if (!isLoading && !semester) {
        return (
            <Layout>
                <Container>
                    <Empty className="my-16">
                        <EmptyHeader>
                            <EmptyTitle>Semester not found</EmptyTitle>
                            <EmptyDescription>
                                The semester you are looking for does not exist or has been deleted.
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
                    background: 'var(--gradient-hero)', // Keep original gradient
                    padding: containerPadding,
                    color: 'var(--color-text-primary)',
                    boxShadow: `0 4px 20px rgba(0,0,0,${shadowOpacity})`,
                    transition: 'padding 0.1s, top 0.3s ease-in-out, min-height 0.3s ease-in-out', // Smooth out slight jitters and sync with navbar
                    display: 'flex',
                    flexDirection: 'column',
                        justifyContent: 'center',
                }}>
                <Container style={{
                    transition: 'padding-top 0.3s ease-in-out',
                    display: 'flex',
                    flexDirection: 'column',
                    // Remove internal vertical padding to let parent handle spacing/centering
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
                                <BreadcrumbSeparator />
                                <BreadcrumbItem>
                                    {semester?.program_id ? (
                                        <BreadcrumbLink asChild className="text-primary normal-case">
                                            <Link to={`/programs/${semester.program_id}`}>
                                                {programName || 'Program'}
                                            </Link>
                                        </BreadcrumbLink>
                                    ) : (
                                        <span className="text-primary normal-case">
                                            {programName || 'Program'}
                                        </span>
                                    )}
                                </BreadcrumbItem>
                                <BreadcrumbSeparator />
                                <BreadcrumbItem>
                                    <BreadcrumbPage className="text-primary normal-case">
                                        {semester?.name || 'Semester'}
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
                            minWidth: 0
                        }}>
                            {isLoading || !semester ? (
                                <Skeleton
                                    className="w-3/5"
                                    style={{ height: titleSize, marginBottom: isShrunk ? 0 : '0.5rem' }}
                                />
                            ) : (
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
                                        {semester.name}
                                    </h1>
                            )}

                            <div className="noselect stats-row" style={{
                                maxHeight: statsMaxHeight, 
                                opacity: statsOpacity,
                                overflow: 'hidden',
                                marginTop: isShrunk ? '0' : '0.75rem',
                                transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s, margin-top 0.3s',
                                flexWrap: 'wrap', // Allow wrap on mobile
                                height: 'auto'
                            }}>
                                <div style={{ minWidth: 0, flex: '0 0 auto' }}>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.8, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Credits</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600, width: '3.5rem' }}>
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
                                <div style={{ minWidth: 0, flex: '0 0 auto' }}>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.8, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Avg</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600, width: '5.5rem' }}>
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
                                <div style={{ minWidth: 0, flex: '0 0 auto' }}>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.8, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>GPA</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600, width: '4rem' }}>
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
                {isLoading || !semester ? (
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
                                    semesterId={semester.id}
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
                                    semesterId={semester.id}
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
