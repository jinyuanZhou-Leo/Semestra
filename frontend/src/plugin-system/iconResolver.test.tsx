// input:  [icon resolver helper, lucide-react icon exports, and Vitest assertions]
// output: [test coverage for lucide component icons and asset-string icons resolved by the plugin icon adapter]
// pos:    [focused regression tests that keep plugin icon rendering working for typed plugin.ts authoring entries]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { FolderOpenDot } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { resolvePluginIcon } from './iconResolver';

describe('resolvePluginIcon', () => {
  it('renders lucide-react icon components exported from plugin.ts manifests', () => {
    const icon = resolvePluginIcon(FolderOpenDot);
    expect(icon).toBeTruthy();
    expect(icon).toMatchObject({
      props: expect.objectContaining({
        className: 'h-4 w-4',
      }),
      type: FolderOpenDot,
    });
  });

  it('renders image icons from asset paths', () => {
    const icon = resolvePluginIcon('@/assets/canvas-icon.png');
    expect(icon).toBeTruthy();
    expect(icon).toMatchObject({
      props: expect.objectContaining({
        className: 'h-4 w-4 object-contain',
      }),
      type: 'img',
    });
  });
});
