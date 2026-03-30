// input:  [homepage shell-plugin tab requirements for semester/course workspaces]
// output: [homepage shell tab IDs, host-reserved plugin IDs, config interface, and semester/course config objects]
// pos:    [central ordering and placement rules for host-reserved homepage shell tabs]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

export const HOMEPAGE_DASHBOARD_TAB_TYPE = 'builtin-dashboard';
export const HOMEPAGE_SETTINGS_TAB_TYPE = 'builtin-setting';
export const HOST_RESERVED_TAB_TYPES = [
    HOMEPAGE_DASHBOARD_TAB_TYPE,
    HOMEPAGE_SETTINGS_TAB_TYPE,
] as const;
export const HOST_RESERVED_PLUGIN_IDS = [
    'builtin-dashboard',
    'builtin-setting',
] as const;

export interface HomepageBuiltinTabConfig {
    builtinTabTypes: readonly string[];
    leadingBuiltinTabTypes?: readonly string[];
    trailingBuiltinTabTypes?: readonly string[];
}

export const isHostReservedTabType = (type: string): boolean => HOST_RESERVED_TAB_TYPES.includes(type as typeof HOST_RESERVED_TAB_TYPES[number]);
export const isHostReservedPluginId = (pluginId: string): boolean => HOST_RESERVED_PLUGIN_IDS.includes(pluginId as typeof HOST_RESERVED_PLUGIN_IDS[number]);

const HOMEPAGE_SHELL_TAB_IDS = HOST_RESERVED_TAB_TYPES;

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
