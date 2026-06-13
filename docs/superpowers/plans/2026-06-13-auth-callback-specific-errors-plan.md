# Auth-callback specific error codes — Plan

> REQUIRED SUB-SKILL: subagent-driven-development or executing-plans. Checkbox steps.

**Goal:** Replace the single `server_exchange_failed` with distinct codes (`exchange_http_<status>`, `exchange_no_account`, `identity_sign_failed`) so the next probe login self-diagnoses A-vs-B, and the auth error surface is permanently specific. Spec: `docs/superpowers/specs/2026-06-13-auth-callback-specific-errors-design.md`.

**Branch:** `fix/auth-callback-error-codes` off main.
**Chain (single-tree, serial):** Tallis RED → Josquin GREEN → Bentham → merge → deploy. No i18n, no Byrd.

## Files
- `src/routes/auth/callback/+page.server.ts` (Josquin)
- `src/tests/routes/auth/oauth/callback-page-server.spec.ts` (Tallis) — exact path per the existing suite

### Task 1: RED (Tallis)
- [ ] Update the existing exchange-401 test to assert redirect `location` contains `error=exchange_http_401` (was `server_exchange_failed`).
- [ ] Add: exchange 200 + accounts-missing-db → `error=exchange_no_account`.
- [ ] Add: exchange 200 + valid accounts but `signIdentity` throws (mock it to reject/throw) → `error=identity_sign_failed`. (Mock the identity-cookie module's `signIdentity`.)
- [ ] Keep pins: missing `?key` → `missing_session_token`; happy path → both cookies set, no error.
- [ ] Targeted vitest RED (current code emits `server_exchange_failed` for all three → assertions fail); `pnpm check` 0. Commit `test: RED — specific auth-callback error codes` → push → handoff.

### Task 2: GREEN (Josquin)
- [ ] In `+page.server.ts`:
  - `!res.ok` branch → `throw redirect(303, \`/auth/login?error=exchange_http_${res.status}\`)` (keep the `console.error` with status).
  - no-account branch → `?error=exchange_no_account`.
  - catch-all: after re-throwing SvelteKit redirects, genuine errors → `?error=identity_sign_failed` (keep `console.error('Entu exchange error:', err)`).
- [ ] Full suite + `pnpm check` + `pnpm build` green. Commit `fix: specific auth-callback error codes (diagnostic + fail-loudly)` → push → handoff.

### Task 3: REVIEW (Bentham)
- [ ] Verify: redirects still thrown (not swallowed) — SvelteKit redirect re-throw intact in catch; no secret/internal in the URL (only numeric status + static codes); `console.error` detail retained server-side; the three branches map 1:1 to the three codes. Verdict → team-lead.

### Task 4: MERGE + deploy (Josquin)
- [ ] Squash-merge `fix: specific auth-callback error codes` (no issue number — diagnostic improvement; reference spec). Verify main, push, delete branch. Build + deploy preview. Report build hash → team-lead pings PO for one login to read the resulting `?error=` code.

(*MVOX:Palestrina*)
