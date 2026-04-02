// input:  [Program Home utility helpers and Vitest assertions]
// output: [regression tests covering Program Home config parsing, pin deduplication, and pin removal]
// pos:    [Utility regression suite ensuring Program Home Focus Board state stays stable across cache hydration and settings toggles]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it } from 'vitest';

import {
  parseProgramHomeSettings,
  removeProgramHomeItem,
  serializeProgramHomeSettings,
  upsertProgramHomeItem,
} from '@/utils/programHome';

describe('programHome utilities', () => {
  it('parses the persisted Program Home tab setting payload', () => {
    const settings = parseProgramHomeSettings([
      {
        id: 'setting-1',
        settings_key: 'builtin-program-home',
        settings: JSON.stringify({
          sort_mode: 'type',
          items: [
            {
              entity_type: 'semester',
              entity_id: 'semester-1',
              size: 'medium',
            },
          ],
        }),
      },
    ]);

    expect(settings.sort_mode).toBe('type');
    expect(settings.items).toEqual([
      {
        entity_type: 'semester',
        entity_id: 'semester-1',
        size: 'medium',
      },
    ]);
  });

  it('does not duplicate an existing pin when toggled on twice', () => {
    const initial = parseProgramHomeSettings([]);
    const once = upsertProgramHomeItem(initial, 'course', 'course-1', 'medium');
    const twice = upsertProgramHomeItem(once, 'course', 'course-1', 'medium');

    expect(twice.items).toHaveLength(1);
    expect(JSON.parse(serializeProgramHomeSettings(twice))).toMatchObject({
      items: [{ entity_type: 'course', entity_id: 'course-1', size: 'medium' }],
    });
  });

  it('removes a pin cleanly when toggled off', () => {
    const initial = upsertProgramHomeItem(parseProgramHomeSettings([]), 'semester', 'semester-1', 'medium');
    const removed = removeProgramHomeItem(initial, 'semester', 'semester-1');

    expect(removed.items).toEqual([]);
  });
});
