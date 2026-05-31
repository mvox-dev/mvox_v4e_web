# CHORE-79 — Server-side Auth Guard (hybrid) — Implementation Plan

> **Execution mode:** mvox-dev team TDD chain — Tallis (RED) → **Josquin** (GREEN, server-side) → Bentham (REVIEW, security-critical) → Josquin (MERGE). No i18n (no user-facing strings) and no Byrd (server-side only; any tiny client touch noted inline). NOT subagent-driven/inline — team chain is the baked-in mode for this repo. Steps use `- [ ]`.

> **For the picking-up session:** read the spec first — `docs/superpowers/specs/2026-05-31-chore-79-server-auth-guard-design.md`. This plan assumes the spec's design. Branch: cut `chore/auth-guard` from clean main. Same preview→PO-verify→merge dance as CHORE-76/77/78.

**Goal:** Redirect unauthenticated users away from protected routes (server-side, no page flash) by introducing an httpOnly session cookie + a `hooks.server.ts` guard, without moving Entu data calls server-side.

**Architecture:** A new httpOnly `mvox_session` cookie (= the Entu JWT, 48h) is set during the existing server-side OAuth callback and cleared at logout. `hooks.server.ts` reads it and redirects requests for protected paths to `/auth/login?redirect=…` when there's no valid (present + unexpired) session. Entu data fetching stays client-side (Entu's JWT is IP-bound; CF Workers' variable egress would 401 a server-proxied call — memory `project_entu_jwt_ip_bound`). The `/library` librarian-rights check stays client-side.

**Tech Stack:** SvelteKit 2 (`Handle` hook, `cookies` API, `redirect`), TypeScript strict, Vitest. Server-only code under `src/lib/server/`.

## Current auth state (verified, session 26 — Finn audit)

- JWT/accounts/user are written to **localStorage** client-side at `src/routes/auth/callback/+page.svelte` (`setToken`/`setAccounts`/`setUser` from `src/lib/auth/storage.ts`; token key = `'token'`).
- `src/routes/auth/callback/+page.server.ts` validates the `?key=` param and passes the session token to the client as `data` (server already has the token here → cookie set-point).
- `src/routes/auth/logout/perform-logout.ts` calls `clearAll()` (localStorage only; no cookie today).
- `src/hooks.server.ts` is a bare passthrough; `event.locals` never populated.
- **No cookies exist anywhere** in the codebase today. This is the first one.

---

## File Map

- **Create** `src/lib/server/auth/session-cookie.ts` — server-only pure helpers: cookie name + options, JWT-exp decode, validity check, protected-path matcher, safe-redirect validator. One focused unit, fully unit-testable without SvelteKit.
- **Create** `src/lib/server/auth/session-cookie.spec.ts` — unit tests for the helpers.
- **Rewrite** `src/hooks.server.ts` — the `handle` guard. Test: `src/hooks.server.spec.ts` (new).
- **Modify** `src/routes/auth/callback/+page.server.ts` — set the cookie from the token it already handles; honor `?redirect=`.
- **Modify** the logout path (`src/routes/auth/logout/` — read current shape; add a server-side cookie clear via a `+server.ts` or `+page.server.ts` action). Keep the existing `perform-logout.ts` localStorage clear.
- **Modify** `src/routes/auth/login` (read current shape) — propagate an incoming `?redirect=` through the OAuth round-trip so the callback can honor it.

> **Read-before-write (Josquin):** the exact current code of `auth/callback/+page.server.ts`, `auth/login/*`, and `auth/logout/*` was not fully captured in planning. Open them first and integrate the cookie set/clear + redirect propagation into the existing flow rather than assuming structure. Surface-and-stop to team-lead if the callback doesn't actually hold the token server-side (the plan's cookie set-point depends on it).

## Shared contract (names Tallis + Josquin must agree)

