// input:  [percentage score and GPA-rule JSON definitions from user/settings state]
// output: [`DEFAULT_GPA_SCALING_TABLE_JSON` and `calculateGPA()` conversion helper]
// pos:    [Shared GPA mapping utility used by settings and grade-related features]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

// 默认的百分制到绩点映射表（JSON 字符串）。
export const DEFAULT_GPA_SCALING_TABLE_JSON = '{"90-100": 4.0, "85-89": 4.0, "80-84": 3.7, "77-79": 3.3, "73-76": 3.0, "70-72": 2.7, "67-69": 2.3, "63-66": 2.0, "60-62": 1.7, "57-59": 1.3, "53-56": 1.0, "50-52": 0.7, "0-49": 0}';

// 统一保留小数位，避免浮点误差。
const roundGpa = (value: number, decimals: number = 3): number => {
    if (!Number.isFinite(value)) return 0;
    return Number(value.toFixed(decimals));
};

export const calculateGPA = (percentage: number, scalingTableJson: string | undefined): number | string => {
    if (!scalingTableJson || scalingTableJson === '{}') {
        return 0;
    }

    try {
        const scalingTable: Record<string, number> = JSON.parse(scalingTableJson);
        // 先按原顺序遍历，通常区间互斥且顺序无关。

        for (const [range, gpa] of Object.entries(scalingTable)) {
            const cleanRange = range.trim();

            // 处理区间格式： "90-100" 或 "100-90"。
            if (cleanRange.includes('-')) {
                const parts = cleanRange.split('-').map(s => parseFloat(s.trim()));
                if (parts.length === 2) {
                    const [v1, v2] = parts;
                    if (!isNaN(v1) && !isNaN(v2)) {
                        const min = Math.min(v1, v2);
                        const max = Math.max(v1, v2);
                        if (percentage >= min && percentage <= max) {
                            return roundGpa(gpa);
                        }
                    }
                }
            }
            // 处理下限格式：">90"、">=90"。
            else if (cleanRange.startsWith('>') || cleanRange.startsWith('>=')) {
                const val = parseFloat(cleanRange.replace(/[^0-9.]/g, ''));
                if (!isNaN(val) && percentage >= val) {
                    return roundGpa(gpa);
                }
            }
            // 处理单个数字格式："90"。先按精确匹配处理。
            else {
                const val = parseFloat(cleanRange);
                if (!isNaN(val)) {
                    // 精确匹配。
                    if (Math.abs(percentage - val) < 0.01) return roundGpa(gpa);
                }
            }
        }

        // 如果没有区间命中，尝试按“下限表”处理：
        // 例如 "85": 4.0, "80": 3.7，分数 87 应落在 4.0。
        const numericEntries = Object.entries(scalingTable)
            .map(([k, v]) => ({ k: parseFloat(k), v, original: k }))
            .filter(e => !isNaN(e.k) && !e.original.includes('-'));

        if (numericEntries.length > 0) {
            // 从高到低匹配第一个 <= percentage 的下限。
            numericEntries.sort((a, b) => b.k - a.k);
            for (const entry of numericEntries) {
                if (percentage >= entry.k) {
                    return roundGpa(entry.v);
                }
            }
        }

    } catch (e) {
        console.error("Error parsing scaling table", e);
        return 0;
    }

    return 0; // 未命中任何规则时返回 0。
};
