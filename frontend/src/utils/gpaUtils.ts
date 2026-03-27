// input:  [percentage score and GPA-rule JSON definitions from user/settings state]
// output: [`DEFAULT_GPA_SCALING_TABLE_JSON` and `calculateGPA()` conversion helper]
// pos:    [Shared GPA mapping utility used by settings and grade-related features, with continuous matching for adjacent integer-authored bands]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export const DEFAULT_GPA_SCALING_TABLE_JSON = '{"90-100": 4.0, "85-89": 4.0, "80-84": 3.7, "77-79": 3.3, "73-76": 3.0, "70-72": 2.7, "67-69": 2.3, "63-66": 2.0, "60-62": 1.7, "57-59": 1.3, "53-56": 1.0, "50-52": 0.7, "0-49": 0}';

const SCORE_DOMAIN_END = 100;
const RANGE_TOLERANCE = 1e-9;

const roundGpa = (value: number, decimals: number = 3): number => {
    if (!Number.isFinite(value)) return 0;
    return Number(value.toFixed(decimals));
};

const matchesRange = (percentage: number, left: number, right: number): boolean => {
    const min = Math.min(left, right);
    const max = Math.max(left, right);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return false;

    const upperBound = Number.isInteger(min) && Number.isInteger(max)
        ? (max >= SCORE_DOMAIN_END ? SCORE_DOMAIN_END + RANGE_TOLERANCE : max + 1)
        : max + RANGE_TOLERANCE;

    return percentage >= min && percentage < upperBound;
};

export const calculateGPA = (percentage: number, scalingTableJson: string | undefined): number | string => {
    if (!scalingTableJson || scalingTableJson === '{}') {
        return 0;
    }

    try {
        const scalingTable: Record<string, number> = JSON.parse(scalingTableJson);

        for (const [range, gpa] of Object.entries(scalingTable)) {
            const cleanRange = range.trim();

            if (cleanRange.includes('-')) {
                const parts = cleanRange.split('-').map(s => parseFloat(s.trim()));
                if (parts.length === 2) {
                    const [v1, v2] = parts;
                    if (!isNaN(v1) && !isNaN(v2) && matchesRange(percentage, v1, v2)) {
                        return roundGpa(gpa);
                    }
                }
            }
            else if (cleanRange.startsWith('>') || cleanRange.startsWith('>=')) {
                const val = parseFloat(cleanRange.replace(/[^0-9.]/g, ''));
                if (!isNaN(val) && percentage >= val) {
                    return roundGpa(gpa);
                }
            }
            else {
                const val = parseFloat(cleanRange);
                if (!isNaN(val)) {
                    if (Math.abs(percentage - val) < 0.01) return roundGpa(gpa);
                }
            }
        }

        const numericEntries = Object.entries(scalingTable)
            .map(([k, v]) => ({ k: parseFloat(k), v, original: k }))
            .filter(e => !isNaN(e.k) && !e.original.includes('-'));

        if (numericEntries.length > 0) {
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

    return 0;
};
