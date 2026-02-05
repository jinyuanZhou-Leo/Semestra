import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';
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

    const heroClassName = cn(
        "sticky left-0 right-0 z-40 border-b bg-[var(--gradient-hero)] backdrop-blur transition-all",
        isNavbarVisible ? "top-[60px]" : "top-0",
        isShrunk ? "py-3 shadow-sm" : "py-6 shadow-none"
    );

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

    const breadcrumb = (
        <Breadcrumb>
            <BreadcrumbList className="text-xs font-medium text-muted-foreground">
                <BreadcrumbItem>
                    <BreadcrumbLink asChild className="text-muted-foreground hover:text-foreground">
                        <Link to="/">Academic</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    {semester?.program_id ? (
                        <BreadcrumbLink asChild className="text-muted-foreground hover:text-foreground">
                            <Link to={`/programs/${semester.program_id}`}>
                                {programName || 'Program'}
                            </Link>
                        </BreadcrumbLink>
                    ) : (
                        <BreadcrumbPage className="text-foreground">
                            {programName || 'Program'}
                        </BreadcrumbPage>
                    )}
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbPage className="text-foreground">
                        {semester?.name || 'Semester'}
                    </BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    );

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
        <Layout breadcrumb={breadcrumb}>
            <BuiltinTabProvider value={builtinTabContext}>
                <div className={heroClassName}>
                    <Container className="flex flex-col gap-4">
                        <Card className="border-0 bg-transparent shadow-none">
                            <CardHeader className="gap-4 p-0">
                                <div className={cn("flex flex-col gap-2 transition-all", isShrunk ? "mb-0" : "mb-2")}>
                                    <div className="min-w-0">
                                        {isLoading || !semester ? (
                                            <Skeleton className={cn("w-3/5", isShrunk ? "h-8" : "h-12")} />
                                        ) : (
                                            <CardTitle
                                                className={cn(
                                                    "noselect text-truncate font-extrabold tracking-tight",
                                                    isShrunk ? "text-2xl md:text-3xl" : "text-3xl md:text-4xl"
                                                )}
                                            >
                                                <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                                                    {semester.name}
                                                </span>
                                            </CardTitle>
                                        )}

                                        <div
                                            className={cn(
                                                "noselect flex flex-wrap gap-6 overflow-hidden transition-all",
                                                isShrunk ? "mt-0 max-h-0 opacity-0" : "mt-3 max-h-40 opacity-100"
                                            )}
                                        >
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
                            </CardHeader>
                        </Card>

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

                <Container className="py-4">
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
                            <React.Suspense fallback={<div className="p-8">Loading tab...</div>}>
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
