import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAppStatus } from '../hooks/useAppStatus';
import { Container } from './Container';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Eye, EyeOff, LogOut, Settings, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './ThemeToggle';

interface LayoutProps {
    children: React.ReactNode;
    breadcrumb?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children, breadcrumb }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { status, clearStatus } = useAppStatus();
    const isSyncStatus = status?.type === 'error' && /sync/i.test(status.message);
    const isSyncRetrying = Boolean(isSyncStatus && /retrying/i.test(status?.message ?? ''));
    const lastToastIdRef = useRef<number | null>(null);

    useEffect(() => {
        if (!status || !isSyncStatus) return;
        if (lastToastIdRef.current === status.id) return;
        lastToastIdRef.current = status.id;
        if (isSyncRetrying) {
            toast.message(status.message, {
                icon: <Spinner className="size-3 text-destructive" />,
                duration: 4000,
            });
        } else {
            toast.error(status.message, {
                duration: Infinity,
                onDismiss: clearStatus,
                icon: <AlertCircle className="h-4 w-4" />,
                action: {
                    label: "Dismiss",
                    onClick: clearStatus,
                },
            });
        }
    }, [clearStatus, isSyncRetrying, isSyncStatus, status]);

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
            attachHeaderObserver(header);

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

        const pageObserver = new MutationObserver(scheduleUpdate);
        pageObserver.observe(body, {
            childList: true,
            subtree: true,
        });

        window.addEventListener('resize', scheduleUpdate);
        window.addEventListener('scroll', scheduleUpdate, { passive: true });
        scheduleUpdate();

        return () => {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
            window.removeEventListener('resize', scheduleUpdate);
            window.removeEventListener('scroll', scheduleUpdate);
            bodyObserver.disconnect();
            pageObserver.disconnect();
            resizeObserver?.disconnect();
            clearStickyHeaderLock();
        };
    }, []);


    // Page Blur Logic
    const [isPageBlurred, setIsPageBlurred] = useState(false);
    const isVisible = true;

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
                        <Link to="/" className="text-lg font-bold text-foreground no-underline hover:opacity-80 transition-opacity">
                            Semestra
                        </Link>
                        {breadcrumb && (
                            <div className="hidden min-w-0 items-center gap-3 md:flex">
                                <div className="h-4 w-px bg-border/60" />
                                <div className="min-w-0">{breadcrumb}</div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
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
                                            localStorage.removeItem('token');
                                            window.location.href = '/login';
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
        </div>
    );
};
