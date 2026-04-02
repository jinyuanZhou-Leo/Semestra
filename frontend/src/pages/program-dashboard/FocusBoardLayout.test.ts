// input:  [Vitest runtime and Focus Board layout-engine exports]
// output: [Regression tests covering Focus Board two-row packing, row-aware drag collision solving, global gap backfilling, and manual-layout normalization]
// pos:    [Program Focus Board layout-engine test coverage]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it } from 'vitest';

import {
  buildStripLayouts,
  solveFocusBoardDragLayout,
  type FocusBoardLayoutItem,
} from './FocusBoardLayout';
import type { ProgramHomeResolvedEntity } from '@/utils/programHome';

const createEntity = (
  id: string,
  size: 'small' | 'medium' | 'large',
  layout?: { desktop?: { x: number; y: number; w: number; h: number }; mobile?: { x: number; y: number; w: number; h: number } },
): ProgramHomeResolvedEntity => ({
  entityType: 'semester',
  entityId: id,
  title: id,
  chronologyKey: id,
  item: {
    entity_type: 'semester',
    entity_id: id,
    size,
    layout,
  },
});

describe('FocusBoardLayout', () => {
  it('pushes conflicting manual layouts to the right without changing size', () => {
    const entities = [
      createEntity('a', 'large', { desktop: { x: 0, y: 0, w: 2, h: 2 } }),
      createEntity('b', 'medium', { desktop: { x: 1, y: 0, w: 2, h: 1 } }),
    ];

    const result = buildStripLayouts(entities, 'desktop', true);

    expect(result.layouts.get('semester:a')).toEqual({ x: 0, y: 0, w: 2, h: 2 });
    expect(result.layouts.get('semester:b')).toEqual({ x: 2, y: 0, w: 2, h: 1 });
  });

  it('solves drag previews by preserving the dragged target and reusing the alternate row before pushing rightward', () => {
    const entities = [
      createEntity('a', 'medium'),
      createEntity('b', 'medium'),
      createEntity('c', 'small'),
    ];
    const layout: FocusBoardLayoutItem[] = [
      { i: 'semester:a', x: 0, y: 0, w: 2, h: 1 },
      { i: 'semester:b', x: 2, y: 0, w: 2, h: 1 },
      { i: 'semester:c', x: 4, y: 0, w: 1, h: 2 },
    ];

    const result = solveFocusBoardDragLayout(layout, 'semester:c', { x: 1, y: 0 }, entities, 'desktop');
    const byId = new Map(result.map((item) => [item.i, item]));

    expect(byId.get('semester:c')).toEqual({ i: 'semester:c', x: 1, y: 0, w: 1, h: 2 });
    expect(byId.get('semester:a')).toEqual({ i: 'semester:a', x: 2, y: 0, w: 2, h: 1 });
    expect(byId.get('semester:b')).toEqual({ i: 'semester:b', x: 2, y: 1, w: 2, h: 1 });
  });

  it('compacts remaining items into newly available space instead of preserving their old x positions', () => {
    const entities = [
      createEntity('a', 'medium'),
      createEntity('b', 'medium'),
      createEntity('c', 'medium'),
    ];
    const layout: FocusBoardLayoutItem[] = [
      { i: 'semester:a', x: 0, y: 0, w: 2, h: 1 },
      { i: 'semester:b', x: 2, y: 0, w: 2, h: 1 },
      { i: 'semester:c', x: 4, y: 0, w: 2, h: 1 },
    ];

    const result = solveFocusBoardDragLayout(layout, 'semester:a', { x: 2, y: 0 }, entities, 'desktop');
    const byId = new Map(result.map((item) => [item.i, item]));

    expect(byId.get('semester:a')).toEqual({ i: 'semester:a', x: 2, y: 0, w: 2, h: 1 });
    expect(byId.get('semester:b')).toEqual({ i: 'semester:b', x: 0, y: 0, w: 2, h: 1 });
    expect(byId.get('semester:c')).toEqual({ i: 'semester:c', x: 0, y: 1, w: 2, h: 1 });
  });

  it('allows remaining items to backfill newly opened gaps on either side of the dragged item', () => {
    const entities = [
      createEntity('a', 'medium'),
      createEntity('b', 'medium'),
      createEntity('c', 'medium'),
    ];
    const layout: FocusBoardLayoutItem[] = [
      { i: 'semester:a', x: 0, y: 0, w: 2, h: 1 },
      { i: 'semester:b', x: 2, y: 0, w: 2, h: 1 },
      { i: 'semester:c', x: 4, y: 0, w: 2, h: 1 },
    ];

    const result = solveFocusBoardDragLayout(layout, 'semester:a', { x: 4, y: 0 }, entities, 'desktop');
    const byId = new Map(result.map((item) => [item.i, item]));

    expect(byId.get('semester:a')).toEqual({ i: 'semester:a', x: 4, y: 0, w: 2, h: 1 });
    expect(byId.get('semester:b')).toEqual({ i: 'semester:b', x: 0, y: 0, w: 2, h: 1 });
    expect(byId.get('semester:c')).toEqual({ i: 'semester:c', x: 0, y: 1, w: 2, h: 1 });
  });

  it('appends non-manual items after the occupied manual range instead of backfilling earlier gaps', () => {
    const entities = [
      createEntity('a', 'medium', { desktop: { x: 3, y: 0, w: 2, h: 1 } }),
      createEntity('b', 'medium'),
    ];

    const result = buildStripLayouts(entities, 'desktop', true);

    expect(result.layouts.get('semester:a')).toEqual({ x: 3, y: 0, w: 2, h: 1 });
    expect(result.layouts.get('semester:b')).toEqual({ x: 5, y: 0, w: 2, h: 1 });
  });
});
