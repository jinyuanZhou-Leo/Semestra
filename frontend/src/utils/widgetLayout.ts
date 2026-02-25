// input:  [widget layout metadata, raw persisted layout values, active breakpoint column count]
// output: [`resolveWidgetLayoutConstraints`, `normalizeWidgetSize`, and numeric layout helpers]
// pos:    [Shared widget layout normalization utility used by grid rendering and persistence hooks]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { WidgetDefinition } from '../services/widgetRegistry';

const DEFAULT_WIDGET_LAYOUT = { w: 4, h: 4, minW: 2, minH: 2 } as const;

export interface WidgetLayoutConstraints {
    defaultW: number;
    defaultH: number;
    minW: number;
    minH: number;
    maxW: number;
    maxH?: number;
    aspectRatio?: number;
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

const toSafeAspectRatio = (value: unknown): number | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
    return value;
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

const chooseBestAspectRatioSize = (
    targetW: number,
    targetH: number,
    constraints: WidgetLayoutConstraints
) => {
    const ratio = constraints.aspectRatio;
    if (!ratio) {
        return { w: targetW, h: targetH };
    }

    let best = {
        w: targetW,
        h: targetH,
        score: Number.POSITIVE_INFINITY
    };

    for (let w = constraints.minW; w <= constraints.maxW; w += 1) {
        const idealH = w / ratio;
        const candidateHValues = new Set<number>([
            Math.floor(idealH),
            Math.round(idealH),
            Math.ceil(idealH),
            constraints.minH,
            targetH
        ]);
        if (constraints.maxH !== undefined) {
            candidateHValues.add(constraints.maxH);
        }

        candidateHValues.forEach((hCandidate) => {
            const h = clampHeight(hCandidate, constraints.minH, constraints.maxH);
            if (h <= 0) return;
            const ratioError = Math.abs((w / h) - ratio);
            const sizeDrift = Math.abs(w - targetW) + Math.abs(h - targetH);
            const score = ratioError * 100 + sizeDrift;

            if (score < best.score) {
                best = { w, h, score };
            }
        });
    }

    return { w: best.w, h: best.h };
};

export const resolveWidgetLayoutConstraints = (
    layoutDef: WidgetDefinition['layout'] | undefined,
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
    const aspectRatio = toSafeAspectRatio(layoutDef?.aspectRatio);

    return {
        defaultW,
        defaultH,
        minW,
        minH,
        maxW,
        maxH,
        aspectRatio,
    };
};

export const normalizeWidgetSize = (
    rawW: unknown,
    rawH: unknown,
    constraints: WidgetLayoutConstraints
) => {
    const normalized = normalizeWithoutAspectRatio(rawW, rawH, constraints);
    if (!constraints.aspectRatio) return normalized;

    return chooseBestAspectRatioSize(normalized.w, normalized.h, constraints);
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
