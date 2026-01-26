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
    const [isShrunk, setIsShrunk] = useState(false);
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

                    // 1. If transitioning, ignore scroll events to prevent flickering during animation
                    if (isTransitioningRef.current) {
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

    // Derived styles
    const heroTop = '0px';
    const contentPaddingTop = '60px';
    const contentPaddingBottom = isShrunk ? '0px' : '60px';

    // Binary states instead of interpolation
    const topContentOpacity = isShrunk ? 0 : 1;
    const topContentHeight = isShrunk ? 0 : 30; // Reduced from 50
    const titleSize = isShrunk ? '1.5rem' : '2.5rem'; // Reduced from 3.5rem
    const statsOpacity = isShrunk ? 0 : 1;
    const statsHeight = isShrunk ? 0 : 40; // Reduced from 50
    const containerPadding = isShrunk ? '0.75rem 0' : '1.0rem 0'; // Reduced from 1.5rem
    const shadowOpacity = isShrunk ? 0.1 : 0;


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
                    top: heroTop,
                    zIndex: 900,
                    background: 'var(--gradient-hero)', // Keep original gradient
                    padding: containerPadding,
                    color: 'var(--color-text-primary)',
                    boxShadow: `0 4px 20px rgba(0,0,0,${shadowOpacity})`,
                    backdropFilter: 'blur(10px)', // Ensure glass effect if gradient has transparency
                    transition: 'padding 0.1s', // Smooth out slight jitters and sync with navbar
                }}>
                <Container style={{ paddingTop: contentPaddingTop, transition: 'padding-top 0.3s ease-in-out' }}>
                    <div style={{
                        height: `${topContentHeight}px`,
                        opacity: topContentOpacity,
                        overflow: 'hidden',
                        marginBottom: isShrunk ? '0' : '0.5rem',
                        transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s, margin-bottom 0.3s'
                    }}>
                        <BackButton label="Back to Program" />
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-primary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Semester Dashboard</div>
                    </div>

                    <div className="page-header" style={{
                        marginBottom: 0,
                        flexDirection: isShrunk ? 'row' : undefined,
                        alignItems: isShrunk ? 'center' : undefined,
                        gap: isShrunk ? '1rem' : undefined
                    }}>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            flex: isShrunk ? '1' : undefined,
                            minWidth: 0
                        }}>
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
                            <div className="noselect stats-row" style={{
                                height: `${statsHeight}px`,
                                opacity: statsOpacity,
                                overflow: 'hidden',
                                marginTop: isShrunk ? '0' : '1.0rem',
                                transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s, margin-top 0.3s'
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
                        <div style={{
                            display: 'flex',
                            gap: '0.5rem', // Reduced gap to match CourseDashboard
                            alignSelf: isShrunk ? 'center' : 'flex-start',
                            paddingTop: isShrunk ? 0 : '10px',
                            // transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', // This was present in CourseDashboard too?
                            // Checking lines 350-357: Transition was there. I will keep it.
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            flexShrink: 0
                        }}>
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

            <Container style={{ padding: '1rem 1rem' }}>
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
