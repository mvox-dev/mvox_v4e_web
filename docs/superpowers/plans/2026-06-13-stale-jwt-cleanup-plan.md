# Stale-JWT Cleanup — Implementation Plan (#89)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** `hydrateUserStore` clears a stale JWT and goes `signed-out` (not `error`) on an expired token (zero calls) or a runtime 401; non-401 failures stay loud `error`. Spec: `docs/superpowers/specs/2026-06-13-stale-jwt-cleanup-design.md`. Closes #89.

**Branch:** `fix/stale-jwt-cleanup` off main.
**Chain (single-tree, serial):** Tallis RED → Josquin GREEN → Bentham → merge → preview deploy. No i18n, no Byrd (store-layer only).

## File Map

| File | Action | Owner |
|---|---|---|
| `src/lib/auth/userStore.ts` | add `isTokenExpired` + 2 gates + no-personId clear | Josquin |
| `src/lib/auth/userStore.spec.ts` | test matrix (10 cases) | Tallis |

### Task 1: RED (Tallis)

- [ ] Add `isTokenExpired` to the import/usage surface (it's a new export from `userStore.ts` — Tallis references it in a focused boundary test). Implement nothing in `userStore.ts` yet beyond what's needed for `pnpm check` to pass: add a stub `export function isTokenExpired(_claims: EntuJwtClaims | null, _nowMs: number): boolean { throw new Error('not implemented'); }` (per L120, so resolution succeeds and tests fail on assertions).
- [ ] Boundary unit tests for `isTokenExpired`: `exp` in past → true; `exp === now` (exp*1000===nowMs) → true; `exp === now+1ms equiv` (future) → false; `claims` null → true; `exp` missing → true; `exp` non-numeric (e.g. string) → true.
- [ ] `hydrateUserStore` matrix tests (drive the REAL store via `vi.stubGlobal('fetch', …)` with explicit numeric `status` on each mock Response; assert store state + localStorage cleared/kept + fetch-call count). All 10 rows of the spec test matrix. Key cases:
  - expired token → `signed-out`, fetch NEVER called (assert call count 0), token+user+accounts removed, `mvox.last_provider` PRESERVED.
  - exp-less token → identical (guards the fail-closed NaN path).
  - no-personId token → `signed-out`, token cleared, 0 fetches.
  - future-exp + person 401 → `signed-out`, cleared, provider preserved.
  - future-exp + person 500 + member 401 → `signed-out` (sweep wins), cleared.
  - future-exp + 500 only → `error` reason contains `500`, token NOT cleared.
  - future-exp + 403 → `error`, NOT cleared.
  - happy path (far-future exp, all 200) → `ready`, 3 fetches, token KEPT (regression guard).
  - network throw → `error`, NOT cleared.
- [ ] **Audit existing fixtures:** any `makeJwt`/JWT fixture in the file lacking a future `exp` will now flip to `signed-out` under Gate 1 — fix those fixtures to carry a far-future `exp` (mechanical; document in commit).
- [ ] Targeted vitest RED for right reasons; `pnpm check` 0. Commit `test(#89): RED — stale-JWT cleanup matrix (isTokenExpired + 2 gates)` → push → handoff.

### Task 2: GREEN (Josquin)

- [ ] `userStore.ts`:
  - Implement `isTokenExpired(claims, nowMs)` per spec (fail-closed on non-numeric; `exp*1000 <= nowMs`). Reuse the already-decoded `claims` — do not re-split the token.
  - Add `clearAll` to the `./storage` import.
  - **Gate 1:** after the `personId` guard, before the `try`: `if (isTokenExpired(claims, Date.now())) { clearAll({ preserveProvider: true }); userStore.set({ status: 'signed-out' }); return; }`.
  - **Gate 2:** immediately after `Promise.all` resolves, BEFORE the per-call `!ok` blocks: the 401 `.some(...)` sweep → `clearAll({ preserveProvider: true })` + `signed-out` + return.
  - **No-personId branch:** add `clearAll({ preserveProvider: true })` before its `signed-out` set.
  - Leave per-call `!ok → error` blocks and the `try/catch` untouched.
- [ ] `pnpm vitest run src/lib/auth` GREEN; `pnpm check` 0; `pnpm build` clean.
- [ ] Commit `feat(#89): stale-JWT cleanup — exp pre-filter + runtime 401 sweep` → push → handoff.

### Task 3: REVIEW (Bentham — auth-adjacent)

- [ ] Diff `main..fix/stale-jwt-cleanup`. Checklist: exp in SECONDS (`*1000`) — no infinite-reauth loop; Gate 2 precedes per-call blocks (mixed-failure correctness); 401-only bucket (403/500 stay `error` — loud); `preserveProvider: true` on all clears (re-login UX); happy-path + no-token regression intact; `isTokenExpired` fail-closed; no new client trust surface. Note the two flagged risks (403-on-stale is an assumption; auto-reauth-on-load deferred) as YELLOW-if-relevant, not blockers. Verdict → team-lead.

### Task 4: MERGE + deploy (Josquin)

- [ ] Squash-merge: `fix(#89): stale-JWT cleanup in hydrateUserStore — expired/401 → signed-out, not error` + `Closes #89`.
- [ ] Verify main (full suite + check). Push; delete branch local+remote.
- [ ] Build + deploy preview (standard command). Report build hash → team-lead pings PO to re-load preview (expect: no console 401s on the expired-token case, clean signed-out).

(*MVOX:Palestrina*)
