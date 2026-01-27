import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { SettingsModal } from '../components/SettingsModal';
import { AddWidgetModal } from '../components/AddWidgetModal';
import { DashboardGrid } from '../components/widgets/DashboardGrid';
import type { WidgetItem } from '../components/widgets/DashboardGrid';
import { WidgetSettingsModal } from '../components/WidgetSettingsModal';
import { DashboardSkeleton } from '../components/Skeleton/DashboardSkeleton';
import api from '../services/api';
import type { Semester, Course, Widget } from '../services/api';
import { BackButton } from '../components/BackButton';
import { Container } from '../components/Container';
import { useDashboardWidgets } from '../hooks/useDashboardWidgets';
import { useDataFetch } from '../hooks/useDataFetch';

export const SemesterDashboard: React.FC = () => {
    const { id } = useParams<{ id: string }>();

    const fetchFn = useCallback(() => api.getSemester(id!), [id]);

    const {
        data: semester,
        isLoading,
        silentRefresh
    } = useDataFetch<Semester & { courses: Course[], widgets: Widget[] }>({
        fetchFn,
        enabled: !!id
    });

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
    const [editingWidget, setEditingWidget] = useState<WidgetItem | null>(null);
    const [isShrunk, setIsShrunk] = useState(false);
    const [isNavbarVisible, setIsNavbarVisible] = useState(true);
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

    const {
        widgets,
        addWidget: handleAddWidget,
        removeWidget: handleRemoveWidget,
        updateWidget: handleUpdateWidget,
        updateLayout: handleLayoutChange
    } = useDashboardWidgets({
        semesterId: semester?.id,
        initialWidgets: semester?.widgets,
        onRefresh: silentRefresh
    });

    const handleUpdateSemester = async (data: any) => {
        if (!semester) return;
        try {
            await api.updateSemester(semester.id, data);
            silentRefresh();
        } catch (error) {
            console.error("Failed to update semester", error);
            alert("Failed to update semester");
        }
    };

    if (isLoading) return <Layout><DashboardSkeleton /></Layout>;
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

    return (
        <Layout>
            <div
                className="hero-section"
                style={{
                    position: 'fixed',
                    top: heroTop,
                    left: 0,
                    right: 0,
                    zIndex: 900,
                    background: 'var(--gradient-hero)', // Keep original gradient
                    padding: containerPadding,
                    color: 'var(--color-text-primary)',
                    boxShadow: `0 4px 20px rgba(0,0,0,${shadowOpacity})`,
                    backdropFilter: 'blur(10px)', // Ensure glass effect if gradient has transparency
                    transition: 'padding 0.1s, top 0.3s ease-in-out, min-height 0.3s ease-in-out', // Smooth out slight jitters and sync with navbar
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    minHeight: isShrunk ? '60px' : '140px', // Ensure a minimum height for centering to work effectively
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
                                maxHeight: statsMaxHeight, 
                                opacity: statsOpacity,
                                overflow: 'hidden',
                                marginTop: isShrunk ? '0' : '0.75rem',
                                transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s, margin-top 0.3s',
                                flexWrap: 'wrap', // Allow wrap on mobile
                                height: 'auto'
                            }}>
                                <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.8, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Credits</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{semester.courses?.reduce((sum, course) => sum + (course.credits || 0), 0) || 0}</div>
                                </div>
                                <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.8, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Avg</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{semester.average_percentage.toFixed(1)}%</div>
                                </div>
                                <div style={{ minWidth: 0, flex: '1 1 auto' }}>
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

            <Container style={{
                padding: '1rem 1rem',
                minHeight: '100vh',
                marginTop: isShrunk ? '60px' : '140px',
                transition: 'margin-top 0.3s ease-in-out'
            }}>
                <DashboardGrid
                    widgets={widgets}
                    onLayoutChange={handleLayoutChange}
                    onRemoveWidget={handleRemoveWidget}
                    onEditWidget={(w) => setEditingWidget(w)}
                    onUpdateWidget={handleUpdateWidget}
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
                            onSave={handleUpdateWidget}
                        />
                    )}
                </>
            )}
        </Layout>
    );
};
