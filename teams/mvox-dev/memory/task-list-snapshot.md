# Task List Snapshot — 2026-05-24 (end of session 21)

State at shutdown. If session 22 hits State C in Phase 2, restore the active rows below into fresh TaskCreate IDs.

## Active tasks at shutdown

None `in_progress`. One `pending`:
- **#1** [DEFERRED] RFC: propose Path C case study into official entu docs

All CHORE-60 phase tasks (#10-#74) are `completed`. Snapshot does NOT recreate them — they were transient session-internal IDs for executing the plan.

## Open carry-forward (pending session 22+)

| Task ID | Subject | Source / Notes |
|---|---|---|
| #1 | [DEFERRED] RFC: propose Path C case study into official entu docs | Long-tail. Lift from Brilliant entry `Patterns/entu/3rd-party-frontend-browser-direct` (KB id `06e6196e-21e1-4ed4-b77e-9ebff4740875`) + entu/research PR #50. |

If State C wipes the list at session 22, recreate as:
- TaskCreate("[DEFERRED] RFC: propose Path C case study into official entu docs", "Long-tail. Lift from Brilliant entry 06e6196e... + entu/research PR #50.")

## Open GH issues — priority for session 22

| GH # | Subject | Notes |
|---|---|---|
| **#64** | **mvox.eu wiring: replace apex A/AAAA records with CNAME → multivox.pages.dev** | **PO action** (CF dashboard, 5 steps, ~30s). Unblocks shipping mvox.eu as live URL. Full diagnosis + recipe in issue body. |
| **#62** | **CHORE: i18n keys missing for MvoxNav tab labels + LIBRARIAN chip** | Coordinated chain: Comenius (6 keys × 4 locales) + Byrd (wire) + Tallis (spec touch-up). ~30 min. |
| **#63** | **CHORE: textSnippet helper emits Svelte warning (single-element render contract)** | One-line fix in src/tests/snippet-helpers.ts: wrap text in `<span>${text}</span>`. |
| #54 | CHORE-54 — Client-side runtime error capture (deferred) | Fires before mvox opens to real users |
| #6 | CHORE-6 — Email Resend wiring | Still blocked on PO SPF + DKIM DNS records |
| #7-#23 | A1-D2 user stories + ADMIN-1-5 | Backlog |
| #31 | YELLOW: relax OKLCH regex on next Tailwind upgrade | Fires on next Tailwind minor/major bump |
| #36 | CHORE-36: E2E Entu mock harness + flip landing to SSR | Closes in CHORE-C (MSW + Playwright bootstrap) |
| #38 | YELLOW-35.2 + 35.3: Svelte 5 + types cleanup | Survives Path C |
| #39 | YELLOW-35.4: lift session population to +layout.server.ts | **Effectively obsolete** — Path C has no server-side session |
| #33 | YELLOW-32.1: BFF helper factor-out | **Obsolete** — BFF data routes deleted in CHORE-B |
| #43 | CHORE-42: Wire mvox.eu custom domain | **CLOSED end-of-session-19** (but actually still pending per #64) |
| #44 | CHORE-43: Migrate multivox to CF Pages Git-connected | Independent |
| #48 | CHORE-48: ESLint + Biome linting setup (parent) | Stays open until CHORE-49 sub-rule cycles complete |
| #49 | CHORE-49: Incremental Biome lint rule enablement (5 sub-cycles) | Filed but no urgency |
| #59 | Production verify: deferred providers (mobile-id + id-card + apple) | Scheduled routine `trig_014xDo7ZTuzNLpBUuWdtEs32` fires 2026-05-30T09:00:00Z |
| **#60** | **CHORE-60: Convert Claude Design librarian bundle to Svelte 5 source** | **CLOSED end-of-session-21** (ab6dcc5 merged) |

## Stewardship items parked

- Brilliant KB deferred-updates queue from session 20 (lessons L90-L95) — unchanged from session-20 snapshot
- Brilliant KB deferred-updates queue from session 21 (lessons L96-L103) — new this session; see team-lead.md [NEXT SESSION] seed
- 3 TODO et/lv/uk markers for `library_overdue_marginalia` — PO copy decision

## Session 21 outcome summary

### Closed via PR / push this session

- ✅ **CHORE-60 shipped end-to-end.** Squash commit `ab6dcc5` on main. 31 plan tasks delivered across 33 actual commits on `feat/library-page-ui-kit` (extra commits = Snippet typing fix + YELLOW-A/D fold-ins). Closes GH #60. Live at multivox.pages.dev.
- ✅ **Architecture correction mid-branch.** Margin/PaperStack/DeskSurface/PaperCard children typing flipped from `() => string` → canonical `Snippet` + `{@render}`. Bentham architectural verdict `[ARCH-VERDICT 2026-05-24 CHORE-60]`.
- ✅ **3 GH issues filed** for carry-forward YELLOWs (#62, #63, #64).

### Live state at shutdown

- **Main:** `ab6dcc5` (origin/main matches)
- **Production:** `multivox.pages.dev` 200 on all routes (fresh build); `mvox.eu` stale (Dec 2025 build, /library + /auth/login → 404) pending PO DNS fix per #64
- **Polyphony Entu db:** unchanged from session 20 (607 librarian-bundle entities under EFK Library `6a12036c4ff8277cd4306b26`)
- **Tests:** 436/436 unit (was 361 baseline; +75 new in CHORE-60); check 0; lint clean; build clean. 12 pre-existing Playwright failures (verified identical on main before merge)
- **Brilliant KB:** 270 entries (unchanged this session — KB updates deferred)
- **Stale local branches:** `chore/per-commit-green-arch-decision`, `chore/seed-librarian-bundle`, `feat/phase-b-live-wiring` (unchanged housekeeping candidates)
- **Stale remote branches:** `origin/feat/phase-a-migration`, `origin/fix/phase-a-partial-failure-recovery`

### Team composition this session

- **palestrina (me)** — coordinator; final-step GH issue filing + #60 closure comment
- **finn** — always-on; dispatched once (Task #73: mvox.eu CF wiring probe)
- **bentham** — always-on; dispatched once (Task #68: branch-level review) + earlier ARCH-VERDICT mid-branch
- **josquin** — dispatched for: Task #10 branch+dep, Task #14 GREEN library types, Task #16 GREEN fixtures+derive, Task #63 typing-fix, Task #71 merge, Task #72 deploy, Task #74 DNS rebind (blocked on token scope)
- **tallis** — RED phase for every component task (Tasks #11, #13, #15, #17, #19, #21, #23, #25, #27, #29, #31, #33, #35, #37, #39, #41, #43, #45, #47, #49, #51, #53, #55, #57, #60) + Task #62 typing-fix RED + Task #67 final verification
- **byrd** — GREEN phase for every component + page task (Tasks #12, #14 GREEN, #16 GREEN, #18, #20, #22, #24, #26, #28, #30, #32, #34, #36, #38, #40, #42, #44, #46, #48, #50, #52, #54, #56, #58, #59 layout, #61 page, #63 typing-fix, #65 login, #66 logout)
- **comenius** — spawned mid-session (Phase 4 i18n); dispatched for Task #64 i18n keys, Task #69 YELLOW-A wiring, Task #70 YELLOW-D split
- **victoria, perotin** — not spawned this session

### Process lessons (L96-L103; all in team-lead.md)

- L96 — `isolation: "worktree"` parameter doesn't combine with `team_name` on Agent
- L97 — Convention errors propagate fast in a chain (Margin precedent → 4-component fix)
- L98 — createRawSnippet requires single-element HTML render output (Bentham-on-Bentham)
- L99 — Tallis indent + biome arrow-paren style codified mid-session
- L100 — i18n key tasks must precede consuming-page tasks within a feature branch
- L101 — Hardcoded English in newly-created .svelte gets Bentham YELLOW when matching keys exist
- L102 — Pages custom-domain binding can sit `status: pending` indefinitely if apex CNAME never created
- L103 — Token-scope mismatch is a real workflow blocker (Pages-only token can't do DNS work)

(*MVOX:Palestrina*)
