# CHORE-53 — Path C: browser-direct Entu, mirror entu/webapp

**Status:** design approved 2026-05-23. Pending PO spec-file review, then writing-plans handoff.
**Issue:** [mvox-dev/mvox_v4e_web#53](https://github.com/mvox-dev/mvox_v4e_web/issues/53)
**Authors:** Palestrina (team-lead), with PO direction.
**Research:** Finn (entu/webapp source read; OAuth parameter passthrough probe).

(*MVOX:Palestrina*)

---

## 1. Decision

mvox stops proxying Entu data calls. The frontend authenticates via Entu's OAuth flow and then talks to `api.entu.app` **browser-direct**, exactly the way `entu/webapp` (Entu's own reference frontend) does. The JWT lives in `localStorage`. The BFF shrinks to OAuth coordination + a (currently empty) list of genuinely-elevated future ops. On JWT expiry or IP shift (401), the user is redirected to their last-used OAuth provider with state preserved. Explicit logout clears all remember-me state; involuntary re-auth preserves the provider hint.

This decision aligns mvox with three things at once:

- **Entu's reference implementation** (`entu/webapp` is open-source on GitHub; uses localStorage + Bearer + browser-direct; we mirror it),
- **Entu's threat model** (IP-binding is the JWT-theft mitigation; httpOnly-cookie protection on top was redundant **and** incompatible with the BFF proxy),
- **`architecture-decisions.md`'s "open-platform stance for 3rd-party frontends"** (mvox now lives as one of N possible frontends, all using the same browser-direct pattern).

## 2. Background and forcing function

### 2.1 The bug

After CHORE-50 + CHORE-51 unblocked live OAuth sign-in in session 15, the next call (any data API) 500'd. Root-cause analysis traced to **Entu's documented IP-binding behavior**: JWTs are bound to the IP of the issuing browser via the `aud` claim. mvox's BFF on Cloudflare Workers proxies calls from CF Frankfurt egress IPs, which differ from the user's browser IP, so every BFF-proxied data call gets `401 Invalid JWT audience`. This isn't a code bug — it's a foundational incompatibility between mvox's "httpOnly cookie + BFF proxy" pattern and Entu's design.

### 2.2 Why Path A was rejected

Path A — service-entity API key with mvox owning per-user rights enforcement — was rejected by PO 2026-05-23: "if we have to own rights management, why use Entu at all." mvox keeps Entu's `_owner` / `_editor` / `_viewer` rights as the authoritative access model under both surviving paths.

### 2.3 Why Path B was abandoned

Path B was "ask Argo to relax IP-binding or add an IP-unbound JWT variant for trusted server callers." Finn's research established that **IP-binding is a deliberate security primitive**, not an oversight. Entu's reference frontend (entu/webapp) stores the JWT in `localStorage` and calls `api.entu.app` browser-direct — IP-binding is the load-bearing mitigation that compensates for JS-readable tokens (stolen token + different IP = useless). Asking Argo to relax it = asking them to weaken their threat model for one caller. They would either refuse or offer the service-entity API key route (= rejected Path A).

### 2.4 Why Path C is the right answer

Mirror entu/webapp. Same storage keys (`token`, `accounts`, `user`), same Bearer-auth pattern, same browser-direct calls, same expiry/IP-shift handling. The pattern is battle-tested in Entu's own production frontend. mvox stops swimming upstream of Entu's design.

## 3. Architecture

```
Today (broken):
  Browser ──► mvox BFF (CF Worker) ──► api.entu.app
                       │
                       └─ adds Authorization from httpOnly cookie
                       └─ ❌ IP-binding rejects: CF egress IP ≠ browser IP

After Path C:
  Browser ──► api.entu.app          (data calls, Bearer from localStorage)
  Browser ──► mvox BFF (CF Worker)   (login redirect, callback exchange already client-side,
                                      future elevated ops only)
```

