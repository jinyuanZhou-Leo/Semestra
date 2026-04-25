// input:  [course homepage tab-selection helper and Vitest assertions]
// output: [route-local regression coverage for sibling-course/requested-tab restoration decisions]
// pos:    [Unit test file for Course Homepage tab restoration across course navigation, including pending preferred-tab runtime loading]
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

    it('waits for a requested tab while the destination course detail is still refreshing', () => {
        expect(resolveRequestedCourseTabId({
            activeTabId: '',
            requestedTabType: 'builtin-gradebook',
            visibleTabs: [
                { id: 'course:4:dashboard', type: 'builtin-dashboard' },
                { id: 'course:4:settings', type: 'builtin-setting' },
            ],
            areBuiltinTabsReady: true,
            isRequestedTabPending: true,
        })).toBeNull();
    });

    it('selects the requested tab once the destination course runtime tabs arrive', () => {
        expect(resolveRequestedCourseTabId({
            activeTabId: '',
            requestedTabType: 'builtin-gradebook',
            visibleTabs: [
                { id: 'course:4:dashboard', type: 'builtin-dashboard' },
                { id: 'course:4:builtin-gradebook', type: 'builtin-gradebook' },
                { id: 'course:4:settings', type: 'builtin-setting' },
            ],
            areBuiltinTabsReady: true,
            isRequestedTabPending: false,
        })).toBe('course:4:builtin-gradebook');
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
