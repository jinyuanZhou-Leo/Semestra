// input:  [numeric GPA percentage values from pages, components, and plugin runtime views]
// output: [`formatGpaPercentageValue()` and `formatGpaPercentage()` display helpers]
// pos:    [Shared formatting utility that keeps GPA percentage presentation consistent and host-agnostic]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

const normalizePercentage = (value: number): number => {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return value;
};

export const formatGpaPercentageValue = (value: number): string => normalizePercentage(value).toFixed(1);

export const formatGpaPercentage = (value: number): string => `${formatGpaPercentageValue(value)}%`;
