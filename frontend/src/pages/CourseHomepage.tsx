// input:  [course context, query-backed parent Program and Semester breadcrumb data, semester-sibling course navigation data, Program->Semester->unassigned-Course runtime plugin management payloads, keyboard shortcut + motion helpers, Program subject-color settings, Program LMS course catalog state, dashboard tab/widget hooks, plugin metadata/settings/load-state registries, plugin host navigation provider, unavailable-widget cleanup actions, active tab selection state, plugin-derived homepage shell-tab rules, page-scoped global-command actions including semester-course navigation, and shared business empty-state wrappers]
// output: [`CourseHomepage` and internal `CourseHomepageContent` composition component]
// pos:    [Course workspace page with workspace navigation, query-cache-backed parent breadcrumb reuse, semester-sibling course switching from the title area with keyboard shortcuts plus directional motion feedback, runtime-managed plugin inheritance for Semester courses plus lightweight plugin management for unassigned Courses, plugin-derived dashboard/settings shell tabs, global command actions for current-course tab switching plus semester-course navigation and widget creation, plugin-identified settings sections with manifest icons, workspace-scoped plugin host wiring, Program-derived default course colors, Course LMS link/sync controls, LMS cache invalidation on link changes, plugin-global settings, and standardized unavailable/not-found empty states]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { AppEmptyState } from '../components/AppEmptyState';
import { Button } from '@/components/ui/button';
import { AddWidgetModal } from '../components/AddWidgetModal';
import { Tabs } from '../components/Tabs';
import type { WidgetItem } from '../components/widgets/DashboardGrid';
import { WidgetSettingsModal } from '../components/WidgetSettingsModal';
import { CardSkeleton } from '../components/skeletons';
import api from '../services/api';
import { reportError } from '../services/appStatus';
import { queryKeys } from '../services/queryKeys';
import { Container } from '../components/Container';
import { CourseDataProvider, useCourseData } from '../contexts/CourseDataContext';
import { BuiltinTabProvider } from '../contexts/BuiltinTabContext';
import { useDashboardWidgets } from '../hooks/useDashboardWidgets';
import { useDashboardTabs } from '../hooks/useDashboardTabs';
import { useVisibleTabSettingsPreload } from '../hooks/useVisibleTabSettingsPreload';
import { CourseSettingsPanel } from '../components/CourseSettingsPanel';
import { CoursePluginManagementPanel } from '../components/CoursePluginManagementPanel';
import { WorkspaceNav } from '../components/WorkspaceNav';

import { PluginContentFadeIn, PluginTabSkeleton } from '../plugin-system/PluginLoadSkeleton';
import {
    getPluginIconById,
    getResolvedTabMetadataByType,
    getTabPluginLoadState,
    getTabComponentByType,
    getTabSettingsComponentByType,
    hasTabPluginForType,
    PluginHostProvider,
    PluginRuntimeInstanceProvider,
    PluginSettingsSectionRenderer,
    usePluginLoadStateVersion,
    usePluginSettingsRegistry,
    useTabPluginLoadState,
} from '../plugin-system';
import { useHomepageBuiltinTabs } from '../hooks/useHomepageBuiltinTabs';
import { publishTimetableScheduleChange } from '../plugins/builtin-event-core/shared/publishTimetableScheduleChange';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import {
    COURSE_HOMEPAGE_BUILTIN_TAB_CONFIG,
    HOMEPAGE_DASHBOARD_TAB_TYPE,
    HOMEPAGE_SETTINGS_TAB_TYPE,
} from '../utils/homepageBuiltinTabs';
import { parseSubjectColorMap, resolveCourseColor } from '../utils/courseCategoryBadge';
import {
    filterWidgetItemsByEnabledPlugins,
    resolveAvailableWidgetTypes,
    resolveEnabledPluginIds,
    resolveRuntimeTabs,
} from '../plugin-system/runtimeAvailability';

