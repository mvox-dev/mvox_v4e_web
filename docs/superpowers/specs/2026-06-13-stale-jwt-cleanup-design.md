# Stale-JWT cleanup in hydrateUserStore

**Status:** APPROVED (team-lead, 2026-06-13). Design hardened via ultracode workflow (3 design lenses → synthesize → 3 adversarial refuters → finalize; 10 holes incorporated), then claims verified against live code by team-lead.
**Trigger:** PO observed 3 console 401s + an `error` store state on first load with a days-old localStorage JWT.

## Root cause

`hydrateUserStore()` (`src/lib/auth/userStore.ts`) decodes the JWT for `personId` but **never checks `exp`**, then fires 3 authenticated Entu calls. A stale token (expired, or IP-bound-invalid) → 3× 401 → store lands in `status: 'error'`. An expired session is an *expected* condition, not an error.

**Precedent:** `src/lib/api/wrapper.ts:44` already does exactly the right thing for API calls — on 401, `clearAll({ preserveProvider: true })` + reauth (tested, `wrapper.spec.ts:108`). `hydrateUserStore` bypasses that wrapper with raw `fetch`, so it never inherited the behavior. This fix brings the cleanup half of that pattern to the hydration path.

## Design — two gates

Verified-real primitives: `clearAll({ preserveProvider: boolean })` (`storage.ts:87`), `EntuJwtClaims.exp: number` (`types.ts:57`, typed required).

### Gate 1 — exp pre-filter (before any fetch)

New exported pure helper near `decodeJwt`:

```ts
export function isTokenExpired(claims: EntuJwtClaims | null, nowMs: number): boolean {
	const exp = claims?.exp;
	if (typeof exp !== 'number') return true; // fail-closed: missing/NaN exp = treat as expired
	return exp * 1000 <= nowMs;               // exp is SECONDS — *1000 (mirrors decodeJwtExpMs)
}
```

In `hydrateUserStore`, immediately after `personId` is resolved (and `claims` is known non-null) and **before** the `try`/`Promise.all`:

```ts
if (isTokenExpired(claims, Date.now())) {
	clearAll({ preserveProvider: true });
	userStore.set({ status: 'signed-out' });
	return;
}
```

Expired/exp-less token → **zero Entu calls fired** → zero console 401s. This is the PO's reported case (days-old token = expired).

### Gate 2 — runtime 401 sweep (after Promise.all, before the per-call `!ok` blocks)

A token with a *future* exp can still be IP-stale/revoked and 401 at runtime — exp can't catch it. Insert **before** the existing per-call `if (!personRes.ok)` blocks:

```ts
if ([personRes, memberRes, ownerRes].some((r) => r.status === 401)) {
	clearAll({ preserveProvider: true });
	userStore.set({ status: 'signed-out' });
	return;
}
```

**Ordering is load-bearing** (adversarial refuter finding): the sweep MUST precede the per-call `!ok` blocks. Otherwise, in a mixed failure (e.g. person=500 + member=401) the first per-call block returns `error` and the dead token survives in localStorage.

**401-only, not 403** (deliberate, memory-backed): Entu rejects stale tokens with 401; its positive-only rights model (`project_entu_no_noaccess`) makes 403-on-stale unlikely, and a genuine 403 is an authorization condition that must surface loudly as `error`. *Risk flagged:* if Entu is later observed to 403 on stale tokens, this silently regresses to `error` for that case — needs a live probe, not an assumption. Not blocking this fix.

### Unchanged (goal: keep `error` loud for real failures)

- The per-call `!ok → error` blocks stay. After the sweep, they only fire for non-401 (500 / 403 / unexpected) → `error` preserved with the existing `<which> fetch <status>` reason.
- The `try/catch` network path stays → `error`. Token NOT cleared (token may be valid; transient outage).
- No-token path unchanged (`signed-out`, nothing to clear).
- **Minor consistency add:** the no-`personId` branch (token decodes but no account for `PUBLIC_ENTU_DB`) currently does NOT clear the token. Add `clearAll({ preserveProvider: true })` there too — a token with no account for our db is not a usable session. Trivial, correct.

## Scope decision (team-lead, act-and-report)

The hardened design proposed an additional `routeToReauth()` auto-navigation on both gates. **Trimmed.** `hydrateUserStore` runs on *every* page load; auto-routing a stale-token visitor off the public landing page to an OAuth provider overreaches the reported bug. The signed-out homepage already offers sign-in. The `wrapper.ts` reauth precedent is triggered by a deliberate API call, not unconditional load — a meaningfully different trigger. **Auto-reauth-on-load is a clean follow-up if PO wants it; not in this fix.**

## Test matrix (drives Tallis RED — full-shape, drive the real store)

| Case | store state | token cleared? | # fetches |
|---|---|---|---|
| no token | signed-out | n/a | 0 |
| exp in past | signed-out | yes (preserve provider) | 0 |
| exp missing/non-numeric | signed-out | yes | 0 |
| token decodes, no personId for db | signed-out | yes (new) | 0 |
| valid future exp, all 200 | ready | no | 3 |
| future exp, any 401 | signed-out | yes (provider preserved) | 3 |
| future exp, mixed 500+401 | signed-out (sweep wins) | yes | 3 |
| future exp, 500 only | error (`… fetch 500`) | no | 3 |
| future exp, 403 | error | no | 3 |
| fetch throws (network) | error | no | (throws) |

Boundary: `exp * 1000 === now` → expired (matches `isSessionValid`'s strictly-future semantics).

## Test risks (for Tallis)

- Mock Response objects need an explicit **numeric `status`** (sweep reads `r.status === 401`), not just `ok: false`.
- Audit every existing `makeJwt(...)`/fixture in `userStore.spec.ts`: any test JWT lacking `exp` now flips to `signed-out` under Gate 1. The happy-path fixture already uses a far-future `exp` (safe); others must be checked.

## Out of scope

Auto-reauth-on-load navigation (follow-up); the no-personId-path was minimally extended only to clear the token; no change to `wrapper.ts` or the API path.

**Chain (single-tree):** spec+plan to main → `fix/stale-jwt-cleanup` → fresh Tallis RED → Josquin GREEN → Bentham → merge → preview deploy. No i18n (no new strings), no Byrd (no UI — store-layer only).

(*MVOX:Palestrina*)
