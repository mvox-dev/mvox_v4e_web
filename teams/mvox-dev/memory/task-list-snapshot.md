# Task List Snapshot — 2026-05-23 (end of session 19, proper)

State at shutdown. If session 20 hits State C in Phase 2, restore the active rows below into fresh TaskCreate IDs.

## Active tasks at shutdown

None `in_progress`. One `pending`:
- **#18** [DEFERRED] RFC: propose Path C case study into official entu docs

All CHORE-60 brainstorm + spec + plan + Pérotin seed tasks (#62-#71) completed this session.

## Open carry-forward (pending session 20+)

| Task ID | Subject | Source / Notes |
|---|---|---|
| #18 | [DEFERRED] RFC: propose Path C case study into official entu docs | Long-tail. Lift from Brilliant entry + entu/research PR #50 content. |

(Implementation work for CHORE-60 is in `docs/superpowers/plans/2026-05-23-library-page-ui-kit.md` as 31 plan tasks, NOT in the harness task list. Subagent-driven execution will create per-task harness tasks as it dispatches.)

If State C wipes the list at session 20, recreate as:
- TaskCreate("[DEFERRED] RFC: propose Path C case study into official entu docs", "Long-tail. Lift from Brilliant entry 06e6196e... + entu/research PR #50.")

## Open GH issues — priority for session 20

| GH # | Subject | Notes |
|---|---|---|
| **#60** | **CHORE-60: Convert Claude Design librarian bundle to Svelte 5 source** | **Plan ready** at `docs/superpowers/plans/2026-05-23-library-page-ui-kit.md`. PO chose subagent-driven execution mode, deferred to session 20. Probable session-20 headline. |
| #54 | CHORE-54 — Client-side runtime error capture (deferred) | Path C is stable in production; fires before mvox opens to real users |
| #3 | Layer 2 photo file-payload probe + impl | **Effectively closed in spirit** — Pérotin probe (session 18) verified wire shape empirically. Can close at session 20 if PO agrees. |
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

- None outstanding. Bentham's per-commit-GREEN lift landed in session 18 interim window. All other prior stewardship items either landed or were folded into CHORE-B.

## Session 19 outcome summary

### Closed via PR / push this session

- ✅ Recovery shutdown bundle (`85ed6cb`) — refreshed seed + snapshot + uncommitted Finn checkpoint
- ✅ Design spec (`ebb1cbb`) — `/library` page + UI kit (originally 18 components)
- ✅ Auth scope expansion (`bcb4795`) — added `/auth/login` + `/auth/logout` to CHORE-60, component count 18→21
- ✅ Pérotin strategy doc (`7437f2f` cherry-pick from `040d8e2`) — 292-line entity-mapping doc
- ✅ Pérotin seed script + dry-run (`4ffce6b`) — 673-line idempotent script + dry-run artifact
- ✅ Pérotin live execution result (`6d58544`) — 607 entities on polyphony, 0 errors, EFK Library `6a12036c4ff8277cd4306b26`
- ✅ Pérotin scratchpads (`24636a1` + `3582fb1`) — checkpoint + live-seed-complete
- ✅ Implementation plan (`44c6809` — **local, will push in shutdown bundle**) — 31 tasks for the implementation
- ✅ Shutdown bundle (this commit) — scratchpads + task snapshot + inboxes

### Bonus / process work this session

- Recovery from /clear mid-session (L82)
- Live seed work in parallel with brainstorm (Pérotin throughput: strategy + script + dry-run + live in <30 min)
- Authorization-gate routing incident + lesson learned + memory entry (L84)
- finn / finn-2 spawn collision cleanup (L88)
- Pérotin context-restore dissonance + reorientation (L89)
- Worktree-isolation adoption decision for session 20+ (L85)
- 4 new memory entries (polyphony-playground, mvox-personality, mvox-aesthetic, auth-gate-routing, spawn-worktree-isolation)

### Scheduled artifacts (unchanged from session 17)

- 📅 `trig_014xDo7ZTuzNLpBUuWdtEs32` — fires 2026-05-30T09:00:00Z. Reads GH #59, emails PO with checklist + run/defer prompt, comments on #59.

### Live state at shutdown

- **Main:** `7437f2f` (origin/main) + `44c6809` (local plan commit, unpushed — in shutdown bundle)
- **Production:** unchanged from session 17 (`a9c9ad88.multivox.pages.dev`, alias `multivox.pages.dev`); 200/200 on `/` + `/auth/login`
- **Polyphony Entu db:** seeded with 607 librarian-bundle entities (1 library + 8 persons + 8 members + 13 works + 17 editions + 552 copies + 4 lendings) under EFK. 1 S3 orphan from session-18 file-probe (no impact).
- **Tests:** unchanged from session 17 (vitest 361/361, check 0, lint 0, build clean; Playwright 11 pre-existing failures)

### Team composition this session

- **palestrina (me)** — coordinator throughout
- **perotin** — spawned (no isolation:worktree this session — adoption point is session 20); did strategy doc + seed script + dry-run + live exec + scratchpad; stand-down message sent at 19:59
- **finn** — re-spawned as `finn-2` due to stale `finn` config entry from recovery shutdown; both shut down for cleanup (terminated 19:58)
- **bentham, victoria, tallis, byrd, josquin, comenius** — not spawned this session

### Process lessons (L82-L89; all in team-lead.md)

- L82 — /clear recovery procedure
- L83 — polyphony is playground
- L84 — auth-gate routing as impostor-defense
- L85 — worktree isolation adoption from session 20+
- L86 — visual companion is the right tool for design synthesis
- L87 — PO redirects on visual taste are common; lean character-rich by default
- L88 — finn-2 spawn collision when stale config entries exist
- L89 — teammate context-restore dissonance; trust disk + commit log over teammate self-report

(*MVOX:Palestrina*)
