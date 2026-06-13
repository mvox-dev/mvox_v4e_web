# Fix server-exchange accounts shape — Plan

> REQUIRED SUB-SKILL: subagent-driven-development or executing-plans. Checkbox steps.

**Goal:** Server-side OAuth exchange extracts personId from the response `accounts` ARRAY (probed shape), not a db-keyed object. Unblocks trusted-identity → slice-2b. Spec: `docs/superpowers/specs/2026-06-13-fix-server-exchange-accounts-shape-design.md`.

**Branch:** `fix/server-exchange-accounts-shape` off main.
**Chain (single-tree, serial):** Tallis RED → Josquin GREEN → Bentham → merge → deploy → PO re-login. No i18n, no Byrd.

## Files
- `src/routes/auth/callback/+page.server.ts` (Josquin)
- `src/tests/routes/auth/oauth/callback-page-server.spec.ts` (Tallis)
- optionally `src/lib/auth/storage.ts` (`EntuAccount` += optional `user`) (Josquin, if shared type used)

### Task 1: RED (Tallis)
Rewrite the callback exchange mocks to the PROBED array shape (the current object-shape mocks are the bug's accomplice):
- [ ] Happy path: mock exchange response `{ accounts: [{ _id: 'testdb', name: 'testdb', user: { _id: 'person-77' } }], token: 'tok' }`. Assert: both cookies set; `mvox_identity` verifies (real `verifyIdentity`) to `personId === 'person-77'`. (`cfg.db` in these tests is `testdb`.)
- [ ] `exchange_no_account`: response `{ accounts: [{ _id: 'other_db', user: { _id: 'x' } }] }` (no matching db) → redirect `error=exchange_no_account`, no cookies.
- [ ] empty accounts: `{ accounts: [] }` → `exchange_no_account`.
- [ ] Keep pins: `exchange_http_401` (res.ok false), `identity_sign_failed` (signIdentity throws), `missing_session_token` (no key), atomic-cookie (signing throw → neither cookie).
- [ ] Targeted vitest RED — current code does `data.accounts[db]` on the array → undefined → happy path now redirects to `exchange_no_account` instead of setting cookies → assertions fail correctly. `pnpm check` 0. Commit `test: RED — server exchange reads accounts array (probed shape)` → push → handoff.

### Task 2: GREEN (Josquin)
- [ ] In `+page.server.ts`, change the extraction to:
  ```ts
  const data = (await res.json()) as { accounts?: Array<{ _id: string; user?: { _id: string } }> };
  const pid = data.accounts?.find((a) => a._id === PUBLIC_ENTU_DB)?.user?._id;
  ```
  Keep the `!pid → exchange_no_account` guard, the signing, and atomic cookie writes unchanged.
- [ ] (Optional) extend `EntuAccount` in `storage.ts` with `user?: { _id: string; name?: string }` and reuse it for the cast, rather than an inline type — cleaner. Update `exchange.ts` only if it improves type-sharing; do not change client behavior.
- [ ] Full suite + `pnpm check` + `pnpm build` green. Commit `fix: server exchange reads personId from accounts array (probed wire shape)` → push → handoff.

### Task 3: REVIEW (Bentham)
- [ ] Verify: extraction matches the probed shape (`accounts[].user._id` by `_id===db`); trust unchanged (personId still derived from the server→Entu response, not client input); no shape regression to client `exchange.ts`; mocks now use the real array shape (no fabricated object). Verdict → team-lead.

### Task 4: MERGE + deploy (Josquin)
- [ ] Squash `fix: server exchange reads personId from accounts array (probed wire shape)`. Verify main, push, delete branch. Build + deploy preview. Report build hash → team-lead pings PO for re-login.

(*MVOX:Palestrina*)
