import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
        if (id) fetchSemester(parseInt(id));
    }, [id]);

    useEffect(() => {
        if (semester?.widgets) {
            // Map backend widgets to frontend WidgetItems
            try {
                const mappedWidgets: WidgetItem[] = (semester.widgets || []).map(w => {
                    let parsedSettings = {};
                    try {
                        parsedSettings = JSON.parse(w.settings || '{}');
                    } catch (e) {
                        console.warn("Failed to parse widget settings", w.id, e);
                    }
                    return {
                        id: w.id.toString(),
                        type: w.widget_type as any,
                        title: w.title,
                        settings: parsedSettings
                    };
                });
                setWidgets(mappedWidgets);
            } catch (e) {
                console.error("Failed to map widgets", e);
            }
        }
    }, [semester]);

    const fetchSemester = async (semesterId: number) => {
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

    const handleWidgetUpdate = async (newWidgets: WidgetItem[]) => {
        // Check for deletions
        const currentIds = new Set(newWidgets.map(w => w.id));
        const removedWidgets = widgets.filter(w => !currentIds.has(w.id));

        for (const w of removedWidgets) {
            try {
                await api.deleteWidget(parseInt(w.id));
            } catch (e) {
                console.error("Failed to delete widget", e);
            }
        }

        setWidgets(newWidgets);
    };

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
    if (!semester) return <Layout><div style={{ padding: '2rem' }}>Semester not found</div></Layout>;

    const handleUpdateWidgetSettings = async (id: number, data: any) => {
        try {
            await api.updateWidget(id, data);
            if (semester) fetchSemester(semester.id);
        } catch (error) {
            console.error("Failed to update widget", error);
            alert("Failed to update widget");
        }
    };


    return (
        <Layout>
            <div style={{
                background: 'var(--gradient-hero)',
                padding: '4rem 0',
                color: 'var(--color-text-primary)'
            }}>
                <Container>
                    <BackButton label="Back to Program" />
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-primary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Semester Dashboard</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h1 style={{ fontSize: '3.5rem', margin: 0, fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(to right, var(--color-text-primary), var(--color-text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                {semester.name}
                            </h1>
                            <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', fontSize: '1rem', opacity: 0.8 }}>
                                GPA: {semester.average_scaled.toFixed(2)} | Avg: {semester.average_percentage.toFixed(1)}%
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <Button onClick={() => setIsSettingsOpen(true)} variant="secondary" size="lg" style={{ backdropFilter: 'blur(10px)', background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.05)' }}>Settings</Button>
                            <Button onClick={() => setIsAddWidgetOpen(true)} size="lg">+ Add Widget</Button>
                        </div>
                    </div>
                </Container>
            </div>

            <Container style={{ padding: '2rem' }}>
                <DashboardGrid
                    widgets={widgets}
                    onWidgetsChange={handleWidgetUpdate}
                    onEditWidget={(w) => setEditingWidget(w)}
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
