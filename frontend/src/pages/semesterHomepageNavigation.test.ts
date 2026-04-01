// input:  [semester homepage tab-selection helper and Vitest assertions]
// output: [route-local regression coverage for semester tab restoration decisions]
// pos:    [Unit test file for Semester Homepage active-tab preservation across reorder-driven tab-id changes]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it } from 'vitest';
import { resolveSemesterActiveTabId } from './semesterHomepageNavigation';

describe('resolveSemesterActiveTabId', () => {
    it('keeps the current tab when it is still visible', () => {
        expect(resolveSemesterActiveTabId({
            activeTabId: 'semester:2:todo',
            lastActiveTabType: 'builtin-todo',
            visibleTabs: [
                { id: 'semester:2:dashboard', type: 'builtin-dashboard' },
                { id: 'semester:2:todo', type: 'builtin-todo' },
            ],
            areBuiltinTabsReady: true,
        })).toBe('semester:2:todo');
    });

    it('restores the last active tab type when reorder changes the tab id', () => {
        expect(resolveSemesterActiveTabId({
            activeTabId: 'stale-tab-id',
            lastActiveTabType: 'builtin-todo',
            visibleTabs: [
                { id: 'semester:3:dashboard', type: 'builtin-dashboard' },
                { id: 'semester:3:todo', type: 'builtin-todo' },
                { id: 'semester:3:settings', type: 'builtin-setting' },
            ],
            areBuiltinTabsReady: true,
        })).toBe('semester:3:todo');
    });

    it('falls back to the first tab when the last active type is unavailable', () => {
        expect(resolveSemesterActiveTabId({
            activeTabId: 'stale-tab-id',
            lastActiveTabType: 'builtin-gradebook',
            visibleTabs: [
                { id: 'semester:4:dashboard', type: 'builtin-dashboard' },
                { id: 'semester:4:todo', type: 'builtin-todo' },
            ],
            areBuiltinTabsReady: true,
        })).toBe('semester:4:dashboard');
    });

    it('waits for builtin tabs before selecting a fallback tab', () => {
        expect(resolveSemesterActiveTabId({
            activeTabId: '',
            lastActiveTabType: 'builtin-todo',
            visibleTabs: [
                { id: 'semester:5:dashboard', type: 'builtin-dashboard' },
            ],
            areBuiltinTabsReady: false,
        })).toBeNull();
    });
});