The BFF retains:
- `/auth/login` — server-renders the provider picker page (i18n stays)
- `/auth/[provider]` — **client-side** `+page.svelte` that constructs the OAuth init URL (with state nonce + forward-compat `login_hint` from localStorage) and redirects via `window.location` to `api.entu.app/auth/<provider>?next=...`. Mirrors `entu/webapp:app/pages/auth/[provider].vue`. No `+server.ts` here.
- `/auth/callback` — server-renders the spinner shell; client-side JS runs the JWT exchange + storage
- `/auth/logout` — replaced by a `+page.svelte` that clears localStorage on mount (no server-side state to clear)
- `+page.server.ts` (landing) — may stay for public-only content; auth-aware rendering moves client-side
- **An (initially empty) list of genuinely-elevated future ops:** transactional email (CHORE-6 Resend), cron cleanup, federation reports. These remain BFF-routed because their secrets / privilege cannot be on the client. The current pattern in `architecture-decisions.md` ("BFF user-rights default + small enumerable elevated-ops list") inverts: from "BFF for everything by default + elevated-ops as exceptions" to "elevated-ops only + browser-direct for everything else."

## 4. Storage and state model

### 4.1 Browser storage layout

| Key | Storage | Lifetime | Purpose | Cleared by |
|---|---|---|---|---|
| `token` | localStorage | until expiry / 401 / logout | The Entu JWT, sent as `Authorization: Bearer` | logout, 401 auto-logout |
| `accounts` | localStorage | until logout | Entu user's account list (multi-tenant) | logout, 401 |
| `user` | localStorage | until logout | Entu user metadata (incl. `email`) | logout, 401 |
| `mvox.last_provider` | localStorage | persistent | Last successfully-used OAuth provider id (`smart-id`, `mobile-id`, `id-card`, `google`, `apple`, `e-mail`) | **logout only** (NOT 401) |
| OAuth `state` nonce | sessionStorage | single OAuth round-trip | CSRF protection for OAuth callback | callback verifies + deletes |
| Return URL | encoded in OAuth `state` payload | single OAuth round-trip | Where to redirect user post-re-auth | callback consumes |

### 4.2 Three explicit naming rules

1. **The first three keys (`token`, `accounts`, `user`) match `entu/webapp` exactly** — same names, same shapes. Future devs reading entu/webapp source can apply that knowledge directly. We don't invent where we don't have to.
2. **mvox-specific keys are prefixed `mvox.`** — clear namespace boundary if Entu adds new keys later, clear signal in devtools about provenance.
3. **Return URL never lives in localStorage / sessionStorage independently.** It rides inside the OAuth `state` parameter (a string we control). Open OAuth provider in a new tab → still works (state travels with the redirect chain). Stale return URLs can't outlive a single OAuth attempt (state is verified-then-consumed atomically on callback).

### 4.3 Logout semantics

`/auth/logout` becomes a `+page.svelte` whose `onMount` runs:

```ts
localStorage.removeItem('token')
localStorage.removeItem('accounts')
localStorage.removeItem('user')
localStorage.removeItem('mvox.last_provider')  // ← logout clears the provider memory
sessionStorage.clear()
goto('/')
```

No server-side state to clear (no httpOnly cookie under Path C). After explicit logout, the next sign-in starts at the provider picker — **no `login_hint`, no `prompt=none`, no carried account identifier**. Critical for users with multiple Google/Apple accounts mapped to different memberships: "logout → sign in as someone else" must always work cleanly.

### 4.4 401 auto-logout (involuntary)

Same key-clearing as logout EXCEPT `mvox.last_provider` is preserved. This drives the "skip the picker" UX on re-auth. The user lands at `/auth/<saved-provider>` instead of `/auth/login`.

## 5. Auth flow + remember-me

### 5.1 Three trigger sources

| Trigger | Source | `token` / `accounts` / `user` | `mvox.last_provider` | OAuth state |
|---|---|---|---|---|
| Fresh login | User clicks Sign In on `/auth/login` | sets | sets | new nonce |
| Involuntary re-auth (401) | API wrapper catches 401 | clears | **preserved** | new nonce |
| Explicit logout | User clicks Sign Out | clears | **clears** | n/a |

### 5.2 Fresh login flow

```
1. User loads /, sees signed-out landing page.
2. Clicks "Sign in" → /auth/login (provider picker)
3. Clicks a provider → /auth/<provider> (mvox client-side +page.svelte)
4. /auth/<provider>'s onMount: write state nonce to sessionStorage; window.location.href = api.entu.app/auth/<provider>?next=<callback-url-with-encoded-state>[&login_hint=...]
5. Entu → upstream IdP (Google / Smart-ID / etc.) → back to Entu
6. Entu → callback URL with ?key=<session-token>
7. /auth/callback (+page.svelte):
   - Verify state nonce against sessionStorage (CSRF check)
   - Call api.entu.app/auth?key=<session-token> directly (existing src/lib/auth/exchange.ts)
   - Receive {accounts, user, token}
   - Store in localStorage: token, accounts, user, mvox.last_provider
   - Read return_to from state, navigate there
8. App reloads, finds JWT in localStorage, makes data calls browser-direct.
```

