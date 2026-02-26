import type { TabContext } from '../services/tabRegistry';
import type { WidgetContext } from '../services/widgetRegistry';

export const DEFAULT_TAB_ALLOWED_CONTEXTS: TabContext[] = ['semester', 'course'];
export const DEFAULT_WIDGET_ALLOWED_CONTEXTS: WidgetContext[] = ['semester', 'course'];

export type MaxInstances = number | 'unlimited';

export const isUnlimitedInstances = (maxInstances?: MaxInstances) => {
    if (maxInstances === undefined || maxInstances === 'unlimited') return true;
    if (typeof maxInstances === 'number' && !Number.isFinite(maxInstances)) return true;
    return false;
};

/**
 * Deep equality check for JSON-compatible values (plain objects, arrays, primitives).
 * Replaces `JSON.stringify(a) === JSON.stringify(b)` with a proper comparison
 * that is order-independent for object keys and avoids serialization overhead.
 */
export const jsonDeepEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;

    if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!jsonDeepEqual(a[i], b[i])) return false;
        }
        return true;
    }

    if (typeof a === 'object' && typeof b === 'object') {
        const aObj = a as Record<string, unknown>;
        const bObj = b as Record<string, unknown>;
        const aKeys = Object.keys(aObj);
        const bKeys = Object.keys(bObj);
        if (aKeys.length !== bKeys.length) return false;
        for (const key of aKeys) {
            if (!Object.prototype.hasOwnProperty.call(bObj, key)) return false;
            if (!jsonDeepEqual(aObj[key], bObj[key])) return false;
        }
        return true;
    }

    return false;
};
