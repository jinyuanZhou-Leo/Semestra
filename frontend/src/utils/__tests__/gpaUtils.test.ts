import { describe, it, expect } from 'vitest';
import { calculateGPA } from '../gpaUtils';

describe('calculateGPA', () => {
    const standardTable = JSON.stringify({
        "90-100": 4.0,
        "80-89": 3.0,
        "70-79": 2.0,
        "0-69": 0.0
    });

    it('should return 0 for empty or invalid table', () => {
        expect(calculateGPA(95, undefined)).toBe(0);
        expect(calculateGPA(95, '{}')).toBe(0);
        expect(calculateGPA(95, 'invalid json')).toBe(0);
    });

    it('should handle standard min-max ranges', () => {
        expect(calculateGPA(95, standardTable)).toBe(4.0);
        expect(calculateGPA(85, standardTable)).toBe(3.0);
        expect(calculateGPA(75, standardTable)).toBe(2.0);
        expect(calculateGPA(50, standardTable)).toBe(0.0);
    });

    it('should handle boundary values correctly', () => {
        expect(calculateGPA(90, standardTable)).toBe(4.0);
        expect(calculateGPA(100, standardTable)).toBe(4.0);
        expect(calculateGPA(89, standardTable)).toBe(3.0); 
    });

    it('should handle inverted ranges', () => {
        const invertedTable = JSON.stringify({
            "100-90": 4.0,  // Inverted
            "89-80": 3.0,   // Inverted
            "0-79": 0.0     // Normal
        });

        expect(calculateGPA(95, invertedTable)).toBe(4.0);
        expect(calculateGPA(90, invertedTable)).toBe(4.0);
        expect(calculateGPA(100, invertedTable)).toBe(4.0); // should work
        expect(calculateGPA(85, invertedTable)).toBe(3.0);
    });

    it('should handle > and >= logic', () => {
        const gtTable = JSON.stringify({
            ">=90": 4.0,
            ">80": 3.0,
            "default": 0
        });
        // Note: Object iteration order isn't guaranteed in JS for non-integer keys,
        // but typically insertion order is preserved for string keys.
        // However, the current logic iterates and returns immediately on match.
        // So for key-value tables where keys are strings, order matters in the JSON.
        // But let's just test basic functionality.
        expect(calculateGPA(95, gtTable)).toBe(4.0);
        expect(calculateGPA(85, gtTable)).toBe(3.0);
    });
});
