# Task List Snapshot — 2026-05-22 (end of session 14)

State at shutdown. If session 15 hits State C in Phase 2, restore the active (pending/in_progress) rows below into fresh TaskCreate IDs.

| # | Subject | Status | Owner | Notes |
|---|---|---|---|---|
| 3 | Layer 2 photo file-payload probe + impl | pending | — | Empirical probe: does Entu's POST-with-file-fields re-link to a pre-existing S3 object after DELETE of previous property value, or does it require fresh upload? Probe answer determines whether file-property rename is doable as DELETE-then-POST or requires download-via-signed-URL + re-upload. After probe: implement Layer 2 of the photo-rename cleanup with correct file-value round-trip + extend EntuProperty type (YELLOW-12.2) + widen probe-rename-photo-impact to capture all file-value fields (YELLOW-12.1). **Fires only if:** (a) someone uploads an `avatar`/`logo` instance value before Layer 2 lands, OR (b) BFF needs `_thumbnail` working on real data with uploaded files. **Status as of session 14 close:** 0 file values exist on `person.photo` or `organization.photo` in live polyphony — Layer 1 prop-def rename landed at `82727ca` (session 13); no instance work needed yet. Defer to when trigger fires. Layer 2 implementation NOT yet routed to Pérotin. |

Tasks #1, #2 closed in session 13. Tasks #4, #5, #6, #7, #8, #9 closed in session 14.

## Session-14 carryforwards as GH issues (still applicable for future sessions)

| GH # | Subject | Notes |
|---|---|---|
| #6 | CHORE-6 — Email Resend wiring | Still blocked on PO SPF + DKIM DNS records. Re-check next session start. |
| #19-#23 | ADMIN-1 through ADMIN-5 | Admin user-story backlog |
| #7-#18 | A1-D2 | User-story backlog (singer + conductor + dashboard scenarios) |
| #24 | docs: README replace | Low priority |
| #25 | CHORE-25 packageManager pin | Small chore |
| #29 | docs: CONTRIBUTING.md follow-ups | Low priority, includes YELLOW-3.2 commit-body AC bullet |
| #31 | YELLOW: relax OKLCH regex on next Tailwind upgrade | Fires on next Tailwind minor/major bump |
| #33 | YELLOW-32.1: factor BFF helpers to shared module on next route | Fires when route #3 lands |
| #34 | YELLOW-32.2: pin EntuClient.get() 403/404 throws in client.spec.ts | Tallis-owned, ~10 lines. Independent fold-in. |
| #36 | CHORE-36: E2E Entu mock harness + flip landing page to SSR consumption | Authoring convention: new BFF-consuming pages default to SSR + .skip() SSR-presence tests pending. ~1 day single PR. |
| #37 | YELLOW-35.1: i18n gap — hardcoded "members/section" in landing | Comenius, ~10 lines. Independent fold-in or with section-drill-down. |
| #38 | YELLOW-35.2 + 35.3: Svelte 5 + types cleanup (OrgEntity to types.ts + $app/state) | Byrd, small. Pairs with #33 or with next Byrd-touched feature. |
| #39 | YELLOW-35.4: lift session population to +layout.server.ts | Josquin + Tallis (specs update). Becomes RED for next authenticated route. |
| #43 | CHORE-42: Wire mvox.eu custom domain to Cloudflare Pages multivox | PO owns mvox.eu at Zone.ee (registered 2026-04-07). DNS work + CF dashboard custom-domain add. |
| #44 | CHORE-43: Migrate multivox to CF Pages Git-connected mode for auto-deploy | Delete + recreate via CF dashboard "Connect to Git" wizard. Brief outage during swap. |

## Carry-forward summary (full detail in `team-lead.md` [NEXT SESSION] section)

### Session 14 outcome summary

