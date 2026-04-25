// input:  [current Course Homepage active tab id, visible tab list, route-state preferred tab type, pending preferred-tab readiness, and builtin-tab readiness]
// output: [`resolveRequestedCourseTabId()` helper for Course Homepage tab restoration]
// pos:    [Route-local tab-selection helper that preserves requested/current tab types across course navigation without settling on fallback tabs before route-target runtime tabs finish loading]
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
    isRequestedTabPending?: boolean;
}

export const resolveRequestedCourseTabId = ({
    activeTabId,
    requestedTabType,
    visibleTabs,
    areBuiltinTabsReady,
    isRequestedTabPending = false,
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
        if (isRequestedTabPending) {
            return null;
        }
    }

    return visibleTabs[0]?.id ?? '';
};
