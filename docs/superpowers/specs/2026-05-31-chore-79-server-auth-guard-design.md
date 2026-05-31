# CHORE-79 — Server-side auth guard (hybrid) — Design

**Issue:** #79
**Date:** 2026-05-31
**Author:** (*MVOX:Palestrina*)
**Status:** Design approved (PO, session 26)

## Problem

The server is blind to authentication. Findings (Finn audit, session 26):

- There are **no cookies anywhere** in mvox. The Entu JWT + accounts + user are written to **`localStorage`** client-side at the OAuth callback; `getToken()` reads `localStorage.getItem('token')`; logout clears `localStorage`.
- `hooks.server.ts` is a bare passthrough; `event.locals` is never populated.
- No route has a server-side auth gate. `/library` has no `+page.server.ts`; its only guard is a client-side `$effect` that silently no-ops when there's no token.

Consequence: an unauthenticated user visiting a protected route (e.g. `/library`) gets the fully-rendered page shell with a permanent "loading library…" spinner instead of being redirected to login. Reported by PO, session 26.

## Constraint that shapes the approach

Entu's 48h JWT is **IP-bound** (`aud = caller IP`; team memory `project_entu_jwt_ip_bound`). The documented "BFF proxies all Entu calls server-side" architecture is **not viable on Cloudflare Workers**: Workers egress from variable Cloudflare IPs, so a server-forwarded Entu call would not match the JWT's `aud` and would 401. The current localStorage/client-direct design is effectively a deliberate workaround.

**Therefore:** we do NOT move Entu data calls server-side. We introduce only enough server-side state (a session cookie) to answer "is the user logged in?" for a route guard. This is the hybrid: server-side **auth gate**, client-side **data fetching**.

## Scope

Guard **all routes** except a public allowlist. Public: `/` (landing), `/auth/*`, `/about`, and static/asset/internal paths (`/_app/*`, favicon, etc.). Everything else (`/library`, `/agenda`, `/roster`, `/notices`, `/settings`, …) requires a session.

Out of scope: moving Entu calls server-side; the full BFF-cookie migration; the librarian-rights check (stays client-side — it needs an Entu round-trip).

## Design

### 1. Session cookie
A new cookie `mvox_session`:
- **httpOnly** (JS cannot read it — safer than the localStorage copy), **Secure** in production, **SameSite=Lax**, **Path=/**.
- **Max-Age = 48h** to match Entu's JWT lifetime.
- **Value = the Entu JWT** (the same token the client stores in localStorage). Storing the JWT (rather than a bare flag) lets the server decode it to check `exp` and treat an expired token as logged-out.

The client's existing `localStorage` token is **unchanged** — it remains the source for direct (IP-matched) Entu API calls. The cookie is purely the server's view of the session.

### 2. Setting the cookie
The OAuth callback already runs a server-side `+page.server.ts` that handles the session token before passing it to the client. Set the cookie there with `cookies.set('mvox_session', token, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 60*60*48 })`. The client `+page.svelte` continues to write `localStorage` as today. No new network round-trip.

### 3. Clearing the cookie
Logout currently clears `localStorage` client-side only. Add server-side clearing so the cookie is deleted in lockstep: a server endpoint/action (`/auth/logout` `+server.ts` or form action) that calls `cookies.delete('mvox_session', { path: '/' })`. The client continues to clear `localStorage`. Logout then lands on `/`.

### 4. The guard (`hooks.server.ts`)
Replace the passthrough `handle` with:
1. Compute whether `event.url.pathname` is public (allowlist match) or an internal/asset path.
2. If protected and there is no valid `mvox_session` cookie (absent, or present-but-expired per decoded `exp`), `redirect(302, '/auth/login?redirect=' + encodeURIComponent(pathname + search))`.
3. Otherwise `resolve(event)`. Optionally populate `event.locals.session` with the decoded claims for downstream use (cheap; no Entu call).

Expiry check: decode the JWT payload (base64url) and compare `exp` to now; no signature verification needed for a soft gate (the cookie is httpOnly + our own; a forged token would fail real Entu calls anyway).

### 5. Return-url
`/auth/login` accepts `?redirect=<path>`; after a successful login the callback honors it and navigates there (default `/`). Validate it's a local path (starts with `/`, not `//`) to avoid open-redirect.

### 6. What stays client-side
The `/library` librarian-rights check (`goto('/')` on Entu `no-rights`) is unchanged — it needs an Entu call. The server guard answers only "logged in?"; "has rights?" stays client-side.

### Coverage note
`hooks.server.ts` runs on full page loads / SSR (direct URLs, bookmarks, refreshes) — exactly the unauthenticated-entry case. In-app SPA navigations by an already-authenticated user don't re-hit the hook, but those are covered by the existing client-side token checks (and an expired session surfaces on the next full load). This is acceptable for the goal (no anonymous access to protected pages).

## Acceptance Criteria

- **AC1** — `hooks.server.ts` redirects an unauthenticated request (no `mvox_session` cookie) for a protected path to `/auth/login?redirect=<encoded original path+query>` with a 302.
- **AC2** — Requests to public allowlist paths (`/`, `/auth/*`, `/about`) and internal/asset paths pass through without redirect, authenticated or not.
- **AC3** — A request with a present-but-expired `mvox_session` cookie (decoded `exp` in the past) is treated as unauthenticated → redirected.
- **AC4** — A request with a valid (present + unexpired) `mvox_session` cookie passes through to the protected route.
- **AC5** — The OAuth callback `+page.server.ts` sets `mvox_session` (httpOnly, Secure in prod, SameSite=Lax, Path=/, Max-Age 48h) = the session JWT.
- **AC6** — Logout clears `mvox_session` server-side (cookie deleted) in addition to the existing localStorage clear.
- **AC7** — After login with a `?redirect=<local path>`, the user is returned to that path; a non-local/unsafe redirect value falls back to `/`.
- **AC8** — The `/library` client-side librarian-rights redirect-to-`/` behavior is unchanged.

## Testing

Unit (Vitest) on the hook + cookie helpers with mock `RequestEvent` (cookies, url): AC1–AC4 redirect/pass-through matrix, AC3 expiry decode, AC7 redirect-param validation (incl. open-redirect rejection). Callback cookie-set (AC5) + logout cookie-clear (AC6) via mock `cookies`. Existing auth/library tests stay green. A true browser end-to-end (real login → cookie present → protected route loads) is a deferred Playwright note in `test-gaps.md`.

## Risks / notes

- The JWT now lives in two places (httpOnly cookie + localStorage). Acceptable: the cookie is the server's gate; localStorage remains the client's API token. Both clear on logout.
- Cookie size: an Entu JWT is well under the ~4KB cookie limit.
- This is the first cookie + first real `hooks.server.ts` logic in the app — it lays a paving stone toward the documented BFF-cookie architecture without taking on the IP-bound server-proxy problem.
