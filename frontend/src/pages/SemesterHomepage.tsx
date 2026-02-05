import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '@/components/ui/button';

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
    const [shrinkProgress, setShrunkProgress] = useState(0);
    const [activeTabId, setActiveTabId] = useState('dashboard');

    const {
        widgets, 
        addWidget,
        updateWidget,
        removeWidget,
        updateLayout
    } = useDashboardWidgets({
        semesterId: semester?.id, 
        initialWidgets: semester?.widgets,
        onRefresh: refreshSemester
    });

    const { 
        tabs: customTabs,
        addTab,
        removeTab,
        updateTab,
        reorderTabs
    } = useDashboardTabs({
        semesterId: semester?.id,
        initialTabs: semester?.tabs,
        onRefresh: refreshSemester 
    });

    const handleAddWidget = (type: string) => {
        addWidget(type);
        setIsAddWidgetOpen(false);
    };

    const handleUpdateWidget = async (id: string, data: any) => {
        await updateWidget(id, data);
        if (editingWidget && editingWidget.id === id) {
            setEditingWidget(null);
        }
    };

    const handleAddTab = (type: string) => {
        addTab(type);
        setIsAddTabOpen(false);
    };

    const handleRemoveTab = (id: string) => {
        removeTab(id);
    };

    const handleReorderTabs = (ids: string[]) => {
        // The Tabs component returns all IDs including built-ins
        // We only persist the order of custom tabs
        const customIds = ids.filter(id => id !== 'dashboard' && id !== 'settings');
        reorderTabs(customIds);
    };

    const handleUpdateTabSettings = (id: string, settings: any) => {
        updateTab(id, { settings });
    };

    useEffect(() => {
        const handleScroll = () => {
            // Calculate progress: 0 at top, 1 after scrolling 100px (adjust threshold as needed)
            const progress = Math.min(Math.max(window.scrollY / 100, 0), 1);
            setShrunkProgress(progress);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Init
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Derived state for ease of use in some conditionals


    // Dynamic styles based on shrinkProgress
    const headerStyle = {
        paddingTop: `${16 - (8 * shrinkProgress)}px`, // 16px to 8px
        paddingBottom: `${16 - (8 * shrinkProgress)}px`,
        backgroundColor: `rgba(255, 255, 255, ${shrinkProgress})`, // Fade in background
        borderBottomColor: `rgba(229, 231, 235, ${shrinkProgress})`, // Fade in border
        boxShadow: shrinkProgress > 0.5 ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none',
    } as React.CSSProperties;

    // Use CSS variables to control the grid/flex layout interpolation if possible, 
    // or use inline styles for the "path" animation.
    // Since we want a "path" animation for the tabs moving up, we can use
    // FLIP-like concepts or simple absolute positioning interpolation.

    // Let's try to interpolate the width/flex-basis of the title container
    // and the "break" element height/width.

    // Title Scale: 1 -> 0.8 (approx 36px/48px to 24px/30px)
    const titleScale = 1 - (0.2 * shrinkProgress);

    // Stats Opacity: 1 -> 0
    const statsOpacity = Math.max(1 - (shrinkProgress * 2), 0); // Fade out faster
    const statsHeight = Math.max(140 * (1 - shrinkProgress * 1.5), 0); // Collapse height

    // Break Element (Spacer): 
    // We want it to go from basis-full (width 100%) to basis-0 (width 0).
    // Flexible width strategy:
    // At progress 0: Width 100%
    // At progress 1: Width 0%
    const breakWidth = `${(1 - shrinkProgress) * 100}%`;
    const breakHeight = `${(1 - shrinkProgress) * 16}px`; // 16px to 0px height

    const breadcrumb = (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                        <Link to="/">Home</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbPage>{semester?.name || 'Semester'}</BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    );

    const builtinTabContext = useMemo(() => ({
        isLoading: isLoading,
        dashboard: {
            widgets: widgets,
            onAddWidgetClick: () => setIsAddWidgetOpen(true),
            onRemoveWidget: removeWidget,
            onEditWidget: setEditingWidget,
            onUpdateWidget: updateWidget,
            onLayoutChange: updateLayout,
            semesterId: semester?.id
        },
        settings: {
            initialName: semester?.name || '',
            onSave: async (data: any) => {
                await updateSemester(data);
            },
            type: 'semester' as const
        }
    }), [isLoading, widgets, removeWidget, updateWidget, updateLayout, semester, updateSemester]);

    const tabBarItems = useMemo(() => [
        { id: 'dashboard', label: 'Dashboard', draggable: false, removable: false },
        ...customTabs.map(t => ({
            id: t.id,
            label: t.title,
            draggable: true,
            removable: t.is_removable !== false
        })),
        { id: 'settings', label: 'Settings', draggable: false, removable: false }
    ], [customTabs]);

    return (
        <Layout breadcrumb={breadcrumb}>
            <BuiltinTabProvider value={builtinTabContext}>
                <div
                    className="sticky left-0 right-0 z-40 top-[60px]" // Always top-60px since navbar is fixed
                    style={headerStyle}
                >
                    <Container className="flex flex-wrap items-center transition-none">
                        {/* Remove CSS transitions to rely on scroll sync */}

                        <div
                            className="flex flex-col gap-2 relative transition-none"
                            style={{
                                width: shrinkProgress > 0.9 ? 'auto' : '100%',
                                marginRight: shrinkProgress > 0.9 ? '1rem' : '0'
                            }}
                        >
                            <div className="min-w-0">
                                {isLoading || !semester ? (
                                    <Skeleton className="h-12 w-3/5" />
                                ) : (
                                        <h1
                                            className="noselect text-truncate font-bold tracking-tight origin-left"
                                            style={{
                                                transform: `scale(${titleScale})`,
                                                fontSize: '2.25rem', // Base size (4xl is 2.25rem, 3xl is 1.875rem)
                                                lineHeight: '2.5rem'
                                            }}
                                        >
                                            {semester.name}
                                    </h1>
                                )}

                                <div
                                    className="noselect flex flex-wrap gap-6 overflow-hidden"
                                    style={{
                                        opacity: statsOpacity,
                                        maxHeight: `${statsHeight}px`,
                                        marginTop: statsOpacity > 0 ? '0.75rem' : '0'
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

                        {/* "Break" element that shrinks width */}
                        <div
                            style={{
                                flexBasis: breakWidth,
                                width: breakWidth,
                                height: breakHeight,
                                overflow: 'hidden'
                            }}
                        />

                        <div
                            className="min-w-0 overflow-hidden"
                            style={{
                                flex: 1,
                                marginLeft: shrinkProgress > 0.5 ? '1rem' : '0'
                            }}
                        >
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
                            tabs={customTabs}
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
