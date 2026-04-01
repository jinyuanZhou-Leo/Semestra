// input:  [course homepage tab-selection helper and Vitest assertions]
// output: [route-local regression coverage for sibling-course tab restoration decisions]
// pos:    [Unit test file for Course Homepage same-tab restoration across sibling-course navigation]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it } from 'vitest';
import { resolveRequestedCourseTabId } from './courseHomepageNavigation';

describe('resolveRequestedCourseTabId', () => {
    it('keeps the current tab when it is still visible', () => {
        expect(resolveRequestedCourseTabId({
            activeTabId: 'course:2:todo',
            requestedTabType: 'builtin-todo',
            visibleTabs: [
                { id: 'course:2:dashboard', type: 'builtin-dashboard' },
                { id: 'course:2:todo', type: 'builtin-todo' },
            ],
            areBuiltinTabsReady: true,
        })).toBe('course:2:todo');
    });

    it('restores the requested tab type after switching courses', () => {
        expect(resolveRequestedCourseTabId({
            activeTabId: '',
            requestedTabType: 'builtin-todo',
            visibleTabs: [
                { id: 'course:3:dashboard', type: 'builtin-dashboard' },
                { id: 'course:3:todo', type: 'builtin-todo' },
                { id: 'course:3:settings', type: 'builtin-setting' },
            ],
            areBuiltinTabsReady: true,
        })).toBe('course:3:todo');
    });

    it('falls back to the first tab when the requested type is unavailable', () => {
        expect(resolveRequestedCourseTabId({
            activeTabId: '',
            requestedTabType: 'builtin-gradebook',
            visibleTabs: [
                { id: 'course:4:dashboard', type: 'builtin-dashboard' },
                { id: 'course:4:todo', type: 'builtin-todo' },
            ],
            areBuiltinTabsReady: true,
        })).toBe('course:4:dashboard');
    });

    it('waits for builtin tabs before selecting a fallback tab', () => {
        expect(resolveRequestedCourseTabId({
            activeTabId: '',
            requestedTabType: 'builtin-todo',
            visibleTabs: [
                { id: 'course:5:dashboard', type: 'builtin-dashboard' },
            ],
            areBuiltinTabsReady: false,
        })).toBeNull();
    });
});
