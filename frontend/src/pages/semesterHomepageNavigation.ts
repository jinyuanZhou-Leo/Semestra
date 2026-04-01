// input:  [current Semester Homepage active tab id, last known active tab type, visible tab list, and builtin-tab readiness]
// output: [`resolveSemesterActiveTabId()` helper for Semester Homepage tab restoration]
// pos:    [Route-local tab-selection helper that preserves the current semester tab type across reorder-driven tab-id changes before falling back to the first visible tab]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

interface SemesterHomepageVisibleTab {
    id: string;
    type: string;
}

interface ResolveSemesterActiveTabIdOptions {
    activeTabId: string;
    lastActiveTabType: string | null;
    visibleTabs: SemesterHomepageVisibleTab[];
    areBuiltinTabsReady: boolean;
}

export const resolveSemesterActiveTabId = ({
    activeTabId,
    lastActiveTabType,
    visibleTabs,
    areBuiltinTabsReady,
}: ResolveSemesterActiveTabIdOptions): string | null => {
    if (visibleTabs.length === 0) {
        return '';
    }

    if (!activeTabId && !areBuiltinTabsReady) {
        return null;
    }

    if (activeTabId && visibleTabs.some((tab) => tab.id === activeTabId)) {
        return activeTabId;
    }

    if (lastActiveTabType) {
        const matchingTab = visibleTabs.find((tab) => tab.type === lastActiveTabType);
        if (matchingTab) {
            return matchingTab.id;
        }
    }

    return visibleTabs[0]?.id ?? '';
};
