// input:  [current Course Homepage active tab id, visible tab list, route-state preferred tab type, and builtin-tab readiness]
// output: [`resolveRequestedCourseTabId()` helper for Course Homepage tab restoration]
// pos:    [Route-local tab-selection helper that preserves the current tab type across sibling-course navigation when the target course exposes the same tab]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

interface CourseHomepageVisibleTab {
    id: string;
    type: string;
}

interface ResolveRequestedCourseTabIdOptions {
    activeTabId: string;
    requestedTabType: string | null;
    visibleTabs: CourseHomepageVisibleTab[];
    areBuiltinTabsReady: boolean;
}

export const resolveRequestedCourseTabId = ({
    activeTabId,
    requestedTabType,
    visibleTabs,
    areBuiltinTabsReady,
}: ResolveRequestedCourseTabIdOptions): string | null => {
    if (visibleTabs.length === 0) {
        return '';
    }

    if (!activeTabId && !areBuiltinTabsReady) {
        return null;
    }

    if (activeTabId && visibleTabs.some((tab) => tab.id === activeTabId)) {
        return activeTabId;
    }

    if (requestedTabType) {
        const requestedTab = visibleTabs.find((tab) => tab.type === requestedTabType);
        if (requestedTab) {
            return requestedTab.id;
        }
    }

    return visibleTabs[0]?.id ?? '';
};