- Cookie name: `mvox_session`.
- Helper module exports (server-only): `SESSION_COOKIE = 'mvox_session'`; `sessionCookieOptions(secure: boolean): CookieSerializeOptions` (`{ httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 60*60*48 }`); `decodeJwtExpMs(token: string): number | null`; `isSessionValid(token: string | undefined, nowMs: number): boolean`; `isProtectedPath(pathname: string): boolean`; `safeRedirectTarget(raw: string | null): string` (returns a local path or `/`).
- Public allowlist (NOT protected): exact `/`, anything under `/auth/`, exact `/about`, and internal/asset paths (`/_app/`, `/favicon`, `.well-known`, files with an extension). Everything else is protected.

---

## Task 1 — RED tests (Tallis)

**Files:** Create `src/lib/server/auth/session-cookie.spec.ts`; Create `src/hooks.server.spec.ts`

- [ ] **Step 1: Write helper unit tests** (`session-cookie.spec.ts`)

```ts
import { describe, it, expect } from 'vitest';
import {
  SESSION_COOKIE, sessionCookieOptions, decodeJwtExpMs,
  isSessionValid, isProtectedPath, safeRedirectTarget,
} from './session-cookie';

// helper: build an unsigned JWT with a given exp (seconds)
function jwtWithExp(expSec: number): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64({ exp: expSec })}.sig`;
}

describe('session-cookie helpers', () => {
  it('cookie name is mvox_session', () => {
    expect(SESSION_COOKIE).toBe('mvox_session');
  });

  it('cookie options are httpOnly/lax/path=//48h, secure per flag', () => {
    const opts = sessionCookieOptions(true);
    expect(opts).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 172800, secure: true });
    expect(sessionCookieOptions(false).secure).toBe(false);
  });

  it('decodeJwtExpMs returns exp in ms, null on garbage', () => {
    expect(decodeJwtExpMs(jwtWithExp(1000))).toBe(1000 * 1000);
    expect(decodeJwtExpMs('not-a-jwt')).toBeNull();
    expect(decodeJwtExpMs('')).toBeNull();
  });

  it('isSessionValid: present + unexpired = true; expired/absent = false', () => {
    const now = 2_000_000_000; // ms. NOTE: sample exps below are in SECONDS; decodeJwtExpMs multiplies by 1000, so exp 2_000_001s → 2_000_001_000ms must straddle `now`. `now` must be 2_000_000_000ms (== exp 2_000_000s), NOT 2_000_000_000_000.
    expect(isSessionValid(jwtWithExp(2_000_001), now)).toBe(true);  // exp*1000 = 2_000_001_000ms > now
    expect(isSessionValid(jwtWithExp(1_999_999), now)).toBe(false); // exp*1000 = 1_999_999_000ms < now
    expect(isSessionValid(undefined, now)).toBe(false);
    expect(isSessionValid('garbage', now)).toBe(false);
  });

  it('isProtectedPath: allowlist passes, app routes protected', () => {
    for (const p of ['/', '/about', '/auth/login', '/auth/callback', '/_app/immutable/x.js', '/favicon.png'])
      expect(isProtectedPath(p)).toBe(false);
    for (const p of ['/library', '/agenda', '/roster', '/notices', '/settings', '/library/x'])
      expect(isProtectedPath(p)).toBe(true);
  });

  it('safeRedirectTarget: local path kept, unsafe → /', () => {
    expect(safeRedirectTarget('/library?work=a')).toBe('/library?work=a');
    expect(safeRedirectTarget('//evil.com')).toBe('/');
    expect(safeRedirectTarget('https://evil.com')).toBe('/');
    expect(safeRedirectTarget(null)).toBe('/');
  });
});
```

- [ ] **Step 2: Write hook tests** (`src/hooks.server.spec.ts`) — drive `handle` with a mock event.

```ts
import { describe, it, expect, vi } from 'vitest';
import { handle } from './hooks.server';

function mockEvent(pathname: string, cookie?: string) {
  return {
    url: new URL(`https://mvox.eu${pathname}`),
    cookies: { get: (n: string) => (n === 'mvox_session' ? cookie : undefined) },
  } as any;
}
const resolve = vi.fn(async () => new Response('ok'));

// A non-expired token for "valid" cases (exp far in the future)
const valid = (() => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({})}.${b64({ exp: 4_000_000_000 })}.s`;
})();
const expired = (() => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({})}.${b64({ exp: 1 })}.s`;
})();