import {
    Breadcrumb,
    BreadcrumbEllipsis,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { ArrowUpDown, BookOpen, ChevronDown, ChevronRight, Command, LayoutDashboard, Plus, Settings } from 'lucide-react';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import type { LayoutCommandGroup } from '../components/GlobalCommandPalette';

// Inner component that uses the context
const CourseHomepageContent: React.FC = () => {
    const { course, updateCourse, saveCourse, refreshCourse, isLoading } = useCourseData();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const prefersReducedMotion = usePrefersReducedMotion();
    const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
    const [editingWidget, setEditingWidget] = useState<WidgetItem | null>(null);
    const [activeTabId, setActiveTabId] = useState('');
    const [courseSwitchDirection, setCourseSwitchDirection] = useState<-1 | 0 | 1>(0);
    const titleShakeControls = useAnimationControls();
    const lastCourseSwitchAtRef = useRef(0);
    const openAddWidgetModal = useCallback(() => {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) {
            activeElement.blur();
        }
        setIsAddWidgetOpen(true);
    }, []);
    const shouldCollapseProgram = Boolean(course?.program_id && course?.semester_id);
    const shouldShowProgramDirect = Boolean(course?.program_id && !shouldCollapseProgram);
    const shouldShowSemester = Boolean(course?.semester_id);

    const parentProgramQuery = useQuery({
        queryKey: queryKeys.programs.detail(course?.program_id ?? 'unknown'),
        queryFn: async () => {
            const programId = course?.program_id;
            if (!programId) {
                throw new Error('Missing parent program ID.');
            }
            return api.getProgram(programId);
        },
        enabled: Boolean(course?.program_id),
        staleTime: 300_000,
        initialData: () => {
            const programId = course?.program_id;
            if (!programId) return undefined;
            return queryClient.getQueryData(queryKeys.programs.detail(programId));
        },
    });
    const programName = parentProgramQuery.data?.name ?? null;
    const programSubjectColorMapJson = parentProgramQuery.data?.subject_color_map || '{}';
    const programLmsIntegrationId = parentProgramQuery.data?.lms_integration_id ?? null;

    const parentSemesterQuery = useQuery({
        queryKey: queryKeys.semesters.detail(course?.semester_id ?? 'unknown'),
        queryFn: async () => {
            const semesterId = course?.semester_id;
            if (!semesterId) {
                throw new Error('Missing parent semester ID.');
            }
            return api.getSemester(semesterId);
        },
        enabled: Boolean(course?.semester_id),
        staleTime: 300_000,
        initialData: () => {
            const semesterId = course?.semester_id;
            if (!semesterId) return undefined;
            return queryClient.getQueryData(queryKeys.semesters.detail(semesterId));
        },
    });
    const semesterName = parentSemesterQuery.data?.name ?? null;
    const siblingCourses = useMemo(() => {
        const courses = parentSemesterQuery.data?.courses ?? [];
        return [...courses].sort((left, right) => left.name.localeCompare(right.name));
    }, [parentSemesterQuery.data?.courses]);
    const currentCourseIndex = useMemo(() => {
        if (!course?.id) return -1;
        return siblingCourses.findIndex((siblingCourse) => siblingCourse.id === course.id);
    }, [course?.id, siblingCourses]);
    const programSubjectColorMap = useMemo(
        () => parseSubjectColorMap(programSubjectColorMapJson),
        [programSubjectColorMapJson],
    );
    const resolvedDefaultColor = useMemo(() => {
        if (!course) return null;
        return resolveCourseColor({ ...course, color: null }, programSubjectColorMap);
    }, [course, programSubjectColorMap]);
    const runtimeTabs = useMemo(
        () => resolveRuntimeTabs(course?.runtime, `course:${course?.id ?? 'unknown'}`),
        [course?.id, course?.runtime]
    );
    const enabledPluginIds = useMemo(() => {
        return resolveEnabledPluginIds(course?.runtime);
    }, [course?.runtime]);
    const availableWidgetTypes = useMemo(() => {
        return Array.from(resolveAvailableWidgetTypes(course?.runtime));
    }, [course?.runtime]);
    const availableLmsCoursesQuery = useQuery({
        queryKey: queryKeys.programs.lmsCourses(course?.program_id ?? 'unknown', { mode: 'link-picker' }),
        queryFn: async () => {
            if (!course?.program_id) return null;
            return api.listProgramLmsCourses(course.program_id, { page: 1, page_size: 100 });
        },
        enabled: Boolean(course?.program_id && programLmsIntegrationId),
        retry: false,
    });

    const {
        widgets,
        addWidget: handleAddWidget,
        removeWidget: handleRemoveWidget,
        removeUnavailableWidget: handleRemoveUnavailableWidget,
        updateWidget: handleUpdateWidget,
        updateWidgetDebounced: handleUpdateWidgetDebounced,
        updateLayout: handleLayoutChange,
        commitLayout: handleLayoutCommit
    } = useDashboardWidgets({
        courseId: course?.id,
        initialWidgets: course?.widgets,
        onRefresh: refreshCourse
    });
    const visibleWidgets = useMemo(
        () => filterWidgetItemsByEnabledPlugins(widgets, enabledPluginIds),
        [enabledPluginIds, widgets]
    );

    const {
        tabs,
        isInitialized: isTabsInitialized,
        updateTabSettingsDebounced,
        reorderTabs
    } = useDashboardTabs({
        courseId: course?.id,
        orderOwnerSemesterId: course?.semester_id,
        initialTabs: runtimeTabs,
        managed: true,
        onRefresh: refreshCourse
    });

    const breadcrumb = (
        <Breadcrumb>
            <BreadcrumbList className="text-xs font-medium text-muted-foreground">
                <BreadcrumbItem>
                    <BreadcrumbLink asChild className="text-muted-foreground hover:text-foreground transition-colors">
                        <Link to="/">Academics</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                {shouldCollapseProgram && (
                    <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                        <BreadcrumbEllipsis />
                                        <span className="sr-only">Toggle menu</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                    <DropdownMenuGroup>
                                        <DropdownMenuItem
                                            className="normal-case"
                                            onSelect={(event) => {
                                                event.preventDefault();
                                                if (course?.program_id) {
                                                    navigate(`/programs/${course.program_id}`);
                                                }
                                            }}
                                        >
                                            {programName || 'Program'}
                                        </DropdownMenuItem>
                                    </DropdownMenuGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </BreadcrumbItem>
                    </>
                )}
                {shouldShowProgramDirect && (
                    <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild className="text-muted-foreground hover:text-foreground transition-colors">
                                <Link to={`/programs/${course?.program_id}`}>
                                    {programName || 'Program'}
                                </Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                    </>
                )}
                {shouldShowSemester && (
                    <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild className="text-muted-foreground hover:text-foreground transition-colors">
                                <Link to={`/semesters/${course?.semester_id}`}>
                                    {semesterName || 'Semester'}
                                </Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                    </>
                )}
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbPage className="text-foreground font-semibold">
                        {course?.name || 'Course'}
                    </BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    );

    const handleUpdateTabSettings = useCallback((tabId: string, newSettings: any) => {
        updateTabSettingsDebounced(tabId, { settings: JSON.stringify(newSettings) });
    }, [updateTabSettingsDebounced]);

    const {
        isActiveTabPluginLoading,
        tabBarItems,
        visibleTabs,
        areBuiltinTabsReady,
        filterReorderableTabIds,
    } = useHomepageBuiltinTabs({
        tabs,
        activeTabId,
        scopeKey: `course:${course?.id ?? 'unknown'}`,
        config: COURSE_HOMEPAGE_BUILTIN_TAB_CONFIG,
        isTabsInitialized,
    });

    const allPluginSettingsDefinitions = usePluginSettingsRegistry('course');
    const pluginSettingsDefinitions = useMemo(
        () => allPluginSettingsDefinitions.filter((definition) => enabledPluginIds.has(definition.pluginId)),
        [allPluginSettingsDefinitions, enabledPluginIds]
    );
    const activeTabType = useMemo(
        () => visibleTabs.find((tab) => tab.id === activeTabId)?.type,
        [activeTabId, visibleTabs]
    );
    const activeTabLoadState = useTabPluginLoadState(activeTabType);
    const isSettingsTabActive = activeTabType === HOMEPAGE_SETTINGS_TAB_TYPE;
    const pluginLoadStateVersion = usePluginLoadStateVersion();
    useVisibleTabSettingsPreload({
        tabs: visibleTabs,
        enabled: isSettingsTabActive,
        ignoredTypes: [HOMEPAGE_DASHBOARD_TAB_TYPE, HOMEPAGE_SETTINGS_TAB_TYPE],
    });

    const dashboardContent = useMemo(() => {
        if (!course) return null;
        if (!activeTabId) return <PluginTabSkeleton />;
        const activeTab = visibleTabs.find(tab => tab.id === activeTabId);
        const TabComponent = activeTab ? getTabComponentByType(activeTab.type) : undefined;
        if (!activeTab) {
            return (
                <AppEmptyState
                    scenario="unavailable"
                    size="section"
                    title="Tab not found"
                    description="The requested tab is unavailable."
                />
            );
        }
        if (activeTab.availability?.state === 'unavailable') {
            return (
                <AppEmptyState
                    scenario="unavailable"
                    size="section"
                    title={`${activeTab.title || activeTab.type} is unavailable`}
                    description={
                        activeTab.availability.reason_message
                        || 'This tab is currently unavailable in this course.'
                    }
                />
            );
        }
        if (!TabComponent) {
            if (
                hasTabPluginForType(activeTab.type) &&
                (isActiveTabPluginLoading || activeTabLoadState.status === 'idle' || activeTabLoadState.status === 'loading')
            ) {
                return <PluginTabSkeleton />;
            }
            if (activeTabLoadState.status === 'error') {
                return (
                    <AppEmptyState
                        scenario="unavailable"
                        size="section"
                        title="Plugin failed to load"
                        description={activeTab.type}
                    />
                );
            }
            return (
                <AppEmptyState
                    scenario="unavailable"
                    size="section"
                    title="Unknown tab type"
                    description={activeTab.type}
                />
            );
        }
        return (
            <React.Suspense fallback={<PluginTabSkeleton />}>
                <PluginRuntimeInstanceProvider
                    value={{
                        workspaceKind: 'course',
                        workspaceId: course.id,
                        slotKind: 'tab',
                        slotId: activeTab.id,
                        pluginType: activeTab.type,
                    }}
                >
                    <PluginContentFadeIn key={activeTab.id}>
                        <TabComponent
                            tabId={activeTab.id}
                            settings={activeTab.settings || {}}
                            semesterId={course.semester_id}
                            courseId={course.id}
                            updateSettings={(newSettings) => handleUpdateTabSettings(activeTab.id, newSettings)}
                        />
                    </PluginContentFadeIn>
                </PluginRuntimeInstanceProvider>
            </React.Suspense>
        );
    }, [activeTabId, course, visibleTabs, handleUpdateTabSettings, isActiveTabPluginLoading, activeTabLoadState.status]);

    const handleReorderTabs = useCallback((orderedIds: string[]) => {
        reorderTabs(filterReorderableTabIds(orderedIds));
    }, [filterReorderableTabIds, reorderTabs]);
    const siblingCourseItems = useMemo(() => {
        if (!course?.id) {
            return [];
        }

        return siblingCourses
            .filter((siblingCourse) => siblingCourse.id !== course.id)
            .map((siblingCourse) => ({
                id: `course-sibling-${siblingCourse.id}`,
                title: siblingCourse.name,
                keywords: ['semester course', 'course', siblingCourse.alias ?? '', siblingCourse.category ?? ''],
                icon: BookOpen,
                onSelect: () => navigate(`/courses/${siblingCourse.id}`),
            }));
    }, [course?.id, navigate, siblingCourses]);
    const layoutCommandGroups = useMemo<LayoutCommandGroup[]>(() => {
        if (!course?.id) {
            return [];
        }

        const courseTabItems = visibleTabs.map((tab) => {
            const metadata = getResolvedTabMetadataByType(tab.type);
            const displayName = metadata.name ?? tab.title ?? tab.type;

            return {
                id: `course-open-tab-${tab.id}`,
                title: displayName,
                description: `Switch to the ${displayName} tab.`,
                keywords: ['course tab', 'tab', tab.type, tab.title, displayName],
                icon: metadata.icon ?? (
                    tab.type === HOMEPAGE_DASHBOARD_TAB_TYPE
                        ? LayoutDashboard
                        : tab.type === HOMEPAGE_SETTINGS_TAB_TYPE
                            ? Settings
                            : undefined
                ),
                onSelect: () => setActiveTabId(tab.id),
            };
        });

        return [
            {
                heading: 'Course',
                items: [
                    ...courseTabItems,
                    {
                        id: `course-add-widget-${course.id}`,
                        title: 'Add Widget',
                        description: 'Open the Course widget picker.',
                        keywords: ['new widget', 'course widget'],
                        icon: Plus,
                        onSelect: openAddWidgetModal,
                    },
                ],
            },
            {
                heading: 'Semester Courses',
                items: siblingCourseItems,
            },
        ];
    }, [course?.id, openAddWidgetModal, siblingCourseItems, visibleTabs]);

    useEffect(() => {
        if (tabBarItems.length === 0) {
            if (activeTabId) setActiveTabId('');
            return;
        }
        if (!activeTabId && !areBuiltinTabsReady) return;
        if (!activeTabId || !tabBarItems.some(tab => tab.id === activeTabId)) {
            setActiveTabId(tabBarItems[0].id);
        }
    }, [activeTabId, areBuiltinTabsReady, tabBarItems]);

    const tabInstanceSettingsSections = useMemo(() => {
        const sections = visibleTabs
            .filter((tab) => tab.type !== HOMEPAGE_DASHBOARD_TAB_TYPE && tab.type !== HOMEPAGE_SETTINGS_TAB_TYPE)
            .map((tab) => {
                const SettingsComponent = getTabSettingsComponentByType(tab.type);
                if (SettingsComponent) {
                    return (
                        <React.Fragment key={tab.id}>
                            <SettingsComponent
                                tabId={tab.id}
                                settings={tab.settings || {}}
                                semesterId={course?.semester_id}
                                courseId={course?.id}
                                updateSettings={(newSettings) => handleUpdateTabSettings(tab.id, newSettings)}
                            />
                        </React.Fragment>
                    );
                }
                if (!isSettingsTabActive) return null;

                if (!hasTabPluginForType(tab.type)) {
                    return (
                        <div
                            key={tab.id}
                            className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-muted-foreground"
                            role="status"
                            aria-live="polite"
                        >
                            Settings unavailable for {tab.title || tab.type}: unknown tab type.
                        </div>
                    );
                }

                const tabLoadState = getTabPluginLoadState(tab.type);
                if (tabLoadState.status === 'error') {
                    return (
                        <div
                            key={tab.id}
                            className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-muted-foreground"
                            role="status"
                            aria-live="polite"
                        >
                            Settings unavailable for {tab.title || tab.type}: plugin failed to load.
                        </div>
                    );
                }
                if (tabLoadState.status === 'loaded') return null;
                return (
                    <div
                        key={tab.id}
                        className="rounded-xl border border-border/70 bg-card/60 px-4 py-3 text-sm text-muted-foreground"
                        role="status"
                        aria-live="polite"
                    >
                        Loading settings for {tab.title || tab.type}...
                    </div>
                );
            })
            .filter(Boolean);

        if (sections.length === 0) return null;

        return (
            <div className="flex flex-col gap-4">
                {sections}
            </div>
        );
    }, [
        visibleTabs,
        course?.id,
        handleUpdateTabSettings,
        isSettingsTabActive,
        pluginLoadStateVersion
    ]);

    const pluginSettingsSections = useMemo(() => {
        const pluginMetadataById = new Map(
            (course?.plugin_activations ?? parentSemesterQuery.data?.plugin_activations ?? [])
                .filter((activation) => enabledPluginIds.has(activation.plugin_id))
                .map((activation) => [
                    activation.plugin_id,
                    {
                        displayName: activation.display_name,
                        description: activation.description,
                    },
                ])
        );
        const renderedPluginHeaders = new Set<string>();
        const sections = pluginSettingsDefinitions
            .filter((definition) => enabledPluginIds.has(definition.pluginId))
            .map((definition) => {
                const pluginMetadata = pluginMetadataById.get(definition.pluginId);
                const showPluginHeader = !renderedPluginHeaders.has(definition.pluginId);
                renderedPluginHeaders.add(definition.pluginId);
                return (
                    <React.Fragment key={`${definition.pluginId}:${definition.id}`}>
                        <PluginSettingsSectionRenderer
                            pluginId={definition.pluginId}
                            pluginIcon={getPluginIconById(definition.pluginId)}
                            pluginDisplayName={pluginMetadata?.displayName}
                            pluginDescription={pluginMetadata?.description}
                            showPluginHeader={showPluginHeader}
                            component={definition.component}
                            courseId={course?.id}
                            onRefresh={refreshCourse}
                        />
                    </React.Fragment>
                );
            });

        if (sections.length === 0) return null;

        return (
            <div className="flex flex-col gap-4">
                {sections}
            </div>
        );
    }, [course?.id, course?.plugin_activations, enabledPluginIds, parentSemesterQuery.data?.plugin_activations, pluginSettingsDefinitions, refreshCourse]);

    const coursePluginGovernanceSection = useMemo(() => {
        if (!course?.id || course.semester_id) {
            return null;
        }
        return (
            <CoursePluginManagementPanel
                courseId={course.id}
                pluginActivations={course.plugin_activations ?? []}
                onChanged={refreshCourse}
            />
        );
    }, [course?.id, course?.plugin_activations, course?.semester_id, refreshCourse]);

    const hasPluginSettings = Boolean(coursePluginGovernanceSection || pluginSettingsSections || tabInstanceSettingsSections);

    const handleUpdateCourse = useCallback(async (data: any) => {
        if (!course) return;
        try {
            await saveCourse(data);
            await publishTimetableScheduleChange({
                source: 'course',
                reason: 'course-updated',
                courseId: course.id,
                semesterId: course.semester_id,
            });
        } catch (error) {
            console.error("Failed to update course", error);
            reportError('Failed to update course. Please retry.');
        }
    }, [course, saveCourse]);

    const triggerBoundaryShake = useCallback(async () => {
        if (prefersReducedMotion) {
            return;
        }
        await titleShakeControls.start({
            x: [0, -5, 5, -4, 4, 0],
            transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
        });
        titleShakeControls.set({ x: 0 });
    }, [prefersReducedMotion, titleShakeControls]);

    const navigateToSiblingCourse = useCallback((nextCourseId: string, direction: -1 | 1) => {
        if (!nextCourseId || nextCourseId === course?.id) {
            return;
        }
        const now = Date.now();
        if (now - lastCourseSwitchAtRef.current < 320) {
            return;
        }
        lastCourseSwitchAtRef.current = now;
        setCourseSwitchDirection(direction);
        navigate(`/courses/${nextCourseId}`);
    }, [course?.id, navigate]);

    const handleSelectSiblingCourse = useCallback((nextCourseId: string) => {
        if (!nextCourseId || nextCourseId === course?.id) {
            return;
        }
        const nextCourseIndex = siblingCourses.findIndex((siblingCourse) => siblingCourse.id === nextCourseId);
        const direction: -1 | 1 = nextCourseIndex < currentCourseIndex ? -1 : 1;
        navigateToSiblingCourse(nextCourseId, direction);
    }, [course?.id, currentCourseIndex, navigateToSiblingCourse, siblingCourses]);

    useEffect(() => {
        if (!course?.id) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            const modifierPressed = event.metaKey || event.ctrlKey;
            if (!modifierPressed || event.altKey || event.shiftKey) {
                return;
            }

            const target = event.target;
            if (
                target instanceof HTMLElement
                && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
            ) {
                return;
            }

            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
                return;
            }

            if (currentCourseIndex < 0 || siblingCourses.length === 0) {
                return;
            }

            event.preventDefault();
            const direction: -1 | 1 = event.key === 'ArrowUp' ? -1 : 1;
            const nextCourse = siblingCourses[currentCourseIndex + direction];

            if (!nextCourse) {
                void triggerBoundaryShake();
                return;
            }

            navigateToSiblingCourse(nextCourse.id, direction);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [course?.id, currentCourseIndex, navigateToSiblingCourse, siblingCourses, triggerBoundaryShake]);

    const refreshLmsCourseState = useCallback(async () => {
        if (!course?.id) return;
        await Promise.all([
            refreshCourse(),
            queryClient.invalidateQueries({ queryKey: queryKeys.courses.lmsLink(course.id) }),
            queryClient.invalidateQueries({ queryKey: queryKeys.courses.lmsAssignments(course.id) }),
            queryClient.invalidateQueries({ queryKey: queryKeys.courses.gradebook(course.id) }),
            course.program_id
                ? queryClient.invalidateQueries({ queryKey: queryKeys.programs.lmsCourses(course.program_id, { mode: 'link-picker' }) })
                : Promise.resolve(),
            course.semester_id
                ? queryClient.invalidateQueries({ queryKey: queryKeys.semesters.lmsAssignments(course.semester_id) })
                : Promise.resolve(),
            course.semester_id
                ? queryClient.invalidateQueries({ queryKey: queryKeys.semesters.lmsCalendarEvents(course.semester_id) })
                : Promise.resolve(),
        ]);
        await publishTimetableScheduleChange({
            source: 'course',
            reason: 'course-updated',
            courseId: course.id,
            semesterId: course.semester_id,
        });
    }, [course?.id, course?.program_id, course?.semester_id, queryClient, refreshCourse]);

    const handleLinkCourse = useCallback(async (data: { external_course_id: string; sync_enabled: boolean }) => {
        if (!course) return;
        try {
            await api.upsertCourseLmsLink(course.id, data);
            await refreshLmsCourseState();
        } catch (error) {
            console.error('Failed to link LMS course', error);
            reportError('Failed to link LMS course. Please retry.');
        }
    }, [course, refreshLmsCourseState]);

    const handleSyncCourseLink = useCallback(async (data?: { sync_enabled?: boolean }) => {
        if (!course) return;
        try {
            await api.syncCourseLmsLink(course.id, data);
            await refreshLmsCourseState();
        } catch (error) {
            console.error('Failed to sync LMS course', error);
            reportError('Failed to sync LMS course. Please retry.');
        }
    }, [course, refreshLmsCourseState]);

    const handleUnlinkCourse = useCallback(async () => {
        if (!course) return;
        try {
            await api.deleteCourseLmsLink(course.id);
            await refreshLmsCourseState();
        } catch (error) {
            console.error('Failed to unlink LMS course', error);
            reportError('Failed to unlink LMS course. Please retry.');
        }
    }, [course, refreshLmsCourseState]);

    const builtinTabContext = useMemo(() => ({
        isLoading,
        dashboard: {
            widgets: visibleWidgets,
            onAddWidgetClick: openAddWidgetModal,
            onRemoveWidget: handleRemoveWidget,
            onRemoveUnavailableWidget: handleRemoveUnavailableWidget,
            onEditWidget: (widget: WidgetItem) => setEditingWidget(widget),
            onUpdateWidget: handleUpdateWidget,
            onUpdateWidgetDebounced: handleUpdateWidgetDebounced,
            onLayoutChange: handleLayoutChange,
            onLayoutCommit: handleLayoutCommit,
            courseId: course?.id,
            updateCourse
        },
        settings: {
            content: (
                <CourseSettingsPanel
                    initialName={course?.name ?? ''}
                    initialSettings={{
                        alias: course?.alias,
                        category: course?.category,
                        color: course?.color,
                        credits: course?.credits,
                        include_in_gpa: course?.include_in_gpa,
                        hide_gpa: course?.hide_gpa
                    }}
                    resolvedDefaultColor={resolvedDefaultColor}
                    lmsLink={course?.lms_link}
                    lmsIntegrationEnabled={Boolean(programLmsIntegrationId)}
                    availableLmsCourses={availableLmsCoursesQuery.data?.items ?? []}
                    onLinkCourse={handleLinkCourse}
                    onSyncCourseLink={handleSyncCourseLink}
                    onUnlinkCourse={handleUnlinkCourse}
                    onSave={handleUpdateCourse}
                />
            ),
            extraSections: hasPluginSettings ? (
                <div className="space-y-6">
                    {coursePluginGovernanceSection}
                    {pluginSettingsSections}
                    {tabInstanceSettingsSections}
                </div>
            ) : undefined
        }
    }), [
        isLoading,
        widgets,
        visibleWidgets,
        handleRemoveWidget,
        handleRemoveUnavailableWidget,
        handleUpdateWidget,
        handleUpdateWidgetDebounced,
        handleLayoutChange,
        handleLayoutCommit,
        course?.id,
        course?.name,
        course?.alias,
        course?.category,
        course?.credits,
        course?.color,
        course?.include_in_gpa,
        course?.hide_gpa,
        course?.lms_link,
        resolvedDefaultColor,
        programLmsIntegrationId,
        availableLmsCoursesQuery.data?.items,
        handleLinkCourse,
        handleSyncCourseLink,
        handleUnlinkCourse,
        updateCourse,
        handleUpdateCourse,
        hasPluginSettings,
        coursePluginGovernanceSection,
        pluginSettingsSections,
        tabInstanceSettingsSections,
        openAddWidgetModal
    ]);

    if (!isLoading && !course) {
        return (
            <Layout>
                <Container>
                    <AppEmptyState
                        scenario="not-found"
                        size="page"
                        title="Course not found"
                        description="The course you are looking for does not exist or has been deleted."
                        primaryAction={(
                            <Link to="/">
                                <Button>Back to Home</Button>
                            </Link>
                        )}
                    />
                </Container>
            </Layout>
        );
    }

    return (
        <Layout breadcrumb={breadcrumb} commandGroups={layoutCommandGroups}>
            <PluginHostProvider visibleTabs={visibleTabs} setActiveTabId={setActiveTabId}>
                <BuiltinTabProvider value={builtinTabContext}>
                    <WorkspaceNav
                        title={course ? (
                            <div className="flex min-w-0 items-center gap-2.5 text-xl font-semibold tracking-tight sm:text-2xl">
                                {semesterName ? (
                                    <>
                                        <span className="truncate text-muted-foreground">{semesterName}</span>
                                        <ChevronRight className="ml-2 mr-1 h-4 w-4 shrink-0 text-muted-foreground" />
                                    </>
                                ) : null}
                                <motion.div className="min-w-0" animate={titleShakeControls}>
                                    {course.semester_id && siblingCourses.length > 0 ? (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        className="h-auto min-w-0 max-w-full justify-start gap-2 rounded-md bg-accent/60 px-2.5 py-1 text-left text-[0.9em] font-semibold tracking-tight text-foreground hover:bg-accent/70"
                                                    >
                                                    <span className="grid min-w-0">
                                                        <AnimatePresence mode="wait" initial={false}>
                                                            <motion.span
                                                                key={course.id}
                                                                className="truncate"
                                                                initial={prefersReducedMotion ? { opacity: 1 } : {
                                                                    opacity: 0,
                                                                    y: courseSwitchDirection > 0 ? 10 : courseSwitchDirection < 0 ? -10 : 0,
                                                                }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                exit={prefersReducedMotion ? { opacity: 1 } : {
                                                                    opacity: 0,
                                                                    y: courseSwitchDirection > 0 ? -10 : courseSwitchDirection < 0 ? 10 : 0,
                                                                }}
                                                                transition={prefersReducedMotion
                                                                    ? { duration: 0.12 }
                                                                    : { type: 'spring', stiffness: 520, damping: 38, mass: 0.7 }
                                                                }
                                                                onAnimationComplete={() => {
                                                                    if (courseSwitchDirection !== 0) {
                                                                        setCourseSwitchDirection(0);
                                                                    }
                                                                }}
                                                            >
                                                                {course.name}
                                                            </motion.span>
                                                        </AnimatePresence>
                                                    </span>
                                                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="min-w-[18rem]">
                                                <DropdownMenuLabel>
                                                    {semesterName ? `${semesterName} Courses` : 'Courses'}
                                                </DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuRadioGroup
                                                    value={course.id}
                                                    onValueChange={handleSelectSiblingCourse}
                                                >
                                                    {siblingCourses.map((siblingCourse) => (
                                                        <DropdownMenuRadioItem
                                                            key={siblingCourse.id}
                                                            value={siblingCourse.id}
                                                            className="min-w-0"
                                                        >
                                                            <span className="truncate">{siblingCourse.name}</span>
                                                        </DropdownMenuRadioItem>
                                                    ))}
                                                </DropdownMenuRadioGroup>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    ) : (
                                        <AnimatePresence mode="wait" initial={false}>
                                            <motion.span
                                                key={course.id}
                                                className="truncate text-foreground"
                                                initial={prefersReducedMotion ? { opacity: 1 } : {
                                                    opacity: 0,
                                                    y: courseSwitchDirection > 0 ? 10 : courseSwitchDirection < 0 ? -10 : 0,
                                                }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={prefersReducedMotion ? { opacity: 1 } : {
                                                    opacity: 0,
                                                    y: courseSwitchDirection > 0 ? -10 : courseSwitchDirection < 0 ? 10 : 0,
                                                }}
                                                transition={prefersReducedMotion
                                                    ? { duration: 0.12 }
                                                    : { type: 'spring', stiffness: 520, damping: 38, mass: 0.7 }
                                                }
                                                onAnimationComplete={() => {
                                                    if (courseSwitchDirection !== 0) {
                                                        setCourseSwitchDirection(0);
                                                    }
                                                }}
                                            >
                                                {course.name}
                                            </motion.span>
                                        </AnimatePresence>
                                    )}
                                </motion.div>
                                {course.semester_id && siblingCourses.length > 1 ? (
                                    <div className="hidden items-center gap-2 text-sm font-medium text-muted-foreground lg:flex">
                                        <KbdGroup aria-label="Command or control plus up or down arrow">
                                            <Kbd>
                                                <Command aria-hidden="true" />
                                                <span className="sr-only">Command or Control</span>
                                            </Kbd>
                                            <span className="text-muted-foreground/70">+</span>
                                            <Kbd>
                                                <ArrowUpDown aria-hidden="true" />
                                                <span className="sr-only">Up or down arrow</span>
                                            </Kbd>
                                        </KbdGroup>
                                    </div>
                                ) : null}
                            </div>
                        ) : 'Course'}
                        isLoading={isLoading || !course}
                        tabsLoading={!areBuiltinTabsReady}
                        tabs={(
                            <Tabs
                                items={tabBarItems}
                                activeId={activeTabId}
                                onSelect={setActiveTabId}
                                onReorder={handleReorderTabs}
                            />
                        )}
                    />

                    <Container className="py-5 sm:py-6">
                    {isLoading || !course || !course.id ? (  /* Check course.id since useDashboardWidgets needs it */
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <CardSkeleton key={i} className="h-[240px]" />
                                ))}
                            </div>
                    ) : (
                                dashboardContent
                    )}
                    </Container>
                    {
                        course && (
                            <>
                                <AddWidgetModal
                                    isOpen={isAddWidgetOpen}
                                    onClose={() => setIsAddWidgetOpen(false)}
                                    onAdd={handleAddWidget}
                                    context="course"
                                    widgets={visibleWidgets}
                                    allowedTypes={availableWidgetTypes}
                                />
                                <WidgetSettingsModal
                                    isOpen={!!editingWidget}
                                    onClose={() => setEditingWidget(null)}
                                    widget={editingWidget}
                                    onSave={handleUpdateWidget}
                                    courseId={course.id}
                                    semesterId={course.semester_id}
                                />
                            </>
                        )
                    }
                </BuiltinTabProvider>
            </PluginHostProvider>
        </Layout >
    );
};

// Outer component with Provider
export const CourseHomepage: React.FC = () => {
    const { id } = useParams<{ id: string }>();

    if (!id) {
        return (
            <Layout>
                <Container>
                    <AppEmptyState
                        scenario="not-found"
                        size="page"
                        title="Course not found"
                        description="No course ID provided."
                        primaryAction={(
                            <Link to="/">
                                <Button>Back to Home</Button>
                            </Link>
                        )}
                    />
                </Container>
            </Layout>
        );
    }

    return (
        <CourseDataProvider courseId={id}>
            <CourseHomepageContent />
        </CourseDataProvider>
    );
};
