# Task List Snapshot — 2026-05-23 (end of session 17)

State at shutdown. If session 18 hits State C in Phase 2, restore the active rows below into fresh TaskCreate IDs.

## Active tasks at shutdown

None in_progress at the harness level. All CHORE-B work shipped (PR #58 squashed to `fc99291` on main); 4 hotfixes + 1 pre-merge cleanup all subsumed in the squash.

## Open carry-forward (pending session 18+)

| Task | Subject | Source / Notes |
|---|---|---|
| #16 | Write entu/research case study: 3rd-party frontend on Entu | Now has production evidence + 4-hotfix-cycle data. `$ENTU_RESEARCH/docs/case-studies/2026-05-3rd-party-frontend-on-entu.md`. |
| #17 | Write Brilliant KB pattern: Entu browser-direct frontend | `Patterns/entu/3rd-party-frontend-browser-direct`. Lifts from the case study (#16). |
| #18 | [DEFERRED] RFC: propose Path C case study into official entu docs | Long-tail item. After case study + Brilliant entry. |
| #19 | File Argo ask: pass through login_hint + prompt to upstream IdPs | Forward-compat already in mvox (CHORE-B B3); this is purely activation timing. |

## Open GH issues — priority for session 18

| GH # | Subject | Notes |
|---|---|---|
| #54 | CHORE-54 — Client-side runtime error capture (deferred) | Fires after Path C stabilizes (now is) + before mvox opens to real users. Has CF Analytics Engine binding option noted in issue comment. |
| #3 | Layer 2 photo file-payload probe + impl | Still deferred — fires when actual photo uploads OR BFF needs `_thumbnail` on real data. |
| #6 | CHORE-6 — Email Resend wiring | Still blocked on PO SPF + DKIM DNS records. Has CF Cron Triggers + Email Workers binding options noted in issue comment. |
| #7-#23 | A1-D2 user stories + ADMIN-1-5 | Backlog — defer until CHORE-C ships + we have a UI system. |
| #31 | YELLOW: relax OKLCH regex on next Tailwind upgrade | Fires on next Tailwind minor/major bump. |
| #36 | CHORE-36: E2E Entu mock harness + flip landing to SSR | **Closes in CHORE-C** (realized as MSW + Playwright bootstrap). |
| #38 | YELLOW-35.2 + 35.3: Svelte 5 + types cleanup | Survives Path C. Independent fold-in or with next Byrd touch. |
| #39 | YELLOW-35.4: lift session population to +layout.server.ts | **Effectively obsolete** — Path C has no server-side session. Close at session 18. |
| #33 | YELLOW-32.1: BFF helper factor-out | **Obsolete** — BFF data routes deleted in CHORE-B. Close at session 18. |
| #43 | CHORE-42: Wire mvox.eu custom domain | Independent of CHORE-53. PO DNS work. |
| #44 | CHORE-43: Migrate multivox to CF Pages Git-connected | Independent. Brief outage during swap. |
| #48 | CHORE-48: ESLint + Biome linting setup (parent) | Stays open until CHORE-49 sub-rule cycles complete. |
| #49 | CHORE-49: Incremental Biome lint rule enablement (5 sub-cycles) | Filed but no urgency. |
| #59 | Production verify: mobile-id + id-card + apple providers (deferred from CHORE-B) | Scheduled routine `trig_014xDo7ZTuzNLpBUuWdtEs32` fires 2026-05-30T09:00:00Z. |

## Session 17 outcome summary

### Closed via PR this session
- ✅ **CHORE-B merged** — squash `fc99291` on main, 49 files +910/−2490. Closes #53 + #57 (both auto-closed by GH on push).

### Filed this session
- 📝 **#57** YELLOW-B.1: setLastProvider via document.referrer cross-origin-fragile (filed pre-merge; closed via fix in the same squash)
- 📝 **#59** Production verify deferred providers (mobile-id, id-card, apple) — scheduled reminder fires 2026-05-30

### Bonus session work
- ✅ **Pérotin menu usability live run** — `9297df7` on main; 17 UPDATE ops on polyphony. Proposal doc + dry-run + live + post-exec verify. Voices ordinal collision fixed, Library group reordered, Events sort by `start_date.date`, etc.
- ✅ **Finn research on `claude.ai/design/`** — source-verified capabilities + fit assessment. Headline for session-18 UI/design brainstorm input.
- ✅ **GH comments on #6 + #54** — CF binding options at brainstorm time (Cron Triggers + Email Workers for #6; Analytics Engine for #54).

### Scheduled artifacts
- 📅 **`trig_014xDo7ZTuzNLpBUuWdtEs32`** — fires once 2026-05-30T09:00:00Z. Reads #59, emails PO with checklist + run/defer prompt, comments on #59. Settings.json updated with `Skill(schedule)` permission.

### Live state at shutdown
- **Main:** `fc99291` (CHORE-B squash) — PLUS the shutdown bundle commit when team-lead pushes
- **Production:** `a9c9ad88.multivox.pages.dev` (alias `multivox.pages.dev` serving same build)
- **Production smoke:** `/` → 200, `/auth/login` → 200
- **OAuth verified on production:** Smart-ID, Google, e-mail (3 of 6 — remaining 3 deferred to 2026-05-30)
- **Tests:** vitest 361/361 unit, pnpm check 0, pnpm lint 0, pnpm build clean. Playwright 11 pre-existing failures (10 frontend-scaffolding mock the deleted BFF; 1 tailwind/OKLCH) — CHORE-C scope.

### Team composition this session
- **finn** — 2 dispatches (entu/webapp source verify for HOTFIX-1; `claude.ai/design/` capabilities research). Both clean source-verified reports.
- **bentham** — B16 steward edit + full branch review GREEN with 2 non-blocker YELLOWs (B.1 + B.2). Plus arch-decisions self-fix commit.
- **perotin** — 3 dispatches: menu usability proposal + Q4 probe + live execution. Bonus delivery on what was supposed to be an auth-refactor session.
- **tallis** — 6 RED dispatches (B2, B3, B5, B7, B10, B11) + B12 RED + B13a RED + B15 sweep + HOTFIX-1 RED. Clean executions throughout.
- **byrd** — 11 dispatches across B2/B3/B6/B8/B10/B13a/B13b + 4 HOTFIX GREENs + pre-merge cleanup + dev/auth-controls scaffold. The heaviest implementer this session.
- **josquin** — 7 dispatches: B5/B7/B11/B12/B14 + B17 (PR + deploys) + merge ritual + final prod smoke. Two surface-and-stops (B11, B12) drove the per-commit-GREEN process adoption.
- **comenius, victoria** — not spawned this session.

### Process lessons from session 17 (L68-L75)
- L68 — Per-commit-GREEN discipline on feature branches (Bentham to lift to arch-decisions next session)
- L69 — Mirror reference implementation on unfamiliar wire shapes
- L70 — PO live-test on deployed surface is irreplaceable for arch-rewrites
- L71 — No FOIC for auth-state UI (gate on mounted flag)
- L72 — ASCII-only commit messages for Wrangler/CF Pages deploys
- L73 — Dev scaffolds net-zero in feature branch
- L74 — Surface-and-stop on plan-ordering risk
- L75 — Routine scheduling for time-deferred follow-ups

(*MVOX:Palestrina*)
