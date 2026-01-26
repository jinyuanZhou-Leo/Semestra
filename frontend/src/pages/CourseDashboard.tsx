import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { SettingsModal } from '../components/SettingsModal';
import { AddWidgetModal } from '../components/AddWidgetModal';
import { DashboardGrid, type WidgetItem } from '../components/widgets/DashboardGrid';
import { WidgetSettingsModal } from '../components/WidgetSettingsModal';
import api from '../services/api';
import { BackButton } from '../components/BackButton';
import { Container } from '../components/Container';
import { CourseDataProvider, useCourseData } from '../contexts/CourseDataContext';

// Inner component that uses the context
const CourseDashboardContent: React.FC = () => {
    const { course, updateCourseField, refreshCourse, isLoading } = useCourseData();
    const [widgets, setWidgets] = useState<WidgetItem[]>([]);
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
    // Fix: We fix top at 0 to cover behind navbar, but add padding to content
    const heroTop = '0px';
    const isShrunk = scrollProgress > 0.8;
    const contentPaddingTop = isNavbarVisible ? '60px' : '0px';

    const topContentOpacity = 1 - Math.min(scrollProgress * 1.5, 1);
    const topContentHeight = (1 - Math.min(scrollProgress * 1.5, 1)) * 50;
    const titleSize = `${3.5 - (2.0 * scrollProgress)}rem`;
    const statsOpacity = 1 - scrollProgress;
    const statsHeight = (1 - scrollProgress) * 50;
    const containerPadding = `${1.5 - (0.75 * scrollProgress)}rem 0`;
    const shadowOpacity = scrollProgress * 0.1;


    useEffect(() => {
        if (course?.widgets) {
            const mappedWidgets: WidgetItem[] = course.widgets.map((w: any) => ({
                id: w.id.toString(),
                type: w.widget_type,
                title: w.title,
                settings: JSON.parse(w.settings || '{}'),
                layout: JSON.parse(w.layout_config || '{}')
            }));
            setWidgets(mappedWidgets);
        }
    }, [course?.widgets]);

    const handleUpdateCourse = async (data: any) => {
        if (!course) return;
        try {
            await api.updateCourse(course.id, data);
            refreshCourse();
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
                title: type === 'counter' ? 'Counter' : 'Widget'
            });
            refreshCourse();
        } catch (error) {
            console.error("Failed to create widget", error);
        }
    };

    const handleLayoutChange = async (layouts: any[]) => {
        const newWidgets = widgets.map(w => {
            const layout = layouts.find(l => l.i === w.id);
            if (layout) {
                return { ...w, layout: { x: layout.x, y: layout.y, w: layout.w, h: layout.h } };
            }
            return w;
        });
        setWidgets(newWidgets);

        for (const layout of layouts) {
            const widget = widgets.find(w => w.id === layout.i);
            if (widget) {
                const newLayout = { x: layout.x, y: layout.y, w: layout.w, h: layout.h };
                if (JSON.stringify(widget.layout) !== JSON.stringify(newLayout)) {
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
                refreshCourse();
            } catch (e) {
                console.error("Failed to delete widget", e);
            }
        }
    };

    if (isLoading) return <Layout><div style={{ padding: '2rem' }}>Loading...</div></Layout>;
    if (!course) {
        return (
            <Layout>
                <Container>
                    <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                        <h2 style={{ marginBottom: '1rem' }}>Course not found</h2>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
                            The course you are looking for does not exist or has been deleted.
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
            refreshCourse();
        } catch (error) {
            console.error("Failed to update widget", error);
            alert("Failed to update widget");
        }
    };

    const handleOptimisticUpdateWidget = async (id: string, data: any) => {
        // 1. Optimistically update local state
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

        // 2. Call API
        try {
            await api.updateWidget(id, data);
        } catch (error) {
            console.error("Failed to update widget optimistically", error);
            alert("Failed to save changes. Please refresh.");
            refreshCourse();
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
                    background: 'var(--gradient-hero)',
                    padding: containerPadding,
                    color: 'var(--color-text-primary)',
                    boxShadow: `0 4px 20px rgba(0,0,0,${shadowOpacity})`,
                    backdropFilter: 'blur(10px)',
                    transition: 'padding 0.1s',
                }}>
                <Container style={{ paddingTop: contentPaddingTop, transition: 'padding-top 0.3s ease-in-out' }}>
                    <div style={{
                        height: `${topContentHeight}px`,
                        opacity: topContentOpacity,
                        overflow: 'hidden',
                        marginBottom: `${0.5 * (1 - scrollProgress)}rem`,
                        transition: 'height 0.1s, opacity 0.1s'
                    }}>
                        <BackButton label="Back to Semester" />
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-primary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Course Dashboard</div>
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
                            minWidth: 0 // Allow text truncation in flex child
                        }}>
                            <h1 className="noselect text-truncate" style={{
                                fontSize: titleSize,
                                margin: 0,
                                fontWeight: 800,
                                letterSpacing: '-0.02em',
                                background: 'linear-gradient(to right, var(--color-text-primary), var(--color-text-secondary))',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                transition: 'font-size 0.1s'
                            }}>
                                {course.name}
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
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{course.credits}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.8, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Grade</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{course.hide_gpa ? '****' : `${course.grade_percentage}%`}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.8, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>GPA (Scaled)</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{course.hide_gpa ? '****' : course.grade_scaled.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>
                        <div style={{
                            display: 'flex',
                            gap: '0.5rem', // Reduce gap slightly for mobile space
                            alignSelf: isShrunk ? 'center' : (scrollProgress > 0.8 ? 'center' : 'flex-start'),
                            paddingTop: isShrunk ? 0 : (scrollProgress > 0.8 ? 0 : '10px'),
                            transition: 'all 0.2s',
                            flexShrink: 0 // Prevent buttons from shrinking
                        }}>
                            <Button
                                variant="glass"
                                onClick={() => setIsSettingsOpen(true)}
                                size="md"
                                shape="circle"
                                title="Course Settings"
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
                    courseId={course.id}
                    updateCourseField={updateCourseField}
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

// Outer component with Provider
export const CourseDashboard: React.FC = () => {
    const { id } = useParams<{ id: string }>();

    if (!id) {
        return (
            <Layout>
                <Container>
                    <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                        <h2 style={{ marginBottom: '1rem' }}>Course not found</h2>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
                            No course ID provided.
                        </p>
                        <Link to="/">
                            <Button>Back to Home</Button>
                        </Link>
                    </div>
                </Container>
            </Layout>
        );
    }

    return (
        <CourseDataProvider courseId={id}>
            <CourseDashboardContent />
        </CourseDataProvider>
    );
};
