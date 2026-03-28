// input:  [homepage shell-plugin tab requirements for semester/course workspaces]
// output: [homepage shell tab IDs, config interface, and semester/course config objects]
// pos:    [central ordering and placement rules for plugin-derived homepage shell tabs]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

export const HOMEPAGE_DASHBOARD_TAB_TYPE = 'builtin-dashboard';
export const HOMEPAGE_SETTINGS_TAB_TYPE = 'builtin-setting';

export interface HomepageBuiltinTabConfig {
    builtinTabTypes: readonly string[];
    leadingBuiltinTabTypes?: readonly string[];
    trailingBuiltinTabTypes?: readonly string[];
}

const HOMEPAGE_SHELL_TAB_IDS = [
    HOMEPAGE_DASHBOARD_TAB_TYPE,
    HOMEPAGE_SETTINGS_TAB_TYPE,
] as const;

export const SEMESTER_HOMEPAGE_BUILTIN_TAB_CONFIG: HomepageBuiltinTabConfig = {
    builtinTabTypes: HOMEPAGE_SHELL_TAB_IDS,
    leadingBuiltinTabTypes: [HOMEPAGE_DASHBOARD_TAB_TYPE],
    trailingBuiltinTabTypes: [HOMEPAGE_SETTINGS_TAB_TYPE],
};

export const COURSE_HOMEPAGE_BUILTIN_TAB_CONFIG: HomepageBuiltinTabConfig = {
    builtinTabTypes: HOMEPAGE_SHELL_TAB_IDS,
    leadingBuiltinTabTypes: [HOMEPAGE_DASHBOARD_TAB_TYPE],
    trailingBuiltinTabTypes: [HOMEPAGE_SETTINGS_TAB_TYPE],
};
