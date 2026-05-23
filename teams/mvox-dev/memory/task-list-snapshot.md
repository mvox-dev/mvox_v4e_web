# Task List Snapshot — 2026-05-23 (recovery shutdown, mid-session-19)

State at recovery /clear. If session 20 hits State C in Phase 2, restore the active rows below into fresh TaskCreate IDs.

## Active tasks at shutdown

None `in_progress`. Two `pending`:
- **#18** [DEFERRED] RFC: propose Path C case study into official entu docs
- **#61** CHORE-60 dispatch (after bundle returns from PO) — **bundle has landed** (`docs/design/inbox/2026-05-23-librarian/bundle/mvox.eu-handoff.zip`, 225KB), so #61 is unblocked at session-20 open

Everything else (60 tasks) is `completed`. Notably finished in the post-session-18-bundle window:
- **#16** Write entu/research case study: 3rd-party frontend on Entu (entu/research PR #50, 454 lines — verify merge state at session 20)
- **#17** Write Brilliant KB pattern: Entu browser-direct frontend (KB id `06e6196e-21e1-4ed4-b77e-9ebff4740875`, v2 with empty-list-POST correction)
- **#19** File Argo ask: pass through login_hint + prompt to upstream IdPs (filed)
- **#59** Pérotin: Entu file-property POST wire-shape probe (commits `ac1dcc5` + `6517b47` + `f6704f6`)

## Open carry-forward (pending session 20+)

| Task ID | Subject | Source / Notes |
|---|---|---|
| #18 | [DEFERRED] RFC: propose Path C case study into official entu docs | Long-tail. Lifts from Brilliant entry + entu/research PR #50 content. |
| #61 | CHORE-60 dispatch (after bundle returns from PO) | **UNBLOCKED.** Bundle at `docs/design/inbox/2026-05-23-librarian/bundle/mvox.eu-handoff.zip` (PO uploaded `1db5ac2` on 2026-05-23 17:52Z). Inbox README pre-stages context for fresh Claude Code session. |

If State C wipes the list at session 20, recreate as:
- TaskCreate("[DEFERRED] RFC: propose Path C case study into official entu docs", "Long-tail. Lift from Brilliant entry 06e6196e... + entu/research PR #50.")
- TaskCreate("CHORE-60 dispatch — Convert Claude Design librarian bundle to Svelte 5", "Bundle in place at docs/design/inbox/2026-05-23-librarian/bundle/mvox.eu-handoff.zip. New session per inbox README. writing-plans → TDD chain.")

## Open GH issues — priority for session 20

| GH # | Subject | Notes |
|---|---|---|
| **#60** | **CHORE-60: Convert Claude Design librarian bundle to Svelte 5 source** | **UNBLOCKED** as of bundle landing (commit `1db5ac2`, 2026-05-23 17:52Z). Probable session-20 headline. |
| #54 | CHORE-54 — Client-side runtime error capture (deferred) | Path C is stable in production; fires before mvox opens to real users |
| #3 | Layer 2 photo file-payload probe + impl | **Effectively closed in spirit** — Pérotin probe (session 18) verified wire shape empirically. Implementation pending (under CHORE-60's photo-upload-control component or separate CHORE). Can close at session 20 if PO agrees. |
| #6 | CHORE-6 — Email Resend wiring | Still blocked on PO SPF + DKIM DNS records |
| #7-#23 | A1-D2 user stories + ADMIN-1-5 | Backlog — defer until CHORE-60 + CHORE-C ship + UI system is established |
| #31 | YELLOW: relax OKLCH regex on next Tailwind upgrade | Fires on next Tailwind minor/major bump |
| #36 | CHORE-36: E2E Entu mock harness + flip landing to SSR | Closes in CHORE-C (MSW + Playwright bootstrap) |
| #38 | YELLOW-35.2 + 35.3: Svelte 5 + types cleanup | Survives Path C. Independent fold-in or with next Byrd touch |
| #39 | YELLOW-35.4: lift session population to +layout.server.ts | **Effectively obsolete** — Path C has no server-side session. Close at session 20 |
| #33 | YELLOW-32.1: BFF helper factor-out | **Obsolete** — BFF data routes deleted in CHORE-B. Close at session 20 |
| #43 | CHORE-42: Wire mvox.eu custom domain | Independent. PO DNS work |
| #44 | CHORE-43: Migrate multivox to CF Pages Git-connected | Independent. Brief outage during swap |
| #48 | CHORE-48: ESLint + Biome linting setup (parent) | Stays open until CHORE-49 sub-rule cycles complete |
| #49 | CHORE-49: Incremental Biome lint rule enablement (5 sub-cycles) | Filed but no urgency |
| #59 | Production verify: deferred providers (mobile-id + id-card + apple) | Scheduled routine `trig_014xDo7ZTuzNLpBUuWdtEs32` fires 2026-05-30T09:00:00Z |

## Stewardship items parked

- (none — Bentham's per-commit-GREEN lift landed in the post-bundle window, `aaac286`)

## Recovery-shutdown outcome summary

### Closed in the post-session-18-bundle window (before /clear)
- ✅ `aaac286` — per-commit-GREEN lift to settled architecture-decisions
- ✅ `f94f37e` + `2a8c08f` — Brilliant entry trail (KB id `06e6196e...`), v2 with empty-list-POST correction
- ✅ entu/research PR #50 — 454-line case study (verify merge state at session 20)
- ✅ Tasks #16 + #17 marked completed in harness task list

### Closed in recovery shutdown bundle
- ✅ Finn's research-org [CHECKPOINT] in `teams/mvox-dev/memory/finn.md` — committed
- ✅ Refreshed [NEXT SESSION] seed in `team-lead.md` reflecting actual disk state
- ✅ Refreshed this snapshot

### Live state at recovery shutdown
- **Main:** `2a8c08f` + recovery shutdown bundle commit
- **Production:** unchanged from session 17 (`a9c9ad88.multivox.pages.dev`, alias `multivox.pages.dev`); 200/200 on `/` + `/auth/login`
- **Polyphony Entu db:** unchanged from session 18 (1 orphan S3 object remains in DigitalOcean Spaces, 70 bytes, no impact)
- **Tests:** unchanged from session 17 (vitest 361/361, check 0, lint 0, build clean; Playwright 11 pre-existing failures)
- **Scheduled routine:** `trig_014xDo7ZTuzNLpBUuWdtEs32` next_run_at 2026-05-30T09:00:00Z (unchanged)

### Team composition at recovery
- **finn** + **bentham** — registered in config.json from session 18; **process state killed by /clear**. Spawn fresh at session 20.
- **perotin, comenius, victoria, tallis, byrd, josquin** — not registered; spawn on demand.

### Process lesson (also in `team-lead.md` as L82)
- L82 — /clear is recoverable: disk survives, agents die, conversation context is gone. Refresh seed + snapshot from disk evidence; commit uncommitted scratchpads; push. Skip shutdown_requests (no live agents).

(*MVOX:Palestrina*)
