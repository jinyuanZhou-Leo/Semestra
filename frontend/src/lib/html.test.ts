// input:  [HTML sanitizer helpers and Vitest assertions running in jsdom]
// output: [regression tests for block-preserving safe-text HTML sanitization]
// pos:    [frontend HTML utility regression suite]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it } from 'vitest';
import { sanitizeTextListHtmlFragment } from './html';

describe('sanitizeTextListHtmlFragment', () => {
  it('preserves common block wrappers in safe text/list mode', () => {
    const sanitized = sanitizeTextListHtmlFragment('<div>Part A</div><div>Part B</div><h2>Heading</h2><p>Body</p>');

    expect(sanitized).toContain('<div>Part A</div>');
    expect(sanitized).toContain('<div>Part B</div>');
    expect(sanitized).toContain('<h2>Heading</h2>');
    expect(sanitized).toContain('<p>Body</p>');
  });
});
