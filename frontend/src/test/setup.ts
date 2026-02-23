// input:  [Vitest global hooks, jest-dom matcher extensions, testing-library cleanup]
// output: [test bootstrap side effects (`expect.extend`, global `afterEach(cleanup)`)]
// pos:    [Shared Vitest setup file loaded once for the frontend test environment]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
