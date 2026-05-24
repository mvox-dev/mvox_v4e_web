# Task List Snapshot — 2026-05-24 (end of session 23)

State at shutdown. If session 24 hits State C in Phase 2, restore the active rows below into fresh TaskCreate IDs.

## Active tasks at shutdown

None `in_progress`. None `pending`.

The harness wiped the session-23 work tasks (#1-#8 for CHORE-67/#68 chain) mid-session — confirmed by `TaskList` returning empty after Josquin's spawn. Cosmetic only; CHORE-67/#68 actually shipped at `2012a84` via the work itself, independent of the task list.

## Open carry-forward (pending session 24+)

| Task ID | Subject | Source / Notes |
|---|---|---|

(empty — all carry-forward work is tracked via GH issues + the CHORE-67 plan document)

If State C wipes the list at session 24, no local recreations needed.

## Open GH issues — priority for session 24

| GH # | Subject | Notes |
|---|---|---|
| **#65** | CHORE: MvoxNav chip width on long locale renderings (narrow viewport) | ~15 min Byrd. Layout-only fix for ET `RAAMATUKOGUHOIDJA` (17 chars). Defer until narrow-viewport support is a requirement. |
| **#69** | CHORE: Remove dead ENTU_DB from wrangler.json vars (post-#67) | ~1 min cleanup. Sibling of #70 — land AFTER #70 (otherwise #70 breaks). |
| **#70** | CHORE: Migrate auth callback +page.server.ts from legacy ENTU_DB to PUBLIC_ENTU_DB | ~15 min Josquin. Sibling of #69. Both touch the legacy `env.ENTU_DB` lookup; coordinate. |
| **#71** | CHORE: /library over-fetches all orgs ignoring user-rights (CHORE-67 prereq) | Subsumed by CHORE-67. Close manually when CHORE-67 lands. |
| #54 | CHORE-54 — Client-side runtime error capture (deferred) | Fires before mvox opens to real users |
| #6 | CHORE-6 — Email Resend wiring | Still blocked on PO SPF + DKIM DNS records |
| #7-#23 | A1-D2 user stories + ADMIN-1-5 | Backlog |
| #31 | YELLOW: relax OKLCH regex on next Tailwind upgrade | Fires on next Tailwind minor/major bump |
| #33 | YELLOW-32.1: BFF helper factor-out | **Obsolete** — BFF data routes deleted in CHORE-B |
| #36 | CHORE-36: E2E Entu mock harness + flip landing to SSR | Closes in CHORE-C (MSW + Playwright bootstrap) |
| #38 | YELLOW-35.2 + 35.3: Svelte 5 + types cleanup | `$app/stores` → `$app/state` lift partially done; audit remaining sites |
| #39 | YELLOW-35.4: lift session population to +layout.server.ts | **Effectively obsolete** — Path C has no server-side session |
| #44 | CHORE-43: Migrate multivox to CF Pages Git-connected | Worth resolving — would enable push-to-deploy. Reinforced L116. |
| #48 | CHORE-48: ESLint + Biome linting setup (parent) | Stays open until CHORE-49 sub-rule cycles complete |
| #49 | CHORE-49: Incremental Biome lint rule enablement (5 sub-cycles) | Filed but no urgency |
| #59 | Production verify: deferred providers (mobile-id + id-card + apple) | Scheduled routine `trig_014xDo7ZTuzNLpBUuWdtEs32` fires 2026-05-30T09:00:00Z |

## Open plans + specs

- `docs/superpowers/specs/2026-05-24-chore-67-library-real-data-design.md` — design landed `8a0177f`
- `docs/superpowers/plans/2026-05-24-chore-67-library-real-data-plan.md` — implementation plan landed `dd65a8c` (22 tasks). Team-driven TDD chain. Ready to dispatch Task 1 at session-24 open.
- `docs/superpowers/plans/2026-05-23-chore-53-c-test-infra.md` — CHORE-C plan still ready from session 18 (9 tasks, MSW + Playwright bootstrap)

## Stewardship items parked

- Brilliant KB deferred-updates queue from session 23 (lessons L113-L116) — see team-lead.md [NEXT SESSION] seed
- Brilliant KB deferred-updates queue from session 22 (L104-L112) — still parked from prior sessions

## Session 23 outcome summary

### Closed via push this session

- ✅ **CHORE-67 + CHORE-68 shipped.** Squash `2012a84` on main. ENTU_DB env-lift + founder-as-org-affiliation union via `_owner.reference` query. 471 tests pass. Closes GH #67 + #68.
- ✅ **Wrangler deploy live.** Build chunks rotated `app.Bpbjc7CB.js` → `app.CQqMPJyM.js` on multivox.pages.dev + mvox.eu. PO confirmed navbar hydrates with 6 founder orgs + "Mihkel Putrinš" after clearing stale Maire JWT.
- ✅ **CHORE-67 brainstorm + spec + plan landed.** Visual companion through 6 iterations (v1→v6). Spec `8a0177f` (318 lines). Plan `dd65a8c` (2097 lines, 22 tasks). Locked: Option B master-detail, wood-grain desk dominates, no scrollbars.
- ✅ **3 follow-up GH issues filed.** #69 + #70 (sibling cleanups post-#67), #71 (over-fetch from /library; subsumed by CHORE-67).
- ✅ **L113 process lesson codified.** `feedback_plan_execution_mode_baked_in` memory + MEMORY.md updated.

### Live state at shutdown

- **Main:** `dd65a8c` (origin matches)
- **Production:** `multivox.pages.dev` + `mvox.eu` both 200 with CHORE-67/#68 build live; navbar verified hydrated by PO
- **Polyphony Entu db:** unchanged (607 librarian-bundle entities under EFK Library `6a12036c4ff8277cd4306b26`)
- **Tests:** ~471/471 unit; check 0; lint clean; build clean. Playwright 12 pre-existing failures (CHORE-C scope, unchanged)
- **Brilliant KB:** 281 entries (unchanged this session)
- **Stale config entries:** `byrd` (reused successfully this session). Cleanup at next TeamCreate.

### Team composition this session

- **palestrina (me)** — coordinator; CHORE-67/#68 dispatch + closeout; CHORE-67 brainstorm + spec + plan author; debug-routing for the navbar hydration issue
- **finn** — always-on; CHORE-67 brainstorm research (/library structure scan); navbar source-grep for "Maire L."
- **bentham** — always-on; CHORE-67/#68 branch review with YELLOW (merge-main-first call); two scratchpad commits
- **josquin** — squash-merge CHORE-67/#68 (`2012a84`); wrangler deploy to multivox.pages.dev; no source-code work
- **tallis** — RED specs for #67 + #68 (SHAs `5aa903e` + `e08ce06`); biome-conformant style
- **byrd** — GREEN for #67 + #68 (SHAs `9589076` + `3ba5ecf`); fixed spec fixture mechanically; bonus catch on `tests/setup.ts` cleanup gotcha from prior session
- **comenius** — not spawned this session (CHORE-67/#68 had no user-facing strings; CHORE-67 brainstorm queued i18n work for session-24 Task 3)
- **perotin** — always-on; supplied founder-test-persona IDs from cache (no live probe); standing concerns scan reported clean
- **victoria** — not spawned this session

### Process lessons (L113-L116; all in team-lead.md)

- L113 — Implementation plan execution mode is baked in (codified as `feedback_plan_execution_mode_baked_in`)
- L114 — Visual companion design synthesis works when consuming locked-design primitives (read Claude Design JSX BEFORE mocking)
- L115 — Stale JWT in localStorage masquerades as broken hydration (Maire JWT lingering after CHORE-66 dev testing)
- L116 — CF Pages auto-deploy is not configured (GH #44 still open) — manual wrangler deploy required after every main push

(*MVOX:Palestrina*)
