// input:  [Vitest assertions and course-resources shared helper exports]
// output: [test suite validating widget setting normalization plus resource-formatting and link-resolution helpers]
// pos:    [plugin-level regression tests for course-resources shared logic]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it } from 'vitest';

import {
    formatBytes,
    getResourceExtensionLabel,
    resizeWidgetSlots,
    resolveCourseResourceHref,
    resolveCourseResourcesWidgetSettings,
} from './shared';

describe('course-resources shared helpers', () => {
    it('pads widget settings to the selected slot count', () => {
        expect(resolveCourseResourcesWidgetSettings({ slotCount: 4, resourceIds: ['a', 'b'] })).toEqual({
            slotCount: 4,
            resourceIds: ['a', 'b', '', ''],
        });
    });

    it('trims resource ids when the slot count shrinks', () => {
        const resolved = resolveCourseResourcesWidgetSettings({ slotCount: 4, resourceIds: ['a', 'b', 'c', 'd'] });
        expect(resizeWidgetSlots(resolved, 1)).toEqual({
            slotCount: 1,
            resourceIds: ['a'],
        });
    });

    it('formats byte labels using compact units', () => {
        expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    });

    it('derives extension labels from the display name first', () => {
        expect(getResourceExtensionLabel({
            filename_display: 'Lecture 1.PDF',
            filename_original: 'fallback.txt',
        })).toBe('PDF');
    });

    it('returns the saved external url for link resources', () => {
        expect(resolveCourseResourceHref('course-1', {
            id: 'resource-1',
            resource_kind: 'link',
            external_url: 'https://example.com/resource',
        })).toBe('https://example.com/resource');
    });
});
