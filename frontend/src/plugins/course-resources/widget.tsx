// input:  [course resource API/query state, widget instance settings, course widget context ids, and shared UI primitives]
// output: [`CourseResourcesQuickOpenWidgetDefinition`, widget renderer, and widget settings component]
// pos:    [course-scoped quick-open widget that renders one, two, or four pinned resource cards with course-aware settings]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Link2 } from 'lucide-react';

import { AppEmptyState } from '@/components/AppEmptyState';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import { queryKeys } from '@/services/queryKeys';
import type { WidgetDefinition, WidgetProps, WidgetSettingsProps } from '@/services/widgetRegistry';

import {
    COURSE_RESOURCES_SLOT_COUNTS,
    COURSE_RESOURCES_WIDGET_TYPE,
    formatBytes,
    getResourceExtensionLabel,
    resizeWidgetSlots,
    resolveCourseResourceHref,
    resolveCourseResourcesWidgetSettings,
    type CourseResourcesSlotCount,
} from './shared';

const resolveGridClassName = (slotCount: CourseResourcesSlotCount) => {
    if (slotCount === 1) return 'grid-cols-1';
    if (slotCount === 2) return 'grid-cols-1 min-[360px]:grid-cols-2';
    return 'grid-cols-2';
};

const ResourceCard: React.FC<{
    title: string;
    meta: string;
    href?: string;
    unavailable?: boolean;
}> = ({ title, meta, href, unavailable = false }) => {
    const content = (
        <div className={cn(
            'flex h-full min-h-0 flex-col justify-between rounded-[24px] bg-muted/40 p-3 text-left transition-colors',
            href && 'hover:bg-muted/65',
            unavailable && 'bg-muted/25 text-muted-foreground',
        )}>
            <div className="space-y-2">
                <div className="text-[10px] font-medium text-muted-foreground">
                    {meta}
                </div>
                <div className="flex items-start gap-1.5">
                    <p className="line-clamp-3 text-sm font-semibold leading-5 text-foreground">
                        {title}
                    </p>
                    {meta.includes('Saved link') ? <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
                </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{href ? 'Open file' : 'Empty slot'}</span>
                {href ? <ExternalLink className="h-3.5 w-3.5" /> : null}
            </div>
        </div>
    );

    if (!href) return content;

    return (
        <a href={href} target="_blank" rel="noreferrer" className="block h-full min-h-0">
            {content}
        </a>
    );
};

const CourseResourcesQuickOpenWidget: React.FC<WidgetProps> = ({ courseId, settings }) => {
    const resolved = resolveCourseResourcesWidgetSettings(settings);
    const resourcesQuery = useQuery({
        queryKey: courseId ? queryKeys.courses.resources(courseId) : ['courses', 'resources', 'disabled'],
        queryFn: () => api.getCourseResources(courseId!),
        enabled: Boolean(courseId),
        staleTime: 30_000,
    });

    if (!courseId) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="widget"
                title="Resources unavailable"
                description="This widget requires a course context."
            />
        );
    }

    if (resourcesQuery.isLoading) {
        return (
            <div className={cn('grid h-full min-h-0 gap-2.5 p-2.5', resolveGridClassName(resolved.slotCount))}>
                {resolved.resourceIds.map((_, index) => (
                    <Skeleton key={index} className="h-full min-h-[84px] rounded-[24px]" />
                ))}
            </div>
        );
    }

    if (resourcesQuery.error || !resourcesQuery.data) {
        return (
            <AppEmptyState
                scenario="unavailable"
                size="widget"
                title="Resources unavailable"
                description="Failed to load pinned file options."
            />
        );
    }

    const resourceMap = new Map(resourcesQuery.data.files.map((resource) => [resource.id, resource]));

    return (
        <div className={cn('grid h-full min-h-0 gap-2.5 p-2.5', resolveGridClassName(resolved.slotCount))}>
            {resolved.resourceIds.map((resourceId, index) => {
                const resource = resourceMap.get(resourceId);
                if (!resourceId) {
                    return (
                        <ResourceCard
                            key={`empty-${index}`}
                            title="Choose a file in widget settings"
                            meta={`Slot ${index + 1}`}
                        />
                    );
                }
                if (!resource) {
                    return (
                        <ResourceCard
                            key={`missing-${index}`}
                            title="This file is no longer available"
                            meta={`Slot ${index + 1}`}
                            unavailable
                        />
                    );
                }
                return (
                    <ResourceCard
                        key={resource.id}
                        title={resource.filename_display}
                        meta={resource.resource_kind === 'link'
                            ? 'Saved link'
                            : `${getResourceExtensionLabel(resource)} · ${formatBytes(resource.size_bytes)}`}
                        href={resolveCourseResourceHref(courseId, resource)}
                    />
                );
            })}
        </div>
    );
};