describe('auth guard hook', () => {
  it('AC1: unauthenticated protected request → 302 to /auth/login?redirect=', async () => {
    await expect(handle({ event: mockEvent('/library?work=a'), resolve }))
      .rejects.toMatchObject({ status: 302, location: '/auth/login?redirect=%2Flibrary%3Fwork%3Da' });
    // (SvelteKit redirect() throws a Redirect; assert status + location)
  });

  it('AC2: public paths pass through without redirect', async () => {
    for (const p of ['/', '/about', '/auth/login']) {
      resolve.mockClear();
      await handle({ event: mockEvent(p), resolve });
      expect(resolve).toHaveBeenCalledOnce();
    }
  });

  it('AC3: expired cookie on protected path → redirect', async () => {
    await expect(handle({ event: mockEvent('/library', expired), resolve }))
      .rejects.toMatchObject({ status: 302 });
  });

  it('AC4: valid cookie on protected path → pass through', async () => {
    resolve.mockClear();
    await handle({ event: mockEvent('/library', valid), resolve });
    expect(resolve).toHaveBeenCalledOnce();
  });
});
```

> If asserting the thrown SvelteKit `redirect` shape is awkward, wrap in try/catch and assert `e.status`/`e.location`, or import `isRedirect`. Tallis: pick the cleanest assertion and pin it; note it in the handoff so Josquin's `redirect()` call matches.

- [ ] **Step 3:** `pnpm lint:fix`, then `pnpm test:unit` — new tests FAIL (helpers + hook not implemented). `pnpm check` should be 0 errors **only if** Tallis lands a minimal stub of `session-cookie.ts` (per YELLOW-78.1 lesson — stub new modules in RED so module-resolution passes and tests fail on assertions). Land a stub exporting the named symbols with throwing/placeholder bodies.
- [ ] **Step 4:** Commit specs + stub (`MVOX_EXPECTED_BRANCH=chore/auth-guard`, no `Co-authored-by:`). Update `test-gaps.md` with the deferred Playwright end-to-end note (real login → cookie → protected route loads; logout → cookie gone → redirect). Handoff to Josquin with the chosen redirect-assertion shape.

---

## Task 2 — GREEN implementation (Josquin)

**Files:** Create `src/lib/server/auth/session-cookie.ts`; Rewrite `src/hooks.server.ts`; Modify `src/routes/auth/callback/+page.server.ts`, the logout route, and `src/routes/auth/login`.

- [ ] **Step 1: Implement the helpers** (`src/lib/server/auth/session-cookie.ts`)

```ts
import type { CookieSerializeOptions } from 'cookie';

export const SESSION_COOKIE = 'mvox_session';

export function sessionCookieOptions(secure: boolean): CookieSerializeOptions & { path: string } {
  return { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 48 };
}

