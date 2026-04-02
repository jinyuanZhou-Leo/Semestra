// input:  [auth state/actions including active-Program mutation, app-status notifications, header slot props, page-scoped command groups, theme state/actions, API-backed account/workspace navigation loaders with structured course metadata, and children]
// output: [`Layout` component]
// pos:    [Shared authenticated page chrome with a stable brand-plus-breadcrumb header cluster, a navbar Program workspace switcher, a slash-triggered command palette that mixes lazy account navigation with direct workspace actions plus structured course-row metadata, authenticated header actions, and sign-out handling]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, matchPath, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAppStatus } from '../hooks/useAppStatus';
import api, { type Course, type Program, type Semester } from '../services/api';
import { Container } from './Container';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, BookOpen, ChevronDown, Eye, EyeOff, FolderKanban, Home, Laptop, LayoutDashboard, LogOut, Moon, Search, Settings, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from './ThemeProvider';
import { Kbd } from '@/components/ui/kbd';
import { getCourseBadgeStyle, getCourseCategoryBadgeClassName, resolveCourseColor } from '@/utils/courseCategoryBadge';
import {
    GlobalCommandPalette,
    type LayoutCommandGroup,
    type LayoutCommandItem,
} from './GlobalCommandPalette';

interface LayoutProps {
    children: React.ReactNode;
    breadcrumb?: React.ReactNode;
    commandGroups?: LayoutCommandGroup[];
}

