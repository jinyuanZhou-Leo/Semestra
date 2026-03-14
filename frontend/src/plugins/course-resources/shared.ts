// input:  [course-resource API records and widget instance settings payloads]
// output: [course-resources plugin constants, settings normalizers, and presentation helpers]
// pos:    [Shared helper layer for course-resources tab and widget runtime modules]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { CourseResourceFile } from '@/services/api';

export const COURSE_RESOURCES_PLUGIN_ID = 'course-resources';
export const COURSE_RESOURCES_TAB_TYPE = 'course-resources-tab';
export const COURSE_RESOURCES_WIDGET_TYPE = 'course-resources-quick-open';
export const COURSE_RESOURCES_SLOT_COUNTS = [1, 2, 4] as const;

export type CourseResourcesSlotCount = (typeof COURSE_RESOURCES_SLOT_COUNTS)[number];

export interface CourseResourcesWidgetSettings {
    slotCount: CourseResourcesSlotCount;
    resourceIds: string[];
}

const DEFAULT_SLOT_COUNT: CourseResourcesSlotCount = 2;

export const resolveCourseResourcesWidgetSettings = (
    settings: unknown,
): CourseResourcesWidgetSettings => {
    const candidate = (settings && typeof settings === 'object') ? settings as Partial<CourseResourcesWidgetSettings> : {};
    const slotCount = COURSE_RESOURCES_SLOT_COUNTS.includes(candidate.slotCount as CourseResourcesSlotCount)
        ? candidate.slotCount as CourseResourcesSlotCount
        : DEFAULT_SLOT_COUNT;
    const resourceIds = Array.isArray(candidate.resourceIds)
        ? candidate.resourceIds.map((value) => (typeof value === 'string' ? value : ''))
        : [];
    const padded = Array.from({ length: slotCount }, (_, index) => resourceIds[index] ?? '');
    return {
        slotCount,
        resourceIds: padded,
    };
};

export const resizeWidgetSlots = (
    settings: CourseResourcesWidgetSettings,
    slotCount: CourseResourcesSlotCount,
): CourseResourcesWidgetSettings => {
    return {
        slotCount,
        resourceIds: Array.from({ length: slotCount }, (_, index) => settings.resourceIds[index] ?? ''),
    };
};

export const getResourceExtensionLabel = (resource: Pick<CourseResourceFile, 'filename_display' | 'filename_original'>) => {
    const sourceName = resource.filename_display || resource.filename_original;
    const lastDot = sourceName.lastIndexOf('.');
    if (lastDot <= 0 || lastDot === sourceName.length - 1) return 'FILE';
    return sourceName.slice(lastDot + 1).toUpperCase();
};

export const resolveCourseResourceHref = (courseId: string, resource: Pick<CourseResourceFile, 'id' | 'resource_kind' | 'external_url'>) => {
    if (resource.resource_kind === 'link' && resource.external_url) {
        return resource.external_url;
    }
    return `/api/courses/${courseId}/resources/${resource.id}/download`;
};

export const formatBytes = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let nextValue = value;
    let unitIndex = 0;
    while (nextValue >= 1024 && unitIndex < units.length - 1) {
        nextValue /= 1024;
        unitIndex += 1;
    }
    const digits = nextValue >= 10 || unitIndex === 0 ? 0 : 1;
    return `${nextValue.toFixed(digits)} ${units[unitIndex]}`;
};

export const formatTimestamp = (value: string) => {
    if (!value) return 'Unknown time';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Unknown time';
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(parsed);
};
