// input:  [numeric GPA percentage values rendered by the course-list plugin]
// output: [`formatCourseListGpaPercentage()` display helper]
// pos:    [plugin-local formatter that keeps course-list percentage rendering self-contained]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export const formatCourseListGpaPercentage = (value: number): string => {
    if (!Number.isFinite(value)) {
        return '0.0%';
    }
    return `${value.toFixed(1)}%`;
};
