export const calculateGPA = (percentage: number, scalingTableJson: string | undefined): number | string => {
    if (!scalingTableJson || scalingTableJson === '{}') {
        return 0;
    }

    try {
        const scalingTable: Record<string, number> = JSON.parse(scalingTableJson);
        // Sort keys to handle ranges? No, just iterate.
        // We might want to match the most specific or first match.
        // Usually these tables are mutually exclusive.

        for (const [range, gpa] of Object.entries(scalingTable)) {
            const cleanRange = range.trim();

            // Handle "90-100"
            // Handle "90-100" or "100-90"
            if (cleanRange.includes('-')) {
                const parts = cleanRange.split('-').map(s => parseFloat(s.trim()));
                if (parts.length === 2) {
                    const [v1, v2] = parts;
                    if (!isNaN(v1) && !isNaN(v2)) {
                        const min = Math.min(v1, v2);
                        const max = Math.max(v1, v2);
                        if (percentage >= min && percentage <= max) {
                            return gpa;
                        }
                    }
                }
            }
            // Handle ">90", ">=90"
            else if (cleanRange.startsWith('>') || cleanRange.startsWith('>=')) {
                const val = parseFloat(cleanRange.replace(/[^0-9.]/g, ''));
                if (!isNaN(val) && percentage >= val) {
                    return gpa;
                }
            }
            // Handle single number "90" -> imply 90 to 100? Or just exact? 
            // Often used as "Grade 90 gets 4.0".
            // But usually scaling is ranges.
            // Let's assume if single number provided and it's less than percentage, maybe it's a lower bound structure?
            // "85": 4.0, "80": 3.7
            // If we treat keys as lower bounds, we need to sort them.
            // Let's try direct range matching first. If exact match:
            else {
                const val = parseFloat(cleanRange);
                if (!isNaN(val)) {
                    // Exact match
                    if (Math.abs(percentage - val) < 0.01) return gpa;
                }
            }
        }

        // Alternative strategy: if no range matched, maybe the table is lower-bound based?
        // e.g. "85": 4.0, "80": 3.7.
        // If percentage is 87, it should be 4.0.
        // Parse all keys as numbers, sort specific desc, find first <= percentage.
        // Only if keys look like numbers and not ranges.
        const numericEntries = Object.entries(scalingTable)
            .map(([k, v]) => ({ k: parseFloat(k), v, original: k }))
            .filter(e => !isNaN(e.k) && !e.original.includes('-'));

        if (numericEntries.length > 0) {
            // Sort descending
            numericEntries.sort((a, b) => b.k - a.k);
            for (const entry of numericEntries) {
                if (percentage >= entry.k) {
                    return entry.v;
                }
            }
        }

    } catch (e) {
        console.error("Error parsing scaling table", e);
        return 0;
    }

    return 0; // Default if no range matched
};
