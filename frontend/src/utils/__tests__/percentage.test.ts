// input:  [Vitest assertions and shared GPA percentage formatters]
// output: [test suite covering consistent one-decimal GPA percentage display formatting]
// pos:    [Utility-level regression tests for GPA percentage presentation helpers]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it } from 'vitest';

import { formatGpaPercentage, formatGpaPercentageValue } from '../percentage';

describe('percentage formatters', () => {
    it('keeps one decimal place for GPA percentage text', () => {
        expect(formatGpaPercentage(95)).toBe('95.0%');
        expect(formatGpaPercentage(88.26)).toBe('88.3%');
    });

    it('returns a value-only formatter for animated number call sites', () => {
        expect(formatGpaPercentageValue(84)).toBe('84.0');
    });
});
