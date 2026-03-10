// input:  [widget layout metadata, raw persisted layout values, active breakpoint column count]
// output: [`resolveWidgetLayoutConstraints`, `normalizeWidgetSize`, and numeric layout helpers]
// pos:    [Shared widget layout normalization utility used by grid rendering and persistence hooks]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { WidgetLayoutDefinition } from '../plugin-system/types';

const DEFAULT_WIDGET_LAYOUT = { w: 4, h: 4, minW: 2, minH: 2 } as const;

export interface WidgetLayoutConstraints {
    defaultW: number;
    defaultH: number;
    minW: number;
    minH: number;
    maxW: number;
    maxH?: number;
}

const clamp = (value: number, minValue: number, maxValue: number): number => {
    return Math.min(Math.max(value, minValue), maxValue);
};

const clampMin = (value: number, minValue: number): number => {
    return Math.max(value, minValue);
};

const toSafeInteger = (value: unknown, fallback: number): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.floor(value);
};

const clampHeight = (value: number, minH: number, maxH?: number): number => {
    if (maxH === undefined) return clampMin(value, minH);
    return clamp(value, minH, maxH);
};

const normalizeWithoutAspectRatio = (
    rawW: unknown,
    rawH: unknown,
    constraints: WidgetLayoutConstraints
) => {
    const w = clamp(toSafeInteger(rawW, constraints.defaultW), constraints.minW, constraints.maxW);
    const h = clampHeight(toSafeInteger(rawH, constraints.defaultH), constraints.minH, constraints.maxH);
    return { w, h };
};

export const resolveWidgetLayoutConstraints = (
    layoutDef: WidgetLayoutDefinition | undefined,
    maxCols: number
): WidgetLayoutConstraints => {
    const safeCols = Math.max(1, maxCols);
    const minW = clamp(toSafeInteger(layoutDef?.minW, DEFAULT_WIDGET_LAYOUT.minW), 1, safeCols);
    const maxW = clamp(toSafeInteger(layoutDef?.maxW, safeCols), minW, safeCols);
    const defaultW = clamp(toSafeInteger(layoutDef?.w, DEFAULT_WIDGET_LAYOUT.w), minW, maxW);

    const minH = Math.max(1, toSafeInteger(layoutDef?.minH, DEFAULT_WIDGET_LAYOUT.minH));
    const maxHRaw = layoutDef?.maxH;
    const maxH =
        typeof maxHRaw === 'number' && Number.isFinite(maxHRaw)
            ? Math.max(minH, Math.floor(maxHRaw))
            : undefined;
    const defaultHRaw = toSafeInteger(layoutDef?.h, DEFAULT_WIDGET_LAYOUT.h);
    const defaultH = clampHeight(defaultHRaw, minH, maxH);

    return {
        defaultW,
        defaultH,
        minW,
        minH,
        maxW,
        maxH,
    };
};

export const normalizeWidgetSize = (
    rawW: unknown,
    rawH: unknown,
    constraints: WidgetLayoutConstraints
) => {
    return normalizeWithoutAspectRatio(rawW, rawH, constraints);
};

export const normalizeLayoutX = (
    rawX: unknown,
    maxCols: number,
    itemWidth: number
): number => {
    const maxX = Math.max(0, maxCols - itemWidth);
    return clamp(toSafeInteger(rawX, 0), 0, maxX);
};

export const normalizeLayoutY = (rawY: unknown): number => {
    return clampMin(toSafeInteger(rawY, 0), 0);
};
