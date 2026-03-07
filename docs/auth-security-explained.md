<!--
input:  [Backend auth implementation, frontend auth flow, runtime environment settings, March 2026 security hardening context]
output: [Human-readable documentation for JWT secret handling, cookie sessions, deployment settings, and non-expert security explanation]
pos:    [Project security note describing the auth/session hardening change and how to operate it safely]
-->

<!-- ⚠️ When this file is updated:
   1. Update these header comments
   2. Update the INDEX.md of the folder this file belongs to
-->

# Auth Security Explained

This document records the authentication security hardening shipped on March 7, 2026.
It is written for maintainers who want both the implementation details and a plain-language explanation.
Use it as the reference for local setup, production deployment, and future auth-related changes.

## What Changed

Semestra used to have two security weaknesses in its login flow:

1. The JWT signing key was effectively hard-coded in backend code.
2. The browser stored the login token in `localStorage`.

The project now uses this safer model:

1. The backend reads the JWT signing key from `JWT_SECRET_KEY`.
2. Login stores the session in an `HttpOnly` cookie instead of `localStorage`.
3. The frontend restores login state by calling `/users/me`, not by reading a token from browser storage.
4. Logout clears the server-managed auth cookie.
5. The backend still accepts bearer tokens for compatibility, but the frontend no longer relies on them.

## The Simple Explanation

If you are not familiar with network security, the easiest way to think about it is this:

- `JWT secret` is like the private stamp used by the server to prove "this login ticket is real."
- If that stamp is written directly in source code, anyone who gets the code may be able to forge tickets.
- `localStorage` is like leaving your house key in an unlocked drawer inside the browser.
- If the page ever has an XSS problem, malicious script can open that drawer and steal the token.
- `HttpOnly cookie` is more like asking the browser to carry the key for you without letting page JavaScript touch it.

This does not make the app magically "fully secure", but it removes two very common and high-impact weaknesses.

## Before vs After

| Topic | Before | After | Why It Is Better |
|------|------|------|------|
| JWT signing key | Hard-coded fallback value in code | Read from `JWT_SECRET_KEY`; production boot fails if missing | Prevents predictable or leaked signing keys |
| Login persistence | Browser script stored token in `localStorage` | Browser stores session in `HttpOnly` cookie | JavaScript can no longer directly read the session token |
| Frontend boot | Read token from storage and attach `Authorization` header | Call `/users/me` with credentials enabled | Centralizes session recovery and reduces token handling in UI code |
| Logout | Remove token from browser storage | Clear auth cookie on backend response | Logout works at the transport/session layer |

## Why `localStorage` Was a Problem

`localStorage` is convenient, but it has an important weakness:

- Any JavaScript running on the page can read it.
- That includes malicious JavaScript if the site ever suffers from XSS.
- Once an attacker steals a bearer token, they can often use it from another machine until it expires.

In plain terms: `localStorage` is not bad for harmless preferences like theme mode, but it is a risky place for login credentials.

## Why `HttpOnly` Cookie Is Better Here

An `HttpOnly` cookie means:

- The browser still sends the session automatically with requests.
- Your frontend code does not need to read the raw token.
- JavaScript running in the page cannot directly access the cookie value.

That reduces damage from many client-side bugs. It is not perfect protection against every attack, but it is a much stronger default for web login sessions.

## Important Limitation

This change improves auth/session handling. It does **not** mean:

- all data in the database is encrypted,
- XSS is impossible,
- CSRF is impossible,
- or the whole app is now "security complete."

It specifically fixes two issues:

1. secret management for JWT signing,
2. browser-side storage of login tokens.

## Runtime Configuration

The backend now expects these auth-related settings:

```env
JWT_SECRET_KEY=replace-me-with-a-long-random-secret
AUTH_COOKIE_NAME=semestra_session
AUTH_COOKIE_SAMESITE=lax
AUTH_COOKIE_SECURE=false
# AUTH_COOKIE_DOMAIN=
```

### What These Mean

- `JWT_SECRET_KEY`: the private signing secret for login tokens. This must be long, random, and never committed to git.
- `AUTH_COOKIE_NAME`: cookie key seen by the browser.
- `AUTH_COOKIE_SAMESITE`: controls when the browser sends the cookie across sites.
- `AUTH_COOKIE_SECURE`: when `true`, the browser only sends the cookie over HTTPS.
- `AUTH_COOKIE_DOMAIN`: optional; only set it if you intentionally want the cookie shared across subdomains.

## Safe Defaults for Real Deployments

For production, use this checklist:

1. Set a strong random `JWT_SECRET_KEY`.
2. Set `ENVIRONMENT=production`.
3. Set `AUTH_COOKIE_SECURE=true`.
4. Prefer putting frontend and backend behind the same site or reverse proxy if possible.
5. Keep `AUTH_COOKIE_SAMESITE=lax` unless you truly need cross-site cookie sending.

### When to Use `AUTH_COOKIE_SAMESITE=none`

Only use `none` when your frontend and backend are intentionally deployed on different sites and still need cookie auth.

If you choose `none`, you must also set:

```env
AUTH_COOKIE_SECURE=true
```

Otherwise modern browsers may reject the cookie.

## Recommendation for a Non-Security Maintainer

If you want the shortest safe rule set:

1. Treat `JWT_SECRET_KEY` like a password for the entire login system.
2. Never put it in source code, screenshots, chat logs, or public docs.
3. Keep auth in cookies, not in `localStorage`.
4. Use HTTPS in production.
5. If something is only for local development, document that clearly.

## Frequently Asked Questions

### Does the backend still return `access_token`?

Yes. It is still returned for compatibility with existing tests and any non-browser clients.
The browser app itself should not depend on that token anymore.

### Does this mean the database is encrypted?

No.
This change only improves how login sessions are signed and transported.
If you later want encryption-at-rest for sensitive user content, that is a separate project.

### Is `localStorage` always unsafe?

Not for everything.
It is usually acceptable for non-sensitive UI state such as theme, panel expansion state, or widget edit mode.
It is a poor place for login tokens, API secrets, or anything that grants account access.

### If we use cookies now, are we done?

Not completely.
Cookie-based auth is a stronger default for browsers, but you still need normal web security hygiene such as XSS prevention, HTTPS, and reasonable CORS settings.

## Scope of This Change

Files directly involved in this auth hardening include:

- `backend/auth.py`
- `backend/main.py`
- `backend/.env.example`
- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/services/http.ts`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/RegisterPage.tsx`
- `frontend/src/components/Layout.tsx`
- `frontend/src/pages/SettingsPage.tsx`

## One-Sentence Summary

The app now keeps the JWT signing key out of source code and keeps browser login sessions out of JavaScript-readable storage, which is a safer default for a web application.