export function decodeJwtExpMs(token: string): number | null {
  const parts = token?.split('.');
  if (!parts || parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isSessionValid(token: string | undefined, nowMs: number): boolean {
  if (!token) return false;
  const expMs = decodeJwtExpMs(token);
  return expMs !== null && expMs > nowMs;
}

const PUBLIC_EXACT = new Set(['/', '/about']);
export function isProtectedPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return false;
  if (pathname.startsWith('/auth/')) return false;
  if (pathname.startsWith('/_app/') || pathname.startsWith('/.well-known')) return false;
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return false; // has a file extension → asset
  return true;
}

export function safeRedirectTarget(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}
```
> Note: `Buffer` is available in the SvelteKit/CF build for server code; if the CF runtime rejects `Buffer`, swap to `atob`-based base64url decoding (process-env trap memory `project_cf_workers_process_env` — verify in preview).

- [ ] **Step 2: Rewrite the hook** (`src/hooks.server.ts`)

```ts
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { SESSION_COOKIE, isSessionValid, isProtectedPath } from '$lib/server/auth/session-cookie';

export const handle: Handle = async ({ event, resolve }) => {
  if (isProtectedPath(event.url.pathname)) {
    const token = event.cookies.get(SESSION_COOKIE);
    if (!isSessionValid(token, Date.now())) {
      const target = event.url.pathname + event.url.search;
      throw redirect(302, `/auth/login?redirect=${encodeURIComponent(target)}`);
    }
  }
  return resolve(event);
};
```

- [ ] **Step 3: Run hook + helper tests** — `pnpm test:unit` for the two spec files; all pass. `pnpm check` 0.

- [ ] **Step 4: Set the cookie at the callback** — in `src/routes/auth/callback/+page.server.ts`, where the server has the token, add `cookies.set(SESSION_COOKIE, token, sessionCookieOptions(!dev))`. Read the current file first; integrate without breaking the existing `data` pass-through that the client uses to write localStorage.

- [ ] **Step 5: Clear the cookie at logout** — in the logout route (`src/routes/auth/logout/`), add server-side `cookies.delete(SESSION_COOKIE, { path: '/' })` (a `+page.server.ts` load/action or `+server.ts`). Keep `perform-logout.ts` localStorage clear. The CHORE-75 avatar menu links to `/auth/logout`; ensure the route still ends on `/`. If a `.svelte` touch is needed to trigger the server clear, coordinate a minimal edit with Byrd via team-lead.

- [ ] **Step 6: Honor the redirect param** — `src/routes/auth/login` propagates an incoming `?redirect=` through the OAuth round-trip; the callback reads it and, after setting the cookie, navigates to `safeRedirectTarget(redirect)` (default `/`). Read both files first.

- [ ] **Step 7: Full gates** — `pnpm check` 0, `pnpm test:unit` all green, `pnpm lint` 0 (lint:fix first), `pnpm build`. Commit (`MVOX_EXPECTED_BRANCH=chore/auth-guard`, no `Co-authored-by:`). Handoff to Bentham.

---

## Task 3 — REVIEW (Bentham, security-critical)

- [ ] Auth-boundary review (this is a `src/lib/server/auth/` + `hooks.server.ts` change — Bentham's security-critical file list). Verify AC1–AC8; **no open-redirect** (`safeRedirectTarget` rejects `//host` and absolute URLs); cookie attributes correct (httpOnly, Secure in prod via `!dev`, SameSite=Lax, Path=/, 48h); allowlist can't be bypassed and doesn't accidentally expose a protected route; expired-token path; no `Buffer`/`process` CF-runtime trap (`project_cf_workers_process_env`); per-commit-GREEN; merge-shape. Confirm the guard does NOT attempt server-side Entu calls (IP-binding). Verdict + who-acts.

---

## Task 4 — MERGE + deploy (Josquin)

- [ ] **Phase 1 (preview):** `pnpm build` → `pnpm exec wrangler pages deploy .svelte-kit/cloudflare --project-name=multivox --branch=chore/auth-guard` (creds inline; no production). Report preview URL + `curl -sI` 200. **PO verifies on preview:** logged-out → `/library` redirects to `/auth/login`; log in → returns to `/library`; logout → `/library` redirects again. HOLD.
- [ ] **Phase 2 (on team-lead "PO approved, merge"):** `git checkout main && git pull` → `git merge --squash chore/auth-guard` → commit `feat(#79): server-side auth guard — httpOnly session cookie + hooks redirect` body `Closes #79` (hook adds PO co-author; no `Co-authored-by:` lines; `MVOX_EXPECTED_BRANCH=main`) → `git push` → production deploy → delete branch → report SHA + chunks + `curl -sI https://mvox.eu/` 200. Team-lead closes #79.

---

## Notes for the chain

- **Branch:** `chore/auth-guard` from clean main.
- **Security focus:** this is the app's first cookie + first real auth boundary in `hooks.server.ts`. Bentham reviews thoroughly; PO verifies the live redirect behavior on preview before merge (don't skip — auth UX is easy to get subtly wrong).
- **Do NOT move Entu calls server-side** — the cookie is only for the guard; data fetching stays client-side (IP-binding).
- **CF runtime:** verify base64url decode + cookie behavior on the preview deploy, not just in Vitest/Node (`project_cf_workers_process_env` lesson — Node-green ≠ CF-green).
- Standard discipline: one owner at a time, `MVOX_EXPECTED_BRANCH` per commit, no `Co-authored-by:` in dispatch/commit bodies.

(*MVOX:Palestrina*)
