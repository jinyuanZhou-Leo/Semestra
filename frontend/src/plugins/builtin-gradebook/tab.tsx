// input:  [course and semester gradebook tab runtimes, plugin tab definition contract]
// output: [builtin-gradebook tab entry plus TabDefinition export]
// pos:    [Gradebook plugin tab entry that routes course vs semester contexts to dedicated tab components]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from 'react';

import { AppEmptyState } from '@/components/AppEmptyState';
import type { TabDefinition, TabProps } from '@/plugin-system';

import { CourseGradebookTab } from './CourseGradebookTab';
import { SemesterGradebookTab } from './SemesterGradebookTab';
import { BUILTIN_GRADEBOOK_TAB_TYPE } from './shared';

const BuiltinGradebookTab: React.FC<TabProps> = (props) => {
    if (props.courseId) {
        return <CourseGradebookTab {...props} />;
    }
    if (props.semesterId) {
        return <SemesterGradebookTab {...props} />;
    }
    return (
        <AppEmptyState
            scenario="unavailable"
            size="section"
            title="Gradebook unavailable"
            description="This tab requires a course or semester context."
        />
    );
};

export const BuiltinGradebookTabDefinition: TabDefinition = {
    type: BUILTIN_GRADEBOOK_TAB_TYPE,
    component: BuiltinGradebookTab,
};
