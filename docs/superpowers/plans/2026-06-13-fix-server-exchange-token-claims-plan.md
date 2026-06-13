# Fix server-exchange token-claims extraction — Plan

> REQUIRED SUB-SKILL: subagent-driven-development or executing-plans. Checkbox steps.

**Goal:** Server derives personId from the JWT token CLAIMS (`claims.accounts[db]`) — the proven client method — not the response accounts array. Spec: `docs/superpowers/specs/2026-06-13-fix-server-exchange-token-claims-design.md`.

**Branch:** `fix/server-exchange-token-claims` off main.
**Chain (single-tree, serial):** Tallis RED → Josquin GREEN → Bentham → merge → deploy → PO re-login. No i18n, no Byrd.

## Files
- `src/routes/auth/callback/+page.server.ts` (Josquin)
- `src/tests/routes/auth/oauth/callback-page-server.spec.ts` (Tallis)

### Task 1: RED (Tallis)
- [ ] Add a token-builder helper in the spec: `makeToken(accounts) = 'h.' + Buffer.from(JSON.stringify({ accounts })).toString('base64url') + '.s'`.
- [ ] Happy path: mock exchange response `{ token: makeToken({ testdb: 'person-77' }) }` (no `accounts` array needed). Assert both cookies set + `mvox_identity` verifies (real verifyIdentity) to personId `person-77`.
- [ ] `exchange_no_token`: response `{}` (no token) → that code, no cookies.
- [ ] `exchange_bad_token`: response `{ token: 'not.avalidsegment!!.x' }` (middle segment not valid base64url JSON) → `exchange_bad_token`.
- [ ] `exchange_no_claim`: `{ token: makeToken({ other_db: 'x' }) }` (claims.accounts lacks testdb) → `exchange_no_claim`.
- [ ] Keep pins: `exchange_http_401`, `identity_sign_failed`, `missing_session_token`, atomic cookie.
- [ ] Targeted vitest RED (current code reads accounts array → all token-claims paths fail correctly); `pnpm check` 0. Commit `test: RED — server exchange reads personId from token claims` → push → handoff.

### Task 2: GREEN (Josquin)
- [ ] In `+page.server.ts`, replace the accounts-array extraction with the token-claims block from the spec (token presence → decode middle segment via `Buffer.from(seg,'base64url')` → `claims.accounts[PUBLIC_ENTU_DB]`), with the three sub-codes. Keep everything else (http-status code, identity_sign_failed, atomic cookies, signing) unchanged.
- [ ] Full suite + `pnpm check` + `pnpm build` green. Commit `fix: server exchange derives personId from token claims (proven client method)` → push → handoff.

### Task 3: REVIEW (Bentham)
- [ ] Verify: claims-decode mirrors the client (`accounts[db]` dict); base64url decode correct (`Buffer.from(seg,'base64url')`, matches session-cookie.ts); trust unchanged (token from server→Entu response); sub-codes distinct + no secret in URL; atomic cookies intact. Verdict → team-lead.

### Task 4: MERGE + deploy (Josquin)
- [ ] Squash `fix: server exchange derives personId from token claims (proven client method)`. Verify main, push, delete branch. Build + deploy preview. Report build hash → team-lead pings PO for re-login.

### Task 5: Upstream-doc note (team-lead, post-merge)
- [ ] Append the token-claims-vs-accounts-array lesson to `docs/migration/findings/entu-auth-bff-docs-draft-2026-06-13.md` (direct to main).

(*MVOX:Palestrina*)
