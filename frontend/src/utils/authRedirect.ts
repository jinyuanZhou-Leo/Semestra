// input:  [browser sessionStorage, router-style pathname/search/hash objects, and fallback redirect defaults]
// output: [auth redirect persistence helpers for remembering, reading, consuming, and resolving post-login routes]
// pos:    [Small auth-navigation utility that restores the last protected in-app route after session expiry and re-login]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

const AUTH_REDIRECT_STORAGE_KEY = 'semestra.auth.redirect-target';

type RouteLike = {
  pathname?: string;
  search?: string;
  hash?: string;
};

const isStorageAvailable = (): boolean => typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';

// Rejects anything that isn't a same-origin path (open-redirect guard) and
// drops login/register targets to avoid redirect loops after re-authentication.
const normalizeAuthRedirectTarget = (candidate: string | null | undefined): string | null => {
  if (!candidate || typeof candidate !== 'string') {
    return null;
  }

  if (!candidate.startsWith('/')) {
    return null;
  }

  if (candidate === '/login' || candidate.startsWith('/login?') || candidate === '/register' || candidate.startsWith('/register?')) {
    return null;
  }

  return candidate;
};

const serializeRouteLike = (route: RouteLike): string | null => {
  if (typeof route.pathname !== 'string') {
    return null;
  }

  return normalizeAuthRedirectTarget(`${route.pathname}${route.search ?? ''}${route.hash ?? ''}`);
};

export const rememberAuthRedirectTarget = (target: string): void => {
  const normalizedTarget = normalizeAuthRedirectTarget(target);
  if (!normalizedTarget || !isStorageAvailable()) {
    return;
  }

  window.sessionStorage.setItem(AUTH_REDIRECT_STORAGE_KEY, normalizedTarget);
};

export const rememberCurrentAuthRedirectTarget = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  rememberAuthRedirectTarget(`${window.location.pathname}${window.location.search}${window.location.hash}`);
};

export const clearAuthRedirectTarget = (): void => {
  if (!isStorageAvailable()) {
    return;
  }

  window.sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
};

export const readAuthRedirectTarget = (): string | null => {
  if (!isStorageAvailable()) {
    return null;
  }

  return normalizeAuthRedirectTarget(window.sessionStorage.getItem(AUTH_REDIRECT_STORAGE_KEY));
};

export const resolveAuthRedirectTarget = (route?: RouteLike | null, fallback = '/'): string => {
  return serializeRouteLike(route ?? {}) ?? readAuthRedirectTarget() ?? fallback;
};

export const consumeAuthRedirectTarget = (route?: RouteLike | null, fallback = '/'): string => {
  const resolvedTarget = resolveAuthRedirectTarget(route, fallback);
  clearAuthRedirectTarget();
  return resolvedTarget;
};
