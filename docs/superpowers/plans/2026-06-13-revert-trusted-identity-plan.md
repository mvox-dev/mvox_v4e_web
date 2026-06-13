# Revert trusted-identity stack — Plan

> REQUIRED SUB-SKILL: subagent-driven-development or executing-plans. Checkbox steps.

**Goal:** Restore the proven client-side login flow; remove the impossible server-exchange stack. Restores broken preview login. Spec: `docs/superpowers/specs/2026-06-13-revert-trusted-identity-design.md`. Known-good baseline: `c10f392~1` (= `7bf74aa`).

**Branch:** `fix/revert-trusted-identity` off main.
**Chain (single-tree, serial):** Tallis RED → Josquin GREEN → Bentham → merge → deploy → PO re-login. No i18n, no Byrd.

### Task 1: RED (Tallis)
- [ ] Restore `src/tests/routes/auth/oauth/callback-page-server.spec.ts` to its `c10f392~1` version: `git show c10f392~1:src/tests/routes/auth/oauth/callback-page-server.spec.ts > <that file>` (verify the path existed then; if the test lived elsewhere pre-c10f392, restore whatever the client-flow callback spec was). Client-flow assertions only.
- [ ] Delete `src/lib/server/auth/identity-cookie.spec.ts`.
- [ ] Run targeted vitest: the restored callback spec FAILS against current server-exchange code (RED — current code does the exchange, doesn't match client-flow assertions). `pnpm check` may error on the deleted identity-cookie import until Josquin removes the module — acceptable at RED, note it. Commit `test: RED — restore client-flow callback spec, drop identity-cookie tests` → push → handoff.

### Task 2: GREEN (Josquin)
- [ ] Restore `src/routes/auth/callback/+page.server.ts` to its `c10f392~1` version: `git show c10f392~1:src/routes/auth/callback/+page.server.ts` → write verbatim.
- [ ] `src/routes/auth/logout/+page.server.ts` → remove the `cookies.delete('mvox_identity', { path: '/' })` line.
- [ ] Delete `src/lib/server/auth/identity-cookie.ts`.
- [ ] `.env.example` → remove the `MVOX_SESSION_SECRET` line.
- [ ] `grep -rn "identity-cookie\|mvox_identity\|MVOX_SESSION_SECRET\|signIdentity\|verifyIdentity" src/` → fix any remaining reference to zero hits.
- [ ] Full suite + `pnpm check` + `pnpm build` green. Commit `fix: revert trusted-identity stack — restore client-side login (IP-binding makes server-exchange impossible)` → push → handoff.

### Task 3: REVIEW (Bentham)
- [ ] Verify: callback byte-matches the `c10f392~1` known-good (no server exchange, no identity cookie); logout clears only SESSION_COOKIE; identity-cookie module + spec gone; no orphan references (`grep` clean); #89 stale-JWT cleanup untouched; client `exchange.ts` untouched. Verdict → team-lead.

### Task 4: MERGE + deploy (Josquin)
- [ ] Squash `fix: revert trusted-identity stack — restore client-side login`. Verify main, push, delete branch. Build + deploy preview. Report build hash → team-lead pings PO to confirm preview login works again.

(*MVOX:Palestrina*)
