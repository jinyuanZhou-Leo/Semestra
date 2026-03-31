// input:  [auth redirect utility helpers and jsdom sessionStorage]
// output: [unit tests covering auth redirect persistence and restore precedence]
// pos:    [Utility regression tests for session-expiry route restoration after login]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { afterEach, describe, expect, it } from 'vitest';
import {
  clearAuthRedirectTarget,
  consumeAuthRedirectTarget,
  readAuthRedirectTarget,
  rememberAuthRedirectTarget,
  resolveAuthRedirectTarget
} from '../authRedirect';

describe('authRedirect', () => {
  afterEach(() => {
    clearAuthRedirectTarget();
  });

  it('stores and reads a valid protected route target', () => {
    rememberAuthRedirectTarget('/courses/42?tab=grades#details');

    expect(readAuthRedirectTarget()).toBe('/courses/42?tab=grades#details');
  });

  it('ignores login and register pages as redirect targets', () => {
    rememberAuthRedirectTarget('/login');
    expect(readAuthRedirectTarget()).toBeNull();

    rememberAuthRedirectTarget('/register?invite=1');
    expect(readAuthRedirectTarget()).toBeNull();
  });

  it('prefers router state when available', () => {
    rememberAuthRedirectTarget('/courses/42');

    const resolved = resolveAuthRedirectTarget({
      pathname: '/programs/7',
      search: '?view=settings',
      hash: '#plugins'
    });

    expect(resolved).toBe('/programs/7?view=settings#plugins');
  });

  it('falls back to stored state and clears it after consumption', () => {
    rememberAuthRedirectTarget('/semesters/9');

    expect(consumeAuthRedirectTarget()).toBe('/semesters/9');
    expect(readAuthRedirectTarget()).toBeNull();
  });

  it('uses the fallback when neither router state nor storage is available', () => {
    expect(resolveAuthRedirectTarget(undefined, '/')).toBe('/');
    expect(consumeAuthRedirectTarget(undefined, '/settings')).toBe('/settings');
  });
});