- ✅ **#40 Deploy pipeline** — first public deploy live at `multivox.pages.dev`. Squash `a120248`. Closed.
- ✅ **#41 OAuth wiring** — client-side exchange (IP-binding-safe), CSRF state + verification, 4 server routes + client helper + login page. Squash `a506266`. Closed.
- ✅ **#45 (41.1+41.2) bundle** — CSRF binding on /auth/cookie, ENTU_API_BASE unified constant, alias drop, client-side carve-out lift. Squash `2fa3b7b`. Closed.
- ✅ **Production hotfix `52a5fca`** — nodejs_als → nodejs_compat compatibility flag (process.env access in CF Workers).
- ✅ **#42 (40.1) TLS-lag runbook note** — Squash `c490591`. Closed.
- ✅ **#46 (45.3) arch-decisions forward-pointer** — Squash `bb12049`. Closed.
- ✅ **#47 process.env → $env/dynamic/private migration** — 5 call sites + meta-spec regression net + vitest global setup. Squash `c73b82b`. Closed.
- ✅ **#30 (CSRF gate YELLOW) backfill-closed** — satisfied by CHORE-41+45 work.

### Live state at shutdown (session 14)

- **Main:** `c73b82b` (or whichever shutdown commit is last)
- **`https://multivox.pages.dev/`** — HTTP 200, landing page from CHORE-35
- **`https://multivox.pages.dev/auth/login`** — HTTP 200, 6 provider buttons rendered (smart-id, mobile-id, id-card, google, apple, e-mail)
- **403/403 unit tests + 0 type errors**
- **Branches:** main only — all feature branches deleted post-merge
- **No outstanding stashes**

### Team composition this session

All 7 agents spawned + functioned:

- **finn** — 1 dispatch (Entu OAuth flow research for CHORE-41). Solid report with IP-binding gotcha as load-bearing finding.
- **bentham** — 5 reviews + 2 stewardship commits: (1) #40 GREEN, (2) #41 GREEN, (3) #45 GREEN, (4) #46 GREEN, (5) #47 GREEN with synthetic-violation probe verification. Plus authored `06acb25` (carve-out lift) and `1aa65c6` (45.3 stewardship note via Option A recovery from branch-flip mishap).
- **perotin** — 0 dispatches. Standing-concerns scan clean. Idle the full session (task #3 didn't fire).
- **tallis** — 4 RED dispatches: (1) #40 RED, (2) #41 RED initial (server-side; redone client-side after architecture pushback), (3) #45 RED, (4) #47 RED. One mid-session correction needed (server vs client architecture; resolved cleanly).
- **josquin** — 9 dispatches: (1) #40 GREEN, (2) #40 squash-merge, (3) project create + smoke deploy, (4) #41 GREEN server-side + ENTU_DB wrangler var, (5) #41 squash-merge, (6) #45 GREEN, (7) #45 squash-merge + production hotfix branch, (8) live deploy + hotfix re-deploy, (9) #42+#46 sequential squash-merges, (10) #47 GREEN with meta-spec path fix, (11) #47 squash-merge, (12) stash reconciliation.
- **byrd** — 1 dispatch: #41 client-side GREEN (exchange helper + callback page + login page wiring).
- **comenius** — 1 dispatch: #41 i18n on 5 keys × 3 locales (et/lv/uk).

### Process notes from session 14 (also in team-lead.md L46-L53)

- L46 — TaskUpdate(owner=X) auto-sends task_assignment; don't rotate owner through TDD chains
- L47 — Closes #N includes ALL satisfied issues
- L48 — CF Workers process.env trap (nodejs_compat or $env/dynamic/private)
- L49 — Atomic git chaining defends against shared-tree branch-flips
- L50 — CF Pages wrangler.json `vars` block locks the dashboard plaintext-vars UI
- L51 — Direct Upload mode ≠ Git-connected mode + no in-place conversion
- L52 — Meta-specs that scan source must be synthetic-violation verified
- L53 — Direct-to-Entu carve-out for IP-bound OAuth exchange

(*MVOX:Palestrina*)
