// input:  [`VITE_API_BASE_URL`/CSRF env values, browser cookies, and axios default configuration surface]
// output: [startup side effect that sets axios `baseURL`, cookie-auth defaults, and CSRF headers for unsafe requests]
// pos:    [One-time HTTP client bootstrap imported by `src/main.tsx`]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import axios from 'axios';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const baseUrl = rawBaseUrl ? rawBaseUrl.replace(/\/+$/, '') : '';
const csrfCookieName = (import.meta.env.VITE_AUTH_CSRF_COOKIE_NAME as string | undefined) ?? 'semestra_csrf';
const csrfHeaderName = (import.meta.env.VITE_AUTH_CSRF_HEADER_NAME as string | undefined) ?? 'X-CSRF-Token';
const unsafeMethods = new Set(['post', 'put', 'patch', 'delete']);

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const encodedName = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(encodedName));
  if (!cookie) {
    return null;
  }
  return decodeURIComponent(cookie.slice(encodedName.length));
}

if (baseUrl) {
  axios.defaults.baseURL = baseUrl;
}

axios.defaults.withCredentials = true;
axios.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toLowerCase();
  if (!unsafeMethods.has(method)) {
    return config;
  }

  const csrfToken = readCookie(csrfCookieName);
  if (!csrfToken) {
    return config;
  }

  const headers = config.headers ?? {};
  if (typeof (headers as { set?: unknown }).set === 'function') {
    (headers as { set(name: string, value: string): void }).set(csrfHeaderName, csrfToken);
  } else {
    (headers as Record<string, string>)[csrfHeaderName] = csrfToken;
  }
  config.headers = headers;
  return config;
});