### 5.3 Involuntary re-auth on 401

A client-side `apiRequest` wrapper (mirrors `entu/webapp:app/utils/api.js`) intercepts every API response:

```
on 401:
  saved = localStorage['mvox.last_provider']
  current_url = window.location.pathname + window.location.search
  clear token/accounts/user (preserve mvox.last_provider)
  if saved: navigate to /auth/<saved>     with state={return_to: current_url, nonce: new}
  else:     navigate to /auth/login       with state={return_to: current_url, nonce: new}
```

This skips the provider picker for known users while still landing them at a recognized provider's prompt. Smart-ID / Mobile-ID / ID-card / email users hit their familiar entry screen one step earlier; they still must sign live. Provider memory is **never** translated into an account hint sent to the OAuth provider (no `login_hint` passed today — see 5.4 for the forward-compat exception), so a user can always sign out and sign in as a different identity.

### 5.4 Forward-compatible `login_hint` (Finn probe result: currently a no-op)

Finn's research (`entu/api:routes/auth/[provider].get.js`) established that **only 5 hardcoded parameters** (`client_id`, `redirect_uri`, `response_type`, `scope`, `state`) are forwarded from `/auth/<provider>` to `oauth.ee`. Caller-supplied `login_hint` and `prompt` are stripped silently.

Despite this, mvox **does include `login_hint` in its outgoing OAuth init URL on involuntary re-auth**. OAuth init is **client-side under Path C** (matches `entu/webapp:app/pages/auth/[provider].vue`) — only the client can write the state nonce to sessionStorage, and `localStorage['user'].email` is only readable client-side anyway:

```ts
// src/routes/auth/[provider]/+page.svelte — client-side OAuth init
//
// login_hint is currently a no-op: Entu's /auth/<provider> handler strips all
// caller params except the 5 hardcoded ones (client_id, redirect_uri,
// response_type, scope, state). Argo ask filed [Appendix A] to add login_hint
// + prompt to the passthrough list. Until accepted, the hint is decorative;
// once accepted, mvox needs no code change to benefit.
onMount(() => {
  const { provider } = $page.params
  const stateNonce = crypto.randomUUID()
  sessionStorage.setItem('mvox.oauth_nonce', stateNonce)
  const state = encodeState({ nonce: stateNonce, return_to: returnTo, intent })
  const user = getUser()  // localStorage['user'] — null on fresh login

  const params = new URLSearchParams({
    next: `${window.location.origin}/auth/callback?state=${state}`,
    ...(user?.email && { login_hint: user.email }),  // forward-compat; no-op today
  })
  window.location.href = `${ENTU_API_BASE}auth/${provider}?${params}`
})
```

