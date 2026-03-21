// input:  [HTML sanitizer helpers and Vitest assertions running in jsdom]
// output: [regression tests for block-preserving safe-text HTML sanitization plus Canvas page-link, table, image, and style preservation]
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

  it('preserves table and image markup with inline styles in Canvas mode', () => {
    const sanitized = sanitizeCanvasHtmlFragment(
      '<table style="width: 100%; border: 1px solid #ddd"><tbody><tr><th style="text-align: left">Week</th><td><img src="https://canvas.example.edu/image.png" alt="Diagram" style="width: 240px; border-radius: 12px" /></td></tr></tbody></table>',
    );

    expect(sanitized).toContain('<table');
    expect(sanitized).toContain('style="width: 100%; border: 1px solid #ddd"');
    expect(sanitized).toContain('<th style="text-align: left">Week</th>');
    expect(sanitized).toContain('<img');
    expect(sanitized).toContain('src="https://canvas.example.edu/image.png"');
    expect(sanitized).toContain('alt="Diagram"');
    expect(sanitized).toContain('style="width: 240px; border-radius: 12px"');
  });
});
