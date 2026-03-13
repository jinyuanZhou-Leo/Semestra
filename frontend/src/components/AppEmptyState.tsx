// input:  [business empty-state semantics, shadcn empty primitives, lucide icons, and optional action nodes]
// output: [`AppEmptyState` business-layer empty-state wrapper and related scenario/size types]
// pos:    [Shared application empty-state composer that standardizes scenario-driven empty states without modifying shadcn ui primitives]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { ReactNode } from 'react';
import { AlertTriangle, FileSearch, FolderPlus, SearchX, type LucideIcon } from 'lucide-react';

import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty';
import { cn } from '@/lib/utils';

export type AppEmptyStateScenario = 'create' | 'no-results' | 'not-found' | 'unavailable';
export type AppEmptyStateSize = 'page' | 'section' | 'widget' | 'modal';
export type AppEmptyStateSurface = 'default' | 'inherit';

interface AppEmptyStateProps {
    scenario: AppEmptyStateScenario;
    size?: AppEmptyStateSize;
    surface?: AppEmptyStateSurface;
    title: ReactNode;
    description: ReactNode;
    primaryAction?: ReactNode;
    secondaryAction?: ReactNode;
    media?: ReactNode;
    className?: string;
}

const scenarioIconMap: Record<AppEmptyStateScenario, LucideIcon> = {
    create: FolderPlus,
    'no-results': SearchX,
    'not-found': FileSearch,
    unavailable: AlertTriangle,
};

const scenarioMediaClassMap: Record<AppEmptyStateScenario, string> = {
    create: 'bg-primary/10 text-primary',
    'no-results': 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    'not-found': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    unavailable: 'bg-muted text-muted-foreground',
};

const sizeClassMap: Record<AppEmptyStateSize, string> = {
    page: 'my-16 min-h-[320px] px-6 py-12 sm:px-10',
    section: 'min-h-[220px] px-6 py-10 sm:px-8',
    widget: 'h-full min-h-0 px-4 py-6',
    modal: 'min-h-[220px] px-5 py-9',
};

const surfaceClassMap: Record<AppEmptyStateSize, string> = {
    page: 'border-border/60 bg-gradient-to-b from-muted/20 to-transparent',
    section: 'border-border/70 bg-muted/40',
    widget: 'border-border/70 bg-muted/30',
    modal: 'border-border/70 bg-muted/35',
};

const inheritSurfaceClassMap: Record<AppEmptyStateSize, string> = {
    page: 'border-0 bg-transparent',
    section: 'border-0 bg-transparent',
    widget: 'border-0 bg-transparent',
    modal: 'border-0 bg-transparent',
};

const titleClassMap: Record<AppEmptyStateSize, string> = {
    page: 'text-xl',
    section: 'text-lg',
    widget: 'text-base',
    modal: 'text-lg',
};

const descriptionClassMap: Record<AppEmptyStateSize, string> = {
    page: 'max-w-md text-sm/6',
    section: 'max-w-md text-sm/6',
    widget: 'max-w-[18rem] text-sm/5',
    modal: 'max-w-sm text-sm/6',
};

const mediaClassMap: Record<AppEmptyStateSize, string> = {
    page: 'size-14 rounded-2xl [&_svg:not([class*=size-])]:size-7',
    section: 'size-12 rounded-xl [&_svg:not([class*=size-])]:size-6',
    widget: 'size-11 rounded-xl [&_svg:not([class*=size-])]:size-5',
    modal: 'size-12 rounded-xl [&_svg:not([class*=size-])]:size-6',
};

const contentClassMap: Record<AppEmptyStateSize, string> = {
    page: 'mt-2 max-w-md gap-2 sm:flex-row sm:justify-center [&>*]:w-full sm:[&>*]:w-auto',
    section: 'mt-2 max-w-md gap-2 sm:flex-row sm:justify-center [&>*]:w-full sm:[&>*]:w-auto',
    widget: 'mt-1 max-w-[18rem] gap-2 [&>*]:w-full',
    modal: 'mt-2 max-w-sm gap-2 sm:flex-row sm:justify-center [&>*]:w-full sm:[&>*]:w-auto',
};

export function AppEmptyState({
    scenario,
    size = 'section',
    surface = 'default',
    title,
    description,
    primaryAction,
    secondaryAction,
    media,
    className,
}: AppEmptyStateProps) {
    const Icon = scenarioIconMap[scenario];
    const hasActions = Boolean(primaryAction || secondaryAction);

    return (
        <Empty
            className={cn(
                'rounded-2xl text-balance',
                sizeClassMap[size],
                surface === 'default' ? surfaceClassMap[size] : inheritSurfaceClassMap[size],
                className,
            )}
        >
            <EmptyHeader className="max-w-md">
                <EmptyMedia
                    variant="icon"
                    className={cn(
                        mediaClassMap[size],
                        scenarioMediaClassMap[scenario],
                    )}
                >
                    {media ?? <Icon aria-hidden="true" />}
                </EmptyMedia>
                <EmptyTitle className={titleClassMap[size]}>{title}</EmptyTitle>
                <EmptyDescription className={descriptionClassMap[size]}>
                    {description}
                </EmptyDescription>
            </EmptyHeader>
            {hasActions ? (
                <EmptyContent className={contentClassMap[size]}>
                    {primaryAction}
                    {secondaryAction}
                </EmptyContent>
            ) : null}
        </Empty>
    );
}
