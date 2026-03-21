// input:  [HTML sanitizer helpers and Vitest assertions running in jsdom]
// output: [regression tests for block-preserving safe-text HTML sanitization and Canvas page-link metadata preservation]
// pos:    [frontend HTML utility regression suite]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it } from 'vitest';
import { sanitizeCanvasHtmlFragment, sanitizeTextListHtmlFragment } from './html';

describe('sanitizeTextListHtmlFragment', () => {
  it('preserves common block wrappers in safe text/list mode', () => {
    const sanitized = sanitizeTextListHtmlFragment('<div>Part A</div><div>Part B</div><h2>Heading</h2><p>Body</p>');

    expect(sanitized).toContain('<div>Part A</div>');
    expect(sanitized).toContain('<div>Part B</div>');
    expect(sanitized).toContain('<h2>Heading</h2>');
    expect(sanitized).toContain('<p>Body</p>');
  });
});

describe('sanitizeCanvasHtmlFragment', () => {
  it('preserves Canvas page link metadata on anchors', () => {
    const sanitized = sanitizeCanvasHtmlFragment(
      '<a href="/courses/123/pages/second-page" data-api-endpoint="/api/v1/courses/123/pages/second-page" data-api-returntype="Page" onclick="alert(1)">Read more</a>',
    );

    expect(sanitized).toContain('data-api-endpoint="/api/v1/courses/123/pages/second-page"');
    expect(sanitized).toContain('data-api-returntype="Page"');
    expect(sanitized).not.toContain('onclick');
  });
});