const CourseResourcesWidgetSettingsComponent: React.FC<WidgetSettingsProps> = ({
    settings,
    onSettingsChange,
    courseId,
}) => {
    const resolved = resolveCourseResourcesWidgetSettings(settings);
    const resourcesQuery = useQuery({
        queryKey: courseId ? queryKeys.courses.resources(courseId) : ['courses', 'resources', 'disabled'],
        queryFn: () => api.getCourseResources(courseId!),
        enabled: Boolean(courseId),
        staleTime: 30_000,
    });

    if (!courseId) {
        return (
            <p className="text-sm text-muted-foreground">
                Resource shortcuts are only available in a course context.
            </p>
        );
    }

    const resourceOptions = resourcesQuery.data?.files ?? [];
    const selectedSet = new Set(resourceOptions.map((resource) => resource.id));

    return (
        <div className="grid gap-4">
            <div className="grid gap-2">
                <Label htmlFor="course-resources-slot-count">Quick-open cards</Label>
                <Select
                    value={String(resolved.slotCount)}
                    onValueChange={(value) => {
                        const nextCount = Number(value) as CourseResourcesSlotCount;
                        onSettingsChange(resizeWidgetSlots(resolved, nextCount));
                    }}
                >
                    <SelectTrigger id="course-resources-slot-count" className="w-full">
                        <SelectValue placeholder="Select card count" />
                    </SelectTrigger>
                    <SelectContent>
                        {COURSE_RESOURCES_SLOT_COUNTS.map((slotCount) => (
                            <SelectItem key={slotCount} value={String(slotCount)}>
                                {slotCount} card{slotCount === 1 ? '' : 's'}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {resourcesQuery.isLoading ? (
                <div className="space-y-2">
                    {[0, 1].map((index) => (
                        <Skeleton key={index} className="h-10 rounded-md" />
                    ))}
                </div>
            ) : (
                <div className="grid gap-3">
                    {resolved.resourceIds.map((resourceId, index) => (
                        <div key={index} className="grid gap-2">
                            <Label htmlFor={`course-resource-slot-${index}`}>Slot {index + 1}</Label>
                            <Select
                                value={resourceId || '__empty__'}
                                onValueChange={(value) => {
                                    const nextIds = [...resolved.resourceIds];
                                    nextIds[index] = value === '__empty__' ? '' : value;
                                    onSettingsChange({ ...resolved, resourceIds: nextIds });
                                }}
                            >
                                <SelectTrigger id={`course-resource-slot-${index}`} className="w-full">
                                    <SelectValue placeholder="Select a file" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__empty__">No file selected</SelectItem>
                                    {resourceOptions.map((resource) => (
                                        <SelectItem key={resource.id} value={resource.id}>
                                            {resource.filename_display}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {resourceId && !selectedSet.has(resourceId) ? (
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                    This file was removed. Pick another file to keep the slot active.
                                </p>
                            ) : null}
                        </div>
                    ))}
                    {resourceOptions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Upload files in the Course Resources tab before assigning quick-open shortcuts.
                        </p>
                    ) : null}
                </div>
            )}
        </div>
    );
};

export const CourseResourcesQuickOpenWidgetDefinition: WidgetDefinition = {
    type: COURSE_RESOURCES_WIDGET_TYPE,
    component: CourseResourcesQuickOpenWidget,
    SettingsComponent: CourseResourcesWidgetSettingsComponent,
    defaultSettings: {
        slotCount: 2,
        resourceIds: ['', ''],
    },
};
