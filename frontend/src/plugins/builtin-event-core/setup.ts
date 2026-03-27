// input:  [plugin setup DSL helpers]
// output: [default-exported builtin-event-core setup definition]
// pos:    [host-rendered setup declaration for Academic Events semester onboarding]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { definePluginSetup, section, selectField } from "@/plugin-system/setup";

export default definePluginSetup({
    fields: {
        calendarDefaultView: selectField({
            label: "Default view",
            persist: "both",
            required: true,
            defaultValue: "month",
            description: "Choose the starting calendar behavior for this Semester.",
            options: [
                { label: "Month", value: "month" },
                { label: "Week", value: "week" },
            ],
            summaryLabels: {
                month: "Month",
                week: "Week",
            },
        }),
    },
    sections: [
        section("calendar-setup", {
            title: "Calendar Setup",
            description: "Choose the starting calendar behavior for this Semester.",
            fieldKeys: ["calendarDefaultView"],
        }),
    ],
});
