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
                    background: 'var(--gradient-hero)',
                color: 'var(--color-text-primary)'
            }}>
                <Container>
                    <BackButton label="Back to Program" />
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-primary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Semester Dashboard</div>
                    <div className="page-header">
                        <div>
                            <h1 style={{ fontSize: '3.5rem', margin: 0, fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(to right, var(--color-text-primary), var(--color-text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                {semester.name}
                            </h1>
                            <div className="noselect stats-row">
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
                        <div style={{ display: 'flex', gap: '1rem' }}>
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

            <Container padding="3rem 2rem">
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
