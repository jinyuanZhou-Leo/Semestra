import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { SettingsModal } from '../components/SettingsModal';
import { AddWidgetModal } from '../components/AddWidgetModal';
import { DashboardGrid } from '../components/widgets/DashboardGrid';
import type { WidgetItem } from '../components/widgets/DashboardGrid';
import { WidgetSettingsModal } from '../components/WidgetSettingsModal';
import api from '../services/api';
import type { Semester, Course, Widget } from '../services/api';
import { BackButton } from '../components/BackButton';
import { Container } from '../components/Container';

export const SemesterDashboard: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [semester, setSemester] = useState<Semester & { courses: Course[], widgets: Widget[] } | null>(null);
    const [widgets, setWidgets] = useState<WidgetItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
    const [editingWidget, setEditingWidget] = useState<WidgetItem | null>(null);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [isNavbarVisible, setIsNavbarVisible] = useState(true);
    const lastScrollY = React.useRef(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            const maxScroll = 120;
            const progress = Math.min(currentScrollY / maxScroll, 1);
            setScrollProgress(progress);

            // Navbar logic replication
            if (currentScrollY < 10) {
                setIsNavbarVisible(true);
            } else if (currentScrollY > lastScrollY.current && currentScrollY > 60) {
                setIsNavbarVisible(false);
            } else if (currentScrollY < lastScrollY.current) {
                setIsNavbarVisible(true);
            }
            lastScrollY.current = currentScrollY;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Derived styles
    const topPosition = isNavbarVisible ? '60px' : '0px';
    const topContentOpacity = 1 - Math.min(scrollProgress * 1.5, 1); // Fade out faster
    const topContentHeight = (1 - Math.min(scrollProgress * 1.5, 1)) * 50; // Approx height of back button + label
    const titleSize = `${3.5 - (2.0 * scrollProgress)}rem`;
    const statsOpacity = 1 - scrollProgress;
    const statsHeight = (1 - scrollProgress) * 50; // Approx height of stats
    const containerPadding = `${1.5 - (0.75 * scrollProgress)}rem 0`;
    const shadowOpacity = scrollProgress * 0.1;


    useEffect(() => {
        if (id) fetchSemester(id);
    }, [id]);

    useEffect(() => {
        if (semester?.widgets) {
            // Map backend widgets to frontend WidgetItems
            try {
                const mappedWidgets: WidgetItem[] = (semester.widgets || []).map(w => {
                    let parsedSettings = {};
                    let parsedLayout = undefined;
                    try {
                        parsedSettings = JSON.parse(w.settings || '{}');
                        parsedLayout = JSON.parse(w.layout_config || '{}');
                    } catch (e) {
                        console.warn("Failed to parse widget settings/layout", w.id, e);
                    }
                    return {
                        id: w.id.toString(),
                        type: w.widget_type as any,
                        title: w.title,
                        settings: parsedSettings,
                        layout: parsedLayout
                    };
                });
                setWidgets(mappedWidgets);
            } catch (e) {
                console.error("Failed to map widgets", e);
            }
        }
    }, [semester]);

    const fetchSemester = async (semesterId: string) => {
        try {
            const data = await api.getSemester(semesterId);
            setSemester(data);
        } catch (error) {
            console.error("Failed to fetch semester", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddWidget = async (type: string) => {
        if (!semester) return;
        try {
            const title = type === 'course-list' ? 'Courses' : 'Counter';
            await api.createWidget(semester.id, {
                widget_type: type,
                title: title
            });

            // Optimistic update or refetch? Refetching is safer for IDs
            fetchSemester(semester.id);
        } catch (error) {
            console.error("Failed to create widget", error);
        }
    };



    // Custom remove handler passed to Grid (we need to update Grid props to accept this if not already)
    // DashboardGrid expects onWidgetsChange to handle removals too currently.
    // Let's modify DashboardGrid to accept onRemoveWidget prop OR handle API calls here
    // and pass a wrapped onWidgetsChange that handles both reorder and removal?
    // Ideally: onReorder and onRemove separating concerns.
    // For now, let's just make sure DashboardGrid handles removal cleanly.

    /*
       Update Plan:
       The DashboardGrid calls onWidgetsChange when items are removed.
       We need to intercept that to call API delete if an item is missing.
    */

    const handleUpdateSemester = async (data: any) => {
        if (!semester) return;
        try {
            await api.updateSemester(semester.id, data);
            fetchSemester(semester.id);
        } catch (error) {
            console.error("Failed to update semester", error);
            alert("Failed to update semester");
        }
    };

    if (isLoading) return <Layout><div style={{ padding: '2rem' }}>Loading...</div></Layout>;
    if (!semester) {
        return (
            <Layout>
                <Container>
                    <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                        <h2 style={{ marginBottom: '1rem' }}>Semester not found</h2>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
                            The semester you are looking for does not exist or has been deleted.
                        </p>
                        <Link to="/">
                            <Button>Back to Home</Button>
                        </Link>
                    </div>
                </Container>
            </Layout>
        );
    }

    const handleUpdateWidgetSettings = async (id: string, data: any) => {
        try {
            await api.updateWidget(id, data);
            if (semester) fetchSemester(semester.id);
        } catch (error) {
            console.error("Failed to update widget", error);
            alert("Failed to update widget");
        }
    };

    const handleOptimisticUpdateWidget = async (id: string, data: any) => {
        // 1. Optimistic update
        setWidgets(prevWidgets => prevWidgets.map(w => {
            if (w.id === id) {
                if (data.settings) {
                    const newSettings = JSON.parse(data.settings);
                    return { ...w, settings: newSettings };
                }
                return { ...w, ...data };
            }
            return w;
        }));

        // 2. API call
        try {
            await api.updateWidget(id, data);
        } catch (error) {
            console.error("Failed to update widget optimistically", error);
            alert("Failed to save changes. Please refresh.");
            if (semester) fetchSemester(semester.id);
        }
    };


    const handleLayoutChange = async (layouts: any[]) => {
        // layouts is array of {i, x, y, w, h}
        // We need to update local state and backend.
        // For performance, maybe we should debounce this if RGL fires it often during resize?
        // RGL fires onDragStop/onResizeStop mainly if we hook there, but onLayoutChange fires on every change committed.

        // Update local widgets logic was here but unused.
        // setWidgets(newWidgets); // RGL uses its own layout prop if controlled, or internal if not. 
        // We passed generated layouts to RGL. modifying widgets changes the prop, which updates RGL.

        // Save to backend
        // This could be heavy if done for every pixel. 
        // But RGL onLayoutChange usually happens on drop value.

        // Batch update? API should support batch update or we loop.
        // Looping for now.
        for (const layout of layouts) {
            // Only update if changed?
            const widget = widgets.find(w => w.id === layout.i);
            if (widget) {
                const newLayout = { x: layout.x, y: layout.y, w: layout.w, h: layout.h };
                if (JSON.stringify(widget.layout) !== JSON.stringify(newLayout)) {
                    // Update backend
                    try {
                        await api.updateWidget(widget.id, { layout_config: JSON.stringify(newLayout) });
                    } catch (error) {
                        console.error("Failed to update widget layout", error);
                    }
                }
            }
        }
    };

    const handleRemoveWidget = async (id: string) => {
        if (window.confirm("Are you sure you want to remove this widget?")) {
            try {
                await api.deleteWidget(id);
                fetchSemester(semester!.id);
            } catch (e) {
                console.error("Failed to delete widget", e);
            }
        }
    };

    return (
        <Layout>
            <div
                className="hero-section"
                style={{
                    position: 'sticky',
                    top: topPosition,
                    zIndex: 900,
                    background: 'var(--gradient-hero)', // Keep original gradient
                    padding: containerPadding,
                    color: 'var(--color-text-primary)',
                    boxShadow: `0 4px 20px rgba(0,0,0,${shadowOpacity})`,
                    backdropFilter: 'blur(10px)', // Ensure glass effect if gradient has transparency
                    transition: 'padding 0.1s, top 0.3s ease-in-out', // Smooth out slight jitters and sync with navbar
                }}>
                <Container>
                    <div style={{
                        height: `${topContentHeight}px`,
                        opacity: topContentOpacity,
                        overflow: 'hidden',
                        marginBottom: `${0.5 * (1 - scrollProgress)}rem`,
                        transition: 'height 0.1s, opacity 0.1s'
                    }}>
                        <BackButton label="Back to Program" />
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-primary)', textTransform: 'uppercase', marginTop: '0.5rem' }}>Semester Dashboard</div>
                    </div>

                    <div className="page-header" style={{ marginBottom: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <h1 className="text-truncate" style={{
                                fontSize: titleSize,
                                margin: 0,
                                fontWeight: 800,
                                letterSpacing: '-0.02em',
                                background: 'linear-gradient(to right, var(--color-text-primary), var(--color-text-secondary))',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                transition: 'font-size 0.1s'
                            }}>
                                {semester.name}
                            </h1>
                            <div className="noselect stats-row" style={{
                                height: `${statsHeight}px`,
                                opacity: statsOpacity,
                                overflow: 'hidden',
                                marginTop: `${1.0 * (1 - scrollProgress)}rem`,
                                transition: 'height 0.1s, opacity 0.1s, margin-top 0.1s'
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.8, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Credits</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{semester.courses?.reduce((sum, course) => sum + (course.credits || 0), 0) || 0}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.8, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Avg</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{semester.average_percentage.toFixed(1)}%</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.8, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>GPA</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{semester.average_scaled.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', alignSelf: scrollProgress > 0.8 ? 'center' : 'flex-start', paddingTop: scrollProgress > 0.8 ? 0 : '10px', transition: 'all 0.2s' }}>
                            <Button
                                onClick={() => setIsSettingsOpen(true)}
                                variant="glass"
                                size="md"
                                shape="circle"
                                title="Semester Settings"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="3"></circle>
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                </svg>
                            </Button>
                            <Button onClick={() => setIsAddWidgetOpen(true)} size="md" variant="glass" shape="rounded">+ Add Widget</Button>
                        </div>
                    </div>
                </Container>
            </div>

            <Container padding="1rem 1rem">
                <DashboardGrid
                    widgets={widgets}
                    onLayoutChange={handleLayoutChange}
                    onRemoveWidget={handleRemoveWidget}
                    onEditWidget={(w) => setEditingWidget(w)}
                    onUpdateWidget={handleOptimisticUpdateWidget}
                    semesterId={semester.id}
                />
            </Container>

            {semester && (
                <>
                    <SettingsModal
                        isOpen={isSettingsOpen}
                        onClose={() => setIsSettingsOpen(false)}
                        title="Semester Settings"
                        initialName={semester.name}
                        initialSettings={{
                            gpa_scaling_table: semester.gpa_scaling_table
                        }}
                        onSave={handleUpdateSemester}
                        type="semester"
                    />
                    <AddWidgetModal
                        isOpen={isAddWidgetOpen}
                        onClose={() => setIsAddWidgetOpen(false)}
                        onAdd={handleAddWidget}
                    />
                    {editingWidget && (
                        <WidgetSettingsModal
                            isOpen={!!editingWidget}
                            onClose={() => setEditingWidget(null)}
                            widget={editingWidget}
                            onSave={handleUpdateWidgetSettings}
                        />
                    )}
                </>
            )}
        </Layout>
    );
};
