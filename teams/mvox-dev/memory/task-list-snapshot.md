# Task List Snapshot — 2026-05-24 (end of session 20)

State at shutdown. If session 21 hits State C in Phase 2, restore the active rows below into fresh TaskCreate IDs.

## Active tasks at shutdown

None `in_progress`. One `pending`:
- **#1** [DEFERRED] RFC: propose Path C case study into official entu docs

All CHORE-60 phase tasks (#3-#9) were created early in session 20, then deleted when PO called rollback after the chaotic first execution attempt. They are not active.

## Open carry-forward (pending session 21+)

| Task ID | Subject | Source / Notes |
|---|---|---|
| #1 | [DEFERRED] RFC: propose Path C case study into official entu docs | Long-tail. Lift from Brilliant entry `Patterns/entu/3rd-party-frontend-browser-direct` (KB id `06e6196e-21e1-4ed4-b77e-9ebff4740875`) + entu/research PR #50. |

If State C wipes the list at session 21, recreate as:
- TaskCreate("[DEFERRED] RFC: propose Path C case study into official entu docs", "Long-tail. Lift from Brilliant entry 06e6196e... + entu/research PR #50.")

## Open GH issues — priority for session 21

| GH # | Subject | Notes |
|---|---|---|
| **#60** | **CHORE-60: Convert Claude Design librarian bundle to Svelte 5 source** | Plan ready at `docs/superpowers/plans/2026-05-23-library-page-ui-kit.md`. First-attempt rolled back session 20; execution mode is the open question for session 21 (team-driven via TDD chain vs hardened subagent-driven vs defer). |
| #54 | CHORE-54 — Client-side runtime error capture (deferred) | Path C is stable in production; fires before mvox opens to real users |
| #3 | Layer 2 photo file-payload probe + impl | **Effectively closed in spirit** — Pérotin probe (session 18) verified wire shape empirically. Can close at session 21 if PO agrees. |
| #6 | CHORE-6 — Email Resend wiring | Still blocked on PO SPF + DKIM DNS records |
| #7-#23 | A1-D2 user stories + ADMIN-1-5 | Backlog — defer until CHORE-60 + CHORE-C ship + UI system is established |
| #31 | YELLOW: relax OKLCH regex on next Tailwind upgrade | Fires on next Tailwind minor/major bump |
| #36 | CHORE-36: E2E Entu mock harness + flip landing to SSR | Closes in CHORE-C (MSW + Playwright bootstrap) |
| #38 | YELLOW-35.2 + 35.3: Svelte 5 + types cleanup | Survives Path C. Independent fold-in or with next Byrd touch |
| #39 | YELLOW-35.4: lift session population to +layout.server.ts | **Effectively obsolete** — Path C has no server-side session. Close at session 21 |
| #33 | YELLOW-32.1: BFF helper factor-out | **Obsolete** — BFF data routes deleted in CHORE-B. Close at session 21 |
| #43 | CHORE-42: Wire mvox.eu custom domain | **CLOSED end-of-session-19** (mvox.eu fully wired in production) |
| #44 | CHORE-43: Migrate multivox to CF Pages Git-connected | Independent. Brief outage during swap |
| #48 | CHORE-48: ESLint + Biome linting setup (parent) | Stays open until CHORE-49 sub-rule cycles complete |
| #49 | CHORE-49: Incremental Biome lint rule enablement (5 sub-cycles) | Filed but no urgency |
| #59 | Production verify: deferred providers (mobile-id + id-card + apple) | Scheduled routine `trig_014xDo7ZTuzNLpBUuWdtEs32` fires 2026-05-30T09:00:00Z |

## Stewardship items parked

- Brilliant KB deferred-updates queue from session 20 (lessons L90-L95):
  - New: `Patterns/codifying-a-pattern-doesnt-mean-applying-it`
  - New: `Patterns/team-mode-vs-subagent-mode-clarification`
  - New: `Patterns/pre-existing-lint-debt-surfaces-on-new-worktree`
  - Update: `Patterns/worktree-isolation-for-coding-agents` (caveat)
  - Update: `Projects/mvox` (note CHORE-60 first-attempt rollback)
  See team-lead.md [NEXT SESSION] seed for full content.

## Session 20 outcome summary

### Closed via PR / push this session

- ✅ Brilliant KB backlog clearance: 24 entries (21 patterns + 2 decisions + Projects/mvox refresh v1→v2) + 10 typed cross-links. All via `submit_staging` Tier-1 auto-approve. KB went 246 → 270.
- ✅ Pre-existing main lint debt cleanup: `dcf5051` (lint:fix on Pérotin's session-19 seed + probe scripts, pure autofix) + `2a782c0` (ESLint config ignore `.claude/**`).
- ❌ CHORE-60 first execution attempt: Task 1 + Task 2 implementer subagents landed commits on the feature branch, but the path was chaotic enough that PO called rollback. Branch + worktree deleted; both commits discarded. Plan unchanged.

### Bonus / process work this session

- Documented 6 new process lessons L90-L95 (in team-lead.md scratchpad), most importantly L92 (walked into the worktree-isolation pattern I just lifted to Brilliant 90 min earlier) and L93 (team-driven vs subagent-driven mode confusion).
- Deletion of 7 in-flight CHORE-60 phase tasks (#3-#9) at PO rollback.

### Scheduled artifacts (unchanged from session 17)

- 📅 `trig_014xDo7ZTuzNLpBUuWdtEs32` — fires 2026-05-30T09:00:00Z. Reads GH #59, emails PO with checklist + run/defer prompt, comments on #59.

### Live state at shutdown

- **Main:** `2a782c0` (origin/main matches)
- **Production:** unchanged from session 19 (`a9c9ad88.multivox.pages.dev`, alias `multivox.pages.dev`, custom domain `mvox.eu`); 200 on all
- **Polyphony Entu db:** unchanged from session 19 (607 librarian-bundle entities under EFK Library `6a12036c4ff8277cd4306b26`)
- **Tests:** 361/361 unit; check 0; lint clean (after this session's cleanups); build clean
- **Brilliant KB:** 270 entries (was 246)
- **Stale local branches:** `chore/per-commit-green-arch-decision`, `chore/seed-librarian-bundle`, `feat/phase-b-live-wiring` (housekeeping candidates for session 21)
- **Stale remote branches:** `origin/feat/phase-a-migration`, `origin/fix/phase-a-partial-failure-recovery`

### Team composition this session

- **palestrina (me)** — coordinator + sole executor of Brilliant batch + main lint cleanup
- **finn** — spawned at session start, idle throughout (no dispatches); being shutdown
- **bentham** — spawned at session start, idle throughout (no dispatches); being shutdown
- **byrd, josquin, tallis, comenius, victoria, perotin** — not spawned this session

### Process lessons (L90-L95; all in team-lead.md)

- L90 — Brilliant Tier-1 auto-approve makes bulk KB write tractable
- L91 — Pre-existing lint debt can hide on main; shutdown gate should add lint check
- L92 — Walked into the very pattern I just codified (worktree-isolation)
- L93 — Team-driven vs subagent-driven mode mismatch
- L94 — Team-lead source-code-adjacent commits cost trust
- L95 — Bash cwd drift mid-session is real; use absolute paths in verification

(*MVOX:Palestrina*)
