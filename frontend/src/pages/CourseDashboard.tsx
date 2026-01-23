import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { SettingsModal } from '../components/SettingsModal';
import { AddWidgetModal } from '../components/AddWidgetModal';
import { DashboardGrid, type WidgetItem } from '../components/widgets/DashboardGrid';
import { WidgetSettingsModal } from '../components/WidgetSettingsModal';
import api from '../services/api';
import type { Course } from '../services/api';
import { BackButton } from '../components/BackButton';
import { Container } from '../components/Container';

export const CourseDashboard: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [course, setCourse] = useState<(Course & { widgets?: any[] }) | null>(null);
    const [widgets, setWidgets] = useState<WidgetItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
    const [editingWidget, setEditingWidget] = useState<WidgetItem | null>(null);

    useEffect(() => {
        if (id) fetchCourse(parseInt(id));
    }, [id]);

    const fetchCourse = async (courseId: number) => {
        try {
            const data = await api.getCourse(courseId);
            setCourse(data);
            if (data.widgets) {
                const mappedWidgets: WidgetItem[] = data.widgets.map((w: any) => ({
                    id: w.id.toString(),
                    type: w.widget_type,
                    title: w.title,
                    settings: JSON.parse(w.settings || '{}')
                }));
                setWidgets(mappedWidgets);
            }
        } catch (error) {
            console.error("Failed to fetch course", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateCourse = async (data: any) => {
        if (!course) return;
        try {
            await api.updateCourse(course.id, data);
            fetchCourse(course.id);
        } catch (error) {
            console.error("Failed to update course", error);
            alert("Failed to update course");
        }
    };

    const handleAddWidget = async (type: string) => {
        if (!course) return;
        try {
            await api.createWidgetForCourse(course.id, {
                widget_type: type,
                title: type === 'counter' ? 'Counter' : 'Widget' // Default title logic
            });
            fetchCourse(course.id);
        } catch (error) {
            console.error("Failed to create widget", error);
        }
    };

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

    if (isLoading) return <Layout><div style={{ padding: '2rem' }}>Loading...</div></Layout>;
    if (!course) return <Layout><div style={{ padding: '2rem' }}>Course not found</div></Layout>;

    const handleUpdateWidgetSettings = async (id: number, data: any) => {
        try {
            await api.updateWidget(id, data);
            if (course) fetchCourse(course.id);
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
                    <BackButton label="Back to Semester" />
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-primary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Course Dashboard</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h1 style={{ fontSize: '3.5rem', margin: 0, fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(to right, var(--color-text-primary), var(--color-text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                {course.name}
                            </h1>
                            <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.8, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Credits</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{course.credits}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.8, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Grade</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{course.grade_percentage}%</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.8, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>GPA (Scaled)</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{course.grade_scaled.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>
                        <Button
                            variant="secondary"
                            onClick={() => setIsSettingsOpen(true)}
                            size="lg"
                            style={{ backdropFilter: 'blur(10px)', background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.05)' }}
                        >
                            Settings
                        </Button>
                    </div>
                </Container>
            </div>

            <Container style={{ padding: '3rem 2rem' }}>
                <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <Button onClick={() => setIsAddWidgetOpen(true)} size="lg">+ Add Widget</Button>
                </div>

                <DashboardGrid
                    widgets={widgets}
                    onWidgetsChange={handleWidgetUpdate}
                    onEditWidget={(w) => setEditingWidget(w)}
                    courseId={course.id}
                />
            </Container>
            {
                course && (
                    <>
                        <SettingsModal
                            isOpen={isSettingsOpen}
                            onClose={() => setIsSettingsOpen(false)}
                            title="Course Settings"
                            initialName={course.name}
                            initialSettings={{
                                credits: course.credits,
                                gpa_scaling_table: course.gpa_scaling_table,
                                include_in_gpa: course.include_in_gpa,
                                hide_gpa: course.hide_gpa
                            }}
                            onSave={handleUpdateCourse}
                            type="course"
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
                )
            }
        </Layout >
    );
};