**Practical effect today:** Smart-ID / Mobile-ID / ID-card users get the full UX win (skip the picker → go straight to their provider's prompt). Google / Apple / email users get the picker-skip win but still see the IdP's own account picker. When Argo lands the passthrough, Google / Apple gain account auto-selection with zero mvox-side work.

**No silent-renewal iframe in MVP.** Without `prompt=none` passthrough, an iframe-based silent renewal would surface the IdP's login UI as a hidden popup — broken UX. Defer entirely; revisit if Argo accepts the passthrough ask (same ticket covers both).

### 5.5 OAuth state CSRF model

State is a base64url-encoded JSON object:

```json
{ "nonce": "<128-bit random>", "return_to": "<path>", "intent": "login" | "reauth" }
```

The nonce is stored in `sessionStorage['mvox.oauth_nonce']` at the moment of OAuth initiation. On callback, the URL's state nonce must match what's in sessionStorage. Mismatch → reject + return to login. The `intent` field is purely for client-side branching (subtly different post-callback UX for fresh vs re-auth) and observability.

### 5.6 Multi-tab / cross-app isolation

- Per-origin localStorage means `entu.app` and `multivox.pages.dev` don't share `token` — no cross-app leak.
- Two mvox tabs share localStorage: if tab 1 logs out, tab 2's next request 401s and re-auths. Acceptable.
- Per-tab sessionStorage means tab 1's in-flight OAuth nonce can't be replayed by tab 2.

## 6. File-by-file migration

| File | Action | Reason |
|---|---|---|
| `src/routes/api/organizations/+server.ts` | **delete** | BFF data proxy — entire concept goes away |
| `src/routes/api/organizations/+server.spec.ts` | **delete** | Tests the deleted route |
| `src/routes/api/organizations/[id]/sections/+server.ts` | **delete** | Same |
| `src/routes/api/organizations/[id]/sections/+server.spec.ts` | **delete** | Tests the deleted route |
| `src/routes/auth/cookie/+server.ts` | **delete** | No httpOnly cookie to set under Path C |
| `src/routes/auth/cookie/+server.spec.ts` | **delete** | Tests the deleted route |
| `src/routes/auth/logout/+server.ts` | **delete** | Replaced with `+page.svelte` (mount-based clear) |
| `src/routes/auth/logout/+page.svelte` | **new** | Client-side clear + redirect |
| `src/routes/auth/callback/+page.server.ts` | **revise** | Keeps server-rendered spinner shell; no cookie-set step |
| `src/routes/auth/callback/+page.svelte` | **revise** | Reads `?key`, calls `exchange.ts`, writes localStorage, redirects to `return_to` |
| `src/routes/auth/+server.ts` | **delete** | OAuth init becomes client-side (`+page.svelte` reads localStorage for `login_hint`, writes state nonce to sessionStorage). Replaced by `src/routes/auth/[provider]/+page.svelte`. |
| `src/routes/auth/[provider]/+page.svelte` | **new** | Client-side OAuth init (mirrors `entu/webapp:app/pages/auth/[provider].vue`). Section 5.4 code. |
| `src/routes/auth/login/+page.server.ts` | **revise** | No server-side session needed; renders provider list (i18n stays) |
| `src/routes/auth/login/+page.svelte` | **revise** | Reads `mvox.last_provider` from localStorage on mount; auto-redirect / surface CTA |
| `src/hooks.server.ts` | **revise** | Strip cookie-reading + session-loading logic; CSP / observability hooks may remain |
| `src/+page.server.ts` | **revise** | Public-only content; auth-aware rendering shifts to client |
| `src/+page.svelte` | **revise** | Client-side auth-aware rendering using new client lib |
| `src/lib/server/entu/client.ts` | **move + revise** | → `src/lib/entu/client.ts`. Drops server-only affordances; subsumes CHORE-52 defensive throw |
| `src/lib/server/entu/client.spec.ts` | **move + revise** | → `src/lib/entu/client.spec.ts`. Browser-direct test shape; MSW-based mocks |
| `src/lib/auth/exchange.ts` | **keep** | Already client-side. No change. |
| `src/lib/entu-config.ts` | **keep, expose to client** | Verify no server-only secrets leak to client bundle |
| `src/tests/setup.ts` | **revise** | Wire MSW; remove server-side fetch stubbing |

### 6.1 New files

- `src/lib/auth/storage.ts` — narrow helpers around localStorage: `get/setToken`, `get/setUser`, `get/setLastProvider`, `clearAll(preserveProvider: boolean)`. Single source of truth for key names.
- `src/lib/api/wrapper.ts` — the `apiRequest` wrapper mirroring `entu/webapp:app/utils/api.js`. Intercepts 401, triggers the involuntary-re-auth flow.
- `src/lib/auth/state.ts` — base64url encode/decode of the OAuth state payload + CSRF nonce verification.

### 6.2 Stale-fixture cleanup (closes Finn's session-15 [WARNING])

Six spec files still reference `'https://entu.app/api/'` stub strings (drift not updated in CHORE-50/51). All updated to `https://api.entu.app/` (or replaced with MSW handlers) during CHORE-B:
- `src/tests/routes/auth/server.spec.ts`
- `src/tests/routes/auth/oauth/login-page-server.spec.ts`
- `src/lib/server/entu/client.spec.ts` (moves to new location anyway)
- `src/tests/routes/landing/page.server.spec.ts`
- `src/tests/routes/api/organizations/server.spec.ts` (deleted with route)
- `src/tests/routes/api/organizations/id/sections/server.spec.ts` (deleted with route)
- Plus `callback-exchange-helper.spec.ts:67` (assertion shape update)

## 7. Why this is a net win

Top wins, ordered by spec usefulness. (Canonical version of this list propagates outward via Brilliant → entu-research case study → eventual entu docs RFC.)

**1. Testability collapses to honest network mocks.**
Today's pyramid mixes server-side handler tests (mocking the Entu client wrapper internally) with browser-side stubs — both can drift independently. Path C: tests intercept `api.entu.app` at the network layer (MSW), and every layer of mvox runs the same code in tests as in production. The CF-Workers-environment-differs-from-Node trap that bit us in CHORE-47 (`process.env` vacuously empty in tests, broke in prod) is structurally impossible because there's no CF Workers code in the data path.

**2. Modularity and portability.**
`src/lib/entu/client.ts` becomes a portable, framework-agnostic Entu client. The auth + storage + API-wrapper trio is reusable: future mvox-mobile (RN, Flutter), a sister webapp, or a third-party Entu frontend all consume the same client lib. "Open-platform stance for 3rd-party frontends" stops being aspirational text and becomes structurally enforced.

**3. Fewer hops, fewer failure modes.**
Browser → CF Worker → api.entu.app (3 hops, today) becomes Browser → api.entu.app (2 hops). Eliminates "CF Worker can't reach Entu" 502s, CF timeout limits on slow Entu calls, region-mismatch latencies. Auth-cookie state machine vanishes — "cookie expired but JWT valid" / "cookie present but JWT expired" / "cookie on wrong domain" cannot happen.

**4. CF Pages cost + quota footprint shrinks dramatically.**
Today, every authenticated data call is one CF Worker invocation. Path C: only OAuth coordination + the (currently empty) elevated-ops list lives on CF. Static landing + login pages are pure asset serving. Free-tier worker limits become irrelevant for the foreseeable future.

**5. Architecture mirrors the reference implementation.**
mvox does what entu/webapp does. If Entu ships future best-practice updates or fixes UX corners, we adopt them mechanically. We stop swimming against the design.

**6. Security model becomes coherent, not paradoxically misleading.**
Today's "httpOnly cookie + BFF proxy" pattern *looked* more secure than entu/webapp's localStorage, but the proxy made the JWT unusable (the source of CHORE-52/53). The apparent security was theater because data flow couldn't happen at all. Path C accepts Entu's threat model honestly: IP-binding is the JWT-theft mitigation; localStorage is the storage; both at face value, no impedance mismatch hiding bugs.

**7. Smaller surface for new contributors to learn.**
"Call `fetch(api.entu.app/...)`" is a primitive every JS dev already knows. There's no mvox-specific BFF abstraction layer to internalize. The lib surface to learn shrinks from "SvelteKit `+server.ts` + `event.locals` + `hooks.server.ts` + Entu client wrapper" to "import the client; call it."

**8. Federation-ready by construction.**
Multiple mvox-style frontends can run side by side without coordinating BFFs. Each is a static SvelteKit build talking browser-direct to Entu. A future mvox-eu + mvox-ee + experimental third-party UI coexist without infrastructure entanglement.

**9. Real-time and native apps unlocked.**
If Entu ships WebSocket support, browser-direct connections work natively. A future native app (RN, Flutter) reuses the same auth + API pattern without redesign.

### 7.1 The honest non-win

XSS in mvox now grants the attacker the full Entu API surface as the user, for the JWT's remaining lifetime, instead of only the routes mvox explicitly exposes. The mitigation is IP-binding (stolen token used from a different IP = useless) — which is exactly the deal Entu's own frontend has taken. Not "free improvement," but "alignment with Entu's chosen trade-off." Defensive hygiene under Path C: strict CSP, no third-party scripts in the auth/data flow, careful component review for new components that handle untrusted input.

## 8. Test strategy

### 8.1 Mock library

**MSW (Mock Service Worker)** as the single network-mock layer. Same handlers reused across:
- Vitest (Node-side) via `setupServer`
- Playwright (browser-side) via service-worker bootstrap
- Dev-server fallback when `ENTU_API_KEY` isn't set

Single source of truth: `tests/e2e/mocks/entu-handlers.ts`. **This realizes CHORE-36 (E2E Entu mock harness).**

### 8.2 Three test layers

**Unit (Vitest, no network):**
- `src/lib/auth/storage.ts` — state machine on `globalThis.localStorage` (mocked via `happy-dom`)
- `src/lib/api/wrapper.ts` — 401 interceptor; mock `fetch`; assert correct re-auth redirect URL
- `src/lib/auth/state.ts` — base64url encoding round-trip; CSRF nonce verification
- `src/lib/entu/client.ts` — thin wrapper over fetch; mock fetch; verify Authorization header construction

**Integration (Vitest with MSW):**
- `src/lib/entu/client.ts` against real-shaped api.entu.app responses (MSW handlers per endpoint). Verifies consistent handling of 200 / 401 / 403 / 404 / network-error.
- Auth flow integration: simulate callback URL, drive `+page.svelte`'s onMount, assert localStorage transitions + final navigation.
- Full "fresh login" and "involuntary re-auth" flows tested end-to-end at the lib level.

**E2E (Playwright with MSW in browser):**
- Full browser-driven flows: visit `/`, click sign in, pick provider, MSW intercepts the OAuth redirect chain, assert post-login state on `/`. Smoke per provider (minimum two; ideally all six).
- Failure modes: 401 mid-session triggers re-auth; logout fully clears; multi-tab logout cascades; OAuth state mismatch rejects.
- **This is the test pyramid layer that becomes load-bearing under Path C** — today's unit/integration tests covered server-side state machines; the browser-side state machine only fully exercises in E2E.

### 8.3 Out of MVP test scope

- Real Entu integration tests against a live test database (defer until stable test-db lifecycle exists)
- Visual regression
- Accessibility audit (file separately if desired)

## 9. Migration sequencing

Three CHOREs, each through the full TDD chain, sequential per the no-parallel-branches rule.

### 9.1 CHORE-A — Foundation (no behavior change)

**Scope:**
- New: `src/lib/auth/storage.ts`, `src/lib/api/wrapper.ts` (skeleton, not yet wired), `src/lib/auth/state.ts`
- Move + revise: `src/lib/server/entu/client.ts` → `src/lib/entu/client.ts` — subsumes CHORE-52 defensive throw
- Update all import paths
- Unit tests for new helpers

**Does NOT touch:** user-facing behavior. Auth cookie flow still works. BFF routes still exist (still broken, unchanged).

**Risk:** low. Foundation only.

**Closes:** #52 (subsumed).

### 9.2 CHORE-B — Path C rewrite (the big one)

**Scope:**
- Revise `/auth/callback/+page.svelte` to store JWT in localStorage + handle return URL
- Delete `/auth/+server.ts`; add `/auth/[provider]/+page.svelte` (client-side OAuth init with forward-compat `login_hint`)
- Revise `/auth/login/+page.svelte` (last-provider redirect logic)
- Replace `/auth/logout/+server.ts` with `+page.svelte`
- Strip cookie-reading from `src/hooks.server.ts`
- Delete `/auth/cookie/+server.ts` + spec
- Delete `/api/organizations/+server.ts` + spec
- Delete `/api/organizations/[id]/sections/+server.ts` + spec
- Revise landing page (`+page.server.ts` + `+page.svelte`) to fetch browser-direct via new client
- Wire `apiRequest` wrapper into all data calls; 401 triggers re-auth flow
- Update 6 stale-fixture spec files + remaining tests
- arch-decisions revision (Bentham steward): rewrite "BFF user-rights default" + carve-out sections; resolve YELLOW-50.1 + YELLOW-51.1 as free fold-in

**Risk:** medium. This IS the rewrite. Required: **PO live-test of all 6 OAuth providers on the deployed preview URL before merging.**

**Closes:** #53 (the main one).

### 9.3 CHORE-C — Test infrastructure (MSW)

**Scope:**
- Install MSW; `tests/e2e/mocks/entu-handlers.ts` as single source of truth
- Replace remaining server-side fetch stubs with MSW handlers
- Add Playwright E2E coverage: fresh login per provider, involuntary re-auth on 401, multi-tab logout, OAuth state mismatch

**Risk:** low. Test-only.

**Closes:** #36 (CHORE-36 mock harness realized), #39 (layout.server.ts session lift moot under Path C), #33 (BFF helper factor-out moot — no BFF helpers needed).

### 9.4 Docs and stewardship — out-of-band, parallel to CHORE-C

- **Brilliant entry** (task #17) — canonical pros content (Section 7). Authored during or after CHORE-B.
- **entu-research case study** (task #16) — `$ENTU_RESEARCH/docs/case-studies/2026-05-3rd-party-frontend-on-entu.md`. Lifted from Brilliant.
- **File the Argo ask** (task #19) using Appendix A. Once Brilliant + case study give cross-reference targets.
- **RFC against entu docs** (task #18, deferred) — fires when mvox is in production + ~1 month operational evidence.

## 10. Risk inventory + mitigations

| Risk | Mitigation |
|---|---|
| OAuth callback redirect URL drift between local dev / preview / prod | Use `window.location.origin` for callback construction (entu/webapp pattern). Verify in all 3 environments during CHORE-B. |
| Stale JWT in localStorage after deploy that changes JWT shape | Add `mvox.token_version` localStorage key; bump on incompatible changes; storage helpers force-logout on mismatch. Cheap insurance. |
| MSW service worker not registering in some browsers / private mode | Playwright config explicitly bootstraps MSW per test. Fallback to `vi.mock('fetch')` if MSW init fails. |
| Login flow times out on `prompt=none` iframe (not in MVP scope) | n/a — deferred entirely. |
| User has 2 tabs, logs out in tab 1, tab 2 makes a request | tab 2's request 401s → triggers re-auth flow. Acceptable (matches entu/webapp). Storage event listener for banner could land as a YELLOW follow-up if annoying in practice. |

## 11. Rollout

Standard per session-14 deploy pipeline:

1. Land CHORE-A → deploy → verify nothing changed (smoke: `/` 200, `/auth/login` 200)
2. Land CHORE-B → deploy to preview URL → **PO live-test all OAuth providers** → merge → production deploy → verify
3. Land CHORE-C → deploy → verify (smoke + E2E specs run in CI from now on)

Each commit body lists relevant `Closes #N`.

## 12. Open scoping decision (PO call before writing-plans)

CHORE-B is the chunky one (~300-500 lines of diff, rough estimate). Default: keep as one PR (atomic, easier to deploy + revert). If review bandwidth becomes a concern during writing-plans, split into B1 (auth flow rewrite) + B2 (BFF deletion + landing rewrite) — but B1 alone leaves the landing page in a broken intermediate state, so B1 can't deploy without B2 anyway.

## 13. Deferred concerns (out of MVP, tracked separately)

### 13.1 Client-side runtime error capture — [CHORE-54](https://github.com/mvox-dev/mvox_v4e_web/issues/54)

Under Path B (today's broken architecture), data-flow errors live server-side in Cloudflare Worker code, surfacing in CF logs. Under Path C, **all data-flow errors move to the user's device.** CF Workers logs no longer see a 500 from `api.entu.app`, a parse failure in the Entu client wrapper, an unexpected `null` in a Svelte component, or a network timeout in the involuntary-re-auth flow. Once mvox has real users, we'd be production-blind without explicit client-side instrumentation.

**Fire-when triggers (sequenced AND):**
- CHORE-A + CHORE-B + CHORE-C merged and deployed
- ~1 week of production observation on Path C stability
- Before mvox is opened to real users (first non-PO sign-in)

**Scope when fired:** tool selection (Sentry / GlitchTip / homegrown), instrumentation pattern, PII filtering (strip token + email + `?key=` URL params), retention + alerting policy, performance budgets. Likely pairs with browser RUM and structured client-side telemetry as a single broader observability brainstorm.

Deferred deliberately:
- Architecture must stabilize first (no point instrumenting code we're about to delete)
- Tool choice deserves separate brainstorm (cost / GDPR / source-map / replay trade-offs)
- No users yet — filing keeps the concern visible without premature implementation

### 13.2 Other deferred items (already tracked)

- **Argo OAuth parameter passthrough ask** (task #19, Appendix A) — file post-spec-commit
- **Brilliant entry + entu-research case study + entu docs RFC** (tasks #17, #16, #18) — propagation chain for the Section 7 pros content
- **Long-session "remember me" beyond Entu's 48h** — discussed in brainstorm, accepted Entu's default. Revisit if 48h re-auth proves UX-unacceptable in user feedback.

---

## Appendix A — Argo / Entu feature request draft (to file post-spec-commit, task #19)

**Title:** Forward `login_hint` and `prompt` parameters from `/auth/<provider>` to upstream IdPs

**Body:**

> ### Context
>
> We're building [mvox](https://github.com/mvox-dev/mvox_v4e_web), a 3rd-party Entu frontend (choral music sharing webapp on the v4E schema). After hitting the BFF+IP-binding incompatibility, we're rewriting to mirror entu/webapp's browser-direct pattern. Section 5 of our auth design wants to use `login_hint` for involuntary re-auth (token expiry / IP shift), so users on Google/Apple skip the IdP's "which account?" picker on every re-auth.
>
> ### Current behavior
>
> `entu/api:routes/auth/[provider].get.js` constructs the redirect to `oauth.ee` with a fixed 5-parameter set:
>
> ```js
> const url = new URL('https://oauth.ee')
> url.pathname = `/auth/${provider}`
> url.search = new URLSearchParams({
>   client_id: oauthId,
>   redirect_uri: `${origin}${pathname}`,
>   response_type: 'code',
>   scope: 'openid',
>   state
> }).toString()
> ```
>
> Caller-supplied query parameters (other than `next`) are dropped. `login_hint` and `prompt` therefore cannot reach oauth.ee or the upstream IdP through Entu's current API.
>
> ### Request
>
> Add `login_hint` and `prompt` (specifically `prompt=none` and `prompt=select_account`) to the list of caller parameters that `/auth/<provider>` forwards to oauth.ee — and that oauth.ee then forwards to upstream IdPs where the IdP supports them.
>
> ### Why this is a small, defensible change
>
> 1. **No security cost.** `login_hint` is RFC 6749-defined as a hint, never authoritative. The IdP still authenticates the user; the hint just pre-selects an account. `prompt=none` is the standard OIDC silent-renewal mechanism; it strictly fails closed (returns error) when interaction is required, never weakens auth.
> 2. **No threat-model change to Entu.** Entu's auth still mediates everything. IP-binding still applies. Session tokens still 5-minute-bound. JWT still IP-bound + 48h.
> 3. **Direct UX benefit for 3rd-party frontends.** With involuntary re-auth (which any browser-direct frontend hits on token expiry / IP shift), users with multi-account Google/Apple don't have to re-pick the right account every 48h.
> 4. **Forward-compatible.** Frontends can include the parameter today (no-op while Entu strips it). When Entu lands the change, those frontends get the UX win without code change.
>
> ### Out of scope for this ask
>
> - Any change to oauth.ee → IdP forwarding. We assume oauth.ee already forwards standard OIDC params to the configured IdP; if it doesn't, that's a follow-up.
> - Any change to the `state` JWT payload structure. The hint travels as a separate query parameter, not bundled into state.
>
> ### Reference implementation (mvox-side, already deployed forward-compat)
>
> ```ts
> // Browser constructs the OAuth init URL with login_hint included.
> // Today: Entu strips login_hint from the outbound oauth.ee redirect.
> // After this ask: login_hint reaches the upstream IdP and skips its account picker.
> const params = new URLSearchParams({
>   next: `${window.location.origin}/auth/callback?state=${stateNonce}`,
>   login_hint: knownUserEmail,  // no-op today; activates when Entu accepts this ask
> })
> window.location.href = `${ENTU_API_BASE}auth/${provider}?${params}`
> ```
>
> Filed by mvox-dev as a follow-up to architectural rewrite CHORE-53. Cross-references entu/research case study `docs/case-studies/2026-05-3rd-party-frontend-on-entu.md`.

---

## References

- **GitHub issue:** [mvox-dev/mvox_v4e_web#53](https://github.com/mvox-dev/mvox_v4e_web/issues/53)
- **Finn research (2026-05-23 06:35):** entu/webapp model — localStorage JWT + browser-direct API + 48h auto-logout. Sources: `entu/webapp:app/utils/user.js`, `app/utils/api.js`, `app/pages/auth/[provider].vue`, `app/pages/auth/callback.vue`.
- **Finn probe (2026-05-23 07:12):** Entu OAuth parameter passthrough. Only 5 hardcoded params reach oauth.ee. Source: `entu/api:routes/auth/[provider].get.js`.
- **Memory notes:** `project_entu_jwt_ip_bound`, `project_polyphony_bff_rights_pattern` (needs revision once CHORE-B lands).
- **architecture-decisions.md sections to revise:** "BFF user-rights default (2026-05-18, session 2)", "Direct-to-Entu carve-out for IP-bound OAuth exchange (session 14)", plus the two YELLOW-50.1 / 51.1 wire-shape literals (L204).
- **Related CHOREs:** #52 (subsumed in CHORE-A), #36 (realized in CHORE-C), #39 (moot under Path C, closes in CHORE-C), #33 (moot under Path C, closes in CHORE-C).
- **Propagation chain for the pros content (Section 7):** Brilliant entry (canonical) → entu-research case study → entu docs RFC (deferred).