export const Layout: React.FC<LayoutProps> = ({ children, breadcrumb, commandGroups = [] }) => {
    const { user, logout, setActiveProgram } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { status, clearStatus, pendingSyncRetryCount, retryFailedSync } = useAppStatus();
    const { setTheme } = useTheme();
    const isSyncStatus = status?.type === 'error' && /sync/i.test(status.message);
    const isSyncRetrying = Boolean(isSyncStatus && /retrying/i.test(status?.message ?? ''));
    const hasFailedSync = pendingSyncRetryCount > 0;
    const lastToastIdRef = useRef<number | null>(null);
    const [isRetryingSync, setIsRetryingSync] = useState(false);
    const [isCommandOpen, setIsCommandOpen] = useState(false);
    const [programs, setPrograms] = useState<Program[]>([]);
    const [isProgramsLoading, setIsProgramsLoading] = useState(false);
    const [isSwitchingProgram, setIsSwitchingProgram] = useState(false);

    useEffect(() => {
        if (!status || !isSyncStatus) return;
        if (lastToastIdRef.current === status.id) return;
        lastToastIdRef.current = status.id;
        if (isSyncRetrying) {
            toast.message(status.message, {
                icon: <Spinner className="size-3 text-destructive" />,
                duration: 4000,
                position: 'bottom-left',
            });
        } else {
            toast.error(status.message, {
                duration: Infinity,
                onDismiss: clearStatus,
                icon: <AlertCircle className="h-4 w-4" />,
                position: 'bottom-left',
                action: {
                    label: "Dismiss",
                    onClick: clearStatus,
                },
            });
        }
    }, [clearStatus, isSyncRetrying, isSyncStatus, status]);

    useEffect(() => {
        if (!user) {
            setPrograms([]);
            setIsProgramsLoading(false);
            return;
        }

        let isActive = true;
        setIsProgramsLoading(true);

        void api.getPrograms()
            .then((nextPrograms) => {
                if (!isActive) {
                    return;
                }
                setPrograms(nextPrograms);
            })
            .catch((error) => {
                if (!isActive) {
                    return;
                }
                console.error('Failed to fetch programs for navbar workspace switcher', error);
            })
            .finally(() => {
                if (!isActive) {
                    return;
                }
                setIsProgramsLoading(false);
            });

        return () => {
            isActive = false;
        };
    }, [location.pathname, user]);

    const handleManualSyncRetry = async () => {
        if (isRetryingSync) return;
        setIsRetryingSync(true);
        clearStatus();
        toast.message('Retrying failed sync tasks...', {
            icon: <Spinner className="size-3" />,
            duration: 2500,
            position: 'bottom-left',
        });
        try {
            await retryFailedSync();
        } finally {
            setIsRetryingSync(false);
        }
    };

    const signOut = async () => {
        await logout();
        window.location.href = '/login';
    };

    const activeProgram = useMemo(
        () => programs.find((program) => program.id === user?.active_program_id) ?? null,
        [programs, user?.active_program_id],
    );

    const handleProgramSwitch = async (programId: string) => {
        if (!programId || isSwitchingProgram) {
            return;
        }

        setIsSwitchingProgram(true);
        try {
            await setActiveProgram(programId);
            navigate(`/programs/${programId}`);
        } catch (error) {
            console.error('Failed to switch active program from navbar', error);
            toast.error('Failed to switch the active Program.');
        } finally {
            setIsSwitchingProgram(false);
        }
    };

    useEffect(() => {
        const body = document.body;
        if (!body) return;

        let rafId: number | null = null;
        let observedHeader: HTMLElement | null = null;
        let resizeObserver: ResizeObserver | null = null;

        const isBodyScrollLocked = () =>
            body.hasAttribute('data-scroll-locked') || /overflow:\s*hidden/.test(body.getAttribute('style') ?? '');

        const clearStickyHeaderLock = () => {
            body.removeAttribute('data-sticky-header-lock');
            body.style.removeProperty('--sticky-page-header-height');
        };

        const attachHeaderObserver = (header: HTMLElement | null) => {
            if (observedHeader === header) return;
            resizeObserver?.disconnect();
            resizeObserver = null;
            observedHeader = header;
            if (!header || typeof ResizeObserver === 'undefined') return;
            resizeObserver = new ResizeObserver(() => {
                scheduleUpdate();
            });
            resizeObserver.observe(header);
        };

        const updateStickyHeaderLock = () => {
            const header = document.querySelector<HTMLElement>('.sticky-page-header');
            if (isBodyScrollLocked() && header) {
                attachHeaderObserver(header);
            } else {
                attachHeaderObserver(null);
            }

            if (!header || !isBodyScrollLocked()) {
                clearStickyHeaderLock();
                return;
            }

            const headerHeight = Math.ceil(header.getBoundingClientRect().height);
            body.setAttribute('data-sticky-header-lock', 'true');
            body.style.setProperty('--sticky-page-header-height', `${headerHeight}px`);
        };

        const scheduleUpdate = () => {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
            rafId = window.requestAnimationFrame(() => {
                rafId = null;
                updateStickyHeaderLock();
            });
        };

        const bodyObserver = new MutationObserver(scheduleUpdate);
        bodyObserver.observe(body, {
            attributes: true,
            attributeFilter: ['data-scroll-locked', 'style'],
        });

        window.addEventListener('resize', scheduleUpdate);
        scheduleUpdate();

        return () => {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
            window.removeEventListener('resize', scheduleUpdate);
            bodyObserver.disconnect();
            resizeObserver?.disconnect();
            clearStickyHeaderLock();
        };
    }, []);


    // Page Blur Logic
    const [isPageBlurred, setIsPageBlurred] = useState(false);
    const isVisible = true;
    const currentProgramId = (
        matchPath('/programs/:programId', location.pathname)?.params.programId
        ?? matchPath('/programs/:programId/settings', location.pathname)?.params.programId
        ?? matchPath('/programs/:programId/semesters/create', location.pathname)?.params.programId
    );
    const currentSemesterId = matchPath('/semesters/:semesterId', location.pathname)?.params.semesterId;
    const currentCourseId = matchPath('/courses/:courseId', location.pathname)?.params.courseId;

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.isComposing) {
                return;
            }

            if (event.metaKey || event.ctrlKey || event.altKey) {
                return;
            }

            if (event.key !== '/') {
                return;
            }

            const target = event.target;
            if (
                target instanceof HTMLElement
                && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
            ) {
                return;
            }

            event.preventDefault();
            setIsCommandOpen((open) => !open);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const accountNavigationItems = useMemo<LayoutCommandItem[]>(() => [
        {
            id: 'nav-home',
            title: 'Go to Program Home',
            description: 'Open the active Program home route.',
            keywords: ['home', 'dashboard', 'program home'],
            icon: Home,
            onSelect: () => navigate('/'),
        },
        {
            id: 'nav-settings',
            title: 'Open Settings',
            description: 'Go to global profile, theme, and integration settings.',
            keywords: ['preferences', 'account'],
            icon: Settings,
            onSelect: () => navigate('/settings'),
        },
        {
            id: 'browse-programs',
            title: 'Browse Programs',
            description: 'Search every Program in this account.',
            keywords: ['program list account navigation'],
            icon: FolderKanban,
            childPage: {
                id: 'programs',
                title: 'Programs',
                searchPlaceholder: 'Search programs...',
                emptyMessage: 'No programs found.',
                loadItems: async () => {
                    const programs = await api.getPrograms();
                    return [...programs]
                        .sort((left, right) => left.name.localeCompare(right.name))
                        .map((program: Program) => ({
                            id: `program-${program.id}`,
                            title: program.name,
                            description: 'Open Program dashboard.',
                            keywords: ['program'],
                            icon: FolderKanban,
                            onSelect: () => navigate(`/programs/${program.id}`),
                        }));
                },
            },
            onSelect: () => undefined,
        },
        {
            id: 'browse-semesters',
            title: 'Browse Semesters',
            description: 'Search every active Semester in this account.',
            keywords: ['semester term account navigation'],
            icon: LayoutDashboard,
            childPage: {
                id: 'semesters',
                title: 'Semesters',
                searchPlaceholder: 'Search semesters...',
                emptyMessage: 'No semesters found.',
                loadItems: async () => {
                    const programs = await api.getPrograms();
                    const programDetails = await Promise.all(programs.map((program: Program) => api.getProgram(program.id)));

                    return programDetails
                        .flatMap((program: Program & { semesters: Semester[] }) => program.semesters
                            .filter((semester: Semester) => semester.lifecycle_state !== 'draft')
                            .map((semester: Semester) => ({
                                id: `semester-${semester.id}`,
                                title: semester.name,
                                description: `${program.name} / Semester workspace`,
                                keywords: [program.name, 'semester', 'term'],
                                icon: LayoutDashboard,
                                onSelect: () => navigate(`/semesters/${semester.id}`),
                            })))
                        .sort((left: LayoutCommandItem, right: LayoutCommandItem) => left.title.localeCompare(right.title));
                },
            },
            onSelect: () => undefined,
        },
        {
            id: 'browse-courses',
            title: 'Browse Courses',
            description: 'Search every Course in this account.',
            keywords: ['course class account navigation'],
            icon: BookOpen,
            childPage: {
                id: 'courses',
                title: 'Courses',
                searchPlaceholder: 'Search courses...',
                emptyMessage: 'No courses found.',
                loadItems: async () => {
                    const programs = await api.getPrograms();
                    const programPayloads = await Promise.all(programs.map(async (program: Program) => {
                        const [programDetail, unassignedCourses] = await Promise.all([
                            api.getProgram(program.id),
                            api.getCoursesForProgram(program.id, { unassigned: true }),
                        ]);

                        return { program, programDetail, unassignedCourses };
                    }));

                    return programPayloads
                        .flatMap(({ program, programDetail, unassignedCourses }: {
                            program: Program;
                            programDetail: Program & { semesters: Semester[] };
                            unassignedCourses: Course[];
                        }) => {
                            const assignedCourses = programDetail.semesters
                                .filter((semester: Semester) => semester.lifecycle_state !== 'draft')
                                .flatMap((semester: Semester) => (semester.courses ?? []).map((course: Course) => ({
                                    id: `course-${course.id}`,
                                    title: course.name,
                                    metaText: course.alias?.trim() || undefined,
                                    badges: course.category?.trim()
                                        ? [{
                                            label: course.category.trim(),
                                            variant: 'outline' as const,
                                            className: `h-5 shrink-0 border-0 px-1.5 text-[11px] font-medium ${getCourseCategoryBadgeClassName(course.category, course.id)}`,
                                            style: getCourseBadgeStyle(resolveCourseColor(course)),
                                        }]
                                        : undefined,
                                    description: `${program.name} / ${semester.name}`,
                                    keywords: [program.name, semester.name, course.name, course.alias ?? '', course.category ?? '', 'course', 'class'],
                                    icon: BookOpen,
                                    onSelect: () => navigate(`/courses/${course.id}`),
                                })));

                            const programLevelCourses = unassignedCourses.map((course: Course) => ({
                                id: `course-${course.id}`,
                                title: course.name,
                                metaText: course.alias?.trim() || undefined,
                                badges: course.category?.trim()
                                    ? [{
                                        label: course.category.trim(),
                                        variant: 'outline' as const,
                                        className: `h-5 shrink-0 border-0 px-1.5 text-[11px] font-medium ${getCourseCategoryBadgeClassName(course.category, course.id)}`,
                                        style: getCourseBadgeStyle(resolveCourseColor(course)),
                                    }]
                                    : undefined,
                                description: `${program.name} / Unassigned`,
                                keywords: [program.name, course.name, course.alias ?? '', course.category ?? '', 'unassigned', 'course', 'class'],
                                icon: BookOpen,
                                onSelect: () => navigate(`/courses/${course.id}`),
                            }));

                            return [...assignedCourses, ...programLevelCourses];
                        })
                        .sort((left: LayoutCommandItem, right: LayoutCommandItem) => left.title.localeCompare(right.title));
                },
            },
            onSelect: () => undefined,
        },
    ], [navigate]);

    const globalCommandGroups = useMemo<LayoutCommandGroup[]>(() => {
        const workspaceItems: LayoutCommandGroup['items'] = [];

        if (currentProgramId) {
            workspaceItems.push(
                {
                    id: `program-dashboard-${currentProgramId}`,
                    title: 'Open Program Dashboard',
                    description: 'Return to the current Program workspace.',
                    keywords: ['program', 'workspace'],
                    icon: LayoutDashboard,
                    onSelect: () => navigate(`/programs/${currentProgramId}`),
                },
                {
                    id: `program-settings-${currentProgramId}`,
                    title: 'Open Program Settings',
                    description: 'Go to the current Program settings page.',
                    keywords: ['program settings', 'configuration'],
                    icon: Settings,
                    onSelect: () => navigate(`/programs/${currentProgramId}/settings`),
                },
            );
        }

        if (currentSemesterId) {
            workspaceItems.push({
                id: `semester-home-${currentSemesterId}`,
                title: 'Open Semester Homepage',
                description: 'Return to the current Semester workspace.',
                keywords: ['semester', 'term', 'workspace'],
                icon: LayoutDashboard,
                onSelect: () => navigate(`/semesters/${currentSemesterId}`),
            });
        }

        if (currentCourseId) {
            workspaceItems.push({
                id: `course-home-${currentCourseId}`,
                title: 'Open Course Homepage',
                description: 'Return to the current Course workspace.',
                keywords: ['course', 'class', 'workspace'],
                icon: LayoutDashboard,
                onSelect: () => navigate(`/courses/${currentCourseId}`),
            });
        }

        return [
            {
                heading: 'Workspace',
                items: workspaceItems,
            },
            ...commandGroups,
            {
                heading: 'Navigation',
                items: accountNavigationItems,
            },
            {
                heading: 'Preferences',
                items: [
                    {
                        id: 'theme-light',
                        title: 'Set Theme to Light',
                        description: 'Switch the app to light mode.',
                        keywords: ['theme light appearance'],
                        icon: Sun,
                        onSelect: () => setTheme('light'),
                    },
                    {
                        id: 'theme-dark',
                        title: 'Set Theme to Dark',
                        description: 'Switch the app to dark mode.',
                        keywords: ['theme dark appearance'],
                        icon: Moon,
                        onSelect: () => setTheme('dark'),
                    },
                    {
                        id: 'theme-system',
                        title: 'Set Theme to System',
                        description: 'Follow the system appearance preference.',
                        keywords: ['theme system appearance auto'],
                        icon: Laptop,
                        onSelect: () => setTheme('system'),
                    },
                    {
                        id: 'toggle-page-blur',
                        title: isPageBlurred ? 'Disable Page Blur' : 'Enable Page Blur',
                        description: 'Quickly hide or reveal sensitive content in the page body.',
                        keywords: ['privacy blur focus'],
                        icon: isPageBlurred ? EyeOff : Eye,
                        onSelect: () => setIsPageBlurred((blurred) => !blurred),
                    },
                ],
            },
        ];
    }, [accountNavigationItems, commandGroups, currentCourseId, currentProgramId, currentSemesterId, isPageBlurred, navigate, setTheme]);

    return (
        <div className="flex min-h-screen flex-col">
            <header
                className={cn(
                    "fixed left-0 right-0 top-0 z-50 h-[60px] border-b bg-background/80 backdrop-blur-md transition-transform duration-300 ease-in-out",
                    isVisible ? 'translate-y-0' : '-translate-y-full'
                )}
            >
                <Container className="flex h-full items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-full shrink-0 items-center gap-3">
                            <Link to="/" className="inline-flex h-9 items-center text-lg font-bold leading-none text-foreground no-underline transition-opacity hover:opacity-80">
                                Semestra
                            </Link>
                            {user && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="h-9 min-w-0 max-w-[15rem] justify-between gap-2 px-3"
                                            disabled={isSwitchingProgram}
                                        >
                                            <span className="flex min-w-0 items-center gap-2">
                                                <FolderKanban data-icon="inline-start" />
                                                <span className="truncate">
                                                    {activeProgram?.name ?? (isProgramsLoading ? 'Loading programs...' : 'Select Program')}
                                                </span>
                                            </span>
                                            <ChevronDown className="shrink-0 text-muted-foreground" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="min-w-56">
                                        <DropdownMenuLabel>Workspace</DropdownMenuLabel>
                                        {programs.length > 0 ? (
                                            <DropdownMenuGroup>
                                                <DropdownMenuRadioGroup
                                                    value={user.active_program_id ?? ''}
                                                    onValueChange={(value) => {
                                                        void handleProgramSwitch(value);
                                                    }}
                                                >
                                                    {programs.map((program) => (
                                                        <DropdownMenuRadioItem key={program.id} value={program.id}>
                                                            <span className="truncate">{program.name}</span>
                                                        </DropdownMenuRadioItem>
                                                    ))}
                                                </DropdownMenuRadioGroup>
                                            </DropdownMenuGroup>
                                        ) : (
                                            <DropdownMenuGroup>
                                            <DropdownMenuItem
                                                className="whitespace-nowrap"
                                                onSelect={(event) => {
                                                    event.preventDefault();
                                                    navigate('/programs');
                                                }}
                                            >
                                                <FolderKanban data-icon="inline-start" />
                                                Open Programs
                                            </DropdownMenuItem>
                                            </DropdownMenuGroup>
                                        )}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuGroup>
                                            <DropdownMenuItem
                                                className="whitespace-nowrap"
                                                onSelect={(event) => {
                                                    event.preventDefault();
                                                    navigate('/programs');
                                                }}
                                            >
                                                <Settings data-icon="inline-start" />
                                                Manage Programs
                                            </DropdownMenuItem>
                                        </DropdownMenuGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                            {breadcrumb && (
                                <Separator
                                    orientation="vertical"
                                    className="hidden h-5 self-center bg-foreground/30 data-[orientation=vertical]:w-[2px] data-[orientation=vertical]:!self-center md:block"
                                />
                            )}
                        </div>
                        {breadcrumb && (
                            <div className="hidden min-w-0 md:block">{breadcrumb}</div>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="hidden min-w-28 justify-between text-muted-foreground transition-colors hover:text-foreground lg:flex"
                            onClick={() => setIsCommandOpen(true)}
                        >
                            <Search data-icon="inline-start" />
                            <Kbd>/</Kbd>
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsCommandOpen(true)} title="Open command palette (/)">
                            <Search />
                            <span className="sr-only">Open command palette</span>
                        </Button>
                        {hasFailedSync && (
                            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1">
                                <AlertCircle className="h-4 w-4 text-destructive" />
                                <span className="hidden text-xs font-medium text-destructive sm:inline">
                                    Sync error ({pendingSyncRetryCount})
                                </span>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={handleManualSyncRetry}
                                    disabled={isRetryingSync}
                                >
                                    {isRetryingSync ? (
                                        <Spinner className="size-3" />
                                    ) : (
                                        'Retry'
                                    )}
                                </Button>
                            </div>
                        )}
                        <ThemeToggle />

                                <Button
                                    variant="ghost"
                                    size="icon"
                            onClick={() => setIsPageBlurred(!isPageBlurred)}
                            title={isPageBlurred ? "Unblur page" : "Blur page"}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            {isPageBlurred ? (
                                <EyeOff className="h-5 w-5" />
                            ) : (
                                <Eye className="h-5 w-5" />
                            )}
                        </Button>

                        {user && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                                        <Avatar className="h-9 w-9">
                                            {/* <AvatarImage src="/avatars/01.png" alt={user.nickname} /> */}
                                            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                                                {user.email.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56" align="end" forceMount>
                                    <DropdownMenuLabel className="font-normal">
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium leading-none">{user.nickname || 'User'}</p>
                                            <p className="text-xs leading-none text-muted-foreground">
                                                {user.email}
                                            </p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
                                        <Settings className="mr-2 h-4 w-4" />
                                        <span>Settings</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() => {
                                            void signOut();
                                        }}
                                        className="cursor-pointer text-destructive focus:text-destructive"
                                    >
                                        <LogOut className="mr-2 h-4 w-4" />
                                        <span>Sign out</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </Container>
            </header>
            <main
                className={cn(
                    "flex-1 pt-[60px] transition-[filter] duration-300 ease-out",
                    isPageBlurred && "blur-sm"
                )}
            >
                {children}
            </main>
            <GlobalCommandPalette
                open={isCommandOpen}
                onOpenChange={setIsCommandOpen}
                groups={globalCommandGroups}
            />
        </div>
    );
};
