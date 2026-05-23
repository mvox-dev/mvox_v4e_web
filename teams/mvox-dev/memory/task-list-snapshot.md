# Task List Snapshot — 2026-05-23 (end of session 16)

State at shutdown. If session 17 hits State C in Phase 2, restore the active rows below into fresh TaskCreate IDs.

## Active tasks at shutdown

None in_progress at the harness level. All session-16 work either completed (CHORE-A end-to-end) or carry-forward via GH issues.

## Open GH issues — priority for session 17

| GH # | Subject | Notes |
|---|---|---|
| **#53** | **CHORE-53 — Path C architectural rewrite** | **Spec + plans approved; CHORE-A merged.** CHORE-B (the rewrite) is the session-17 headline. |
| **#54** | CHORE-54 — Client-side runtime error capture (deferred) | Filed session 16. Fires after Path C stabilizes + before mvox opens to real users. Tool choice (Sentry / OSS GlitchTip / homegrown) is its own brainstorm. |
| #3 | Layer 2 photo file-payload probe + impl | Still deferred — fires when actual photo uploads OR BFF needs `_thumbnail` on real data. |
| #6 | CHORE-6 — Email Resend wiring | Still blocked on PO SPF + DKIM DNS records. Re-check next session. |
| #7-#23 | A1-D2 user stories + ADMIN-1-5 | Backlog — defer until Path C ships + OAuth flow end-to-end functional. |
| #31 | YELLOW: relax OKLCH regex on next Tailwind upgrade | Fires on next Tailwind minor/major bump. |
| #33 | YELLOW-32.1: BFF helper factor-out on next route | **Closes in CHORE-C** (moot under Path C). |
| #36 | CHORE-36: E2E Entu mock harness + flip landing to SSR | **Closes in CHORE-C** (realized as MSW + Playwright bootstrap). |
| #38 | YELLOW-35.2 + 35.3: Svelte 5 + types cleanup | Independent fold-in or with next Byrd touch. May survive Path C. |
| #39 | YELLOW-35.4: lift session population to +layout.server.ts | **Closes in CHORE-C** (no server-side session under Path C). |
| #43 | CHORE-42: Wire mvox.eu custom domain | Independent of CHORE-53. PO DNS work. |
| #44 | CHORE-43: Migrate multivox to CF Pages Git-connected | Independent. Brief outage during swap. |
| #48 | CHORE-48: ESLint + Biome linting setup (parent) | Install landed session 15. Stays open until CHORE-49 sub-rule cycles complete. |
| #49 | CHORE-49: Incremental Biome lint rule enablement (5 sub-cycles) | Filed but no urgency. |

## Session 16 outcome summary

### Closed via PR this session
- ✅ **CHORE-A merged** — squash `773a057`, foundation libraries (storage, state, wrapper skeleton, EntuClient move). Closes #52 (defensive search throw subsumed).

### Filed this session
- 📝 #54 CHORE-54 — Client-side runtime error capture (deferred)

### Major artifacts produced
- 📄 `docs/superpowers/specs/2026-05-23-chore-53-path-c-design.md` — 482-line design spec (Path C decision, full architecture)
- 📄 `docs/superpowers/plans/2026-05-23-chore-53-a-foundation.md` — 968 lines, 5 tasks (CHORE-A, merged)
- 📄 `docs/superpowers/plans/2026-05-23-chore-53-b-rewrite.md` — 1819 lines, 17 tasks (CHORE-B, ready for execution)
- 📄 `docs/superpowers/plans/2026-05-23-chore-53-c-test-infra.md` — 791 lines, 9 tasks (CHORE-C, ready for execution)

### Stewardship pending (carry into session 17)
- YELLOW-50.1 + YELLOW-51.1 in `architecture-decisions.md` L204 (planned fold-in for CHORE-B)
- YELLOW-A.3 import-extension consistency (6 one-char edits, fold into CHORE-B)
- YELLOW-A.4 token-version invariant code comment (fold into CHORE-B)
- Bentham's [PATTERN] lift to architecture-decisions (lint:fix in GREEN) — check his shutdown commit

### Live state at shutdown
- **Main:** `ef09aef` (post-CHORE-A squash + Josquin scratchpad commit; teammate shutdown commits may land before final push)
- **Deployment:** `a44a1c88.multivox.pages.dev` (production alias `multivox.pages.dev` same build)
- **`https://multivox.pages.dev/`** — HTTP 200
- **`https://multivox.pages.dev/auth/login`** — HTTP 200
- **OAuth sign-in:** unchanged from session 15 (Smart-ID flow works; data calls still 500 until CHORE-B lands)
- **Tests:** vitest 449/449 unit, pnpm check 0, pnpm lint 0, pnpm build clean. Playwright has 2 pre-existing failures (YELLOW-A.1, YELLOW-A.2 — CHORE-C scope).

### Team composition this session
- **finn** — 2 dispatches (entu/webapp source read + OAuth parameter passthrough probe). Both delivered conclusive structured reports.
- **bentham** — 1 review (PR #56). GREEN with 4 well-scoped YELLOWs + stewardship endorsement.
- **perotin** — 0 dispatches (architecture session + foundation; no Entu data work).
- **tallis** — 4 RED dispatches (storage, state, wrapper, client move). Clean execution.
- **byrd** — pre-emptively shipped A1-A5 in one pass (chain-discipline reset; redid through chain after PO call). Final 3 GREEN dispatches (storage, state, wrapper) clean.
- **josquin** — 1 GREEN dispatch (A4 client move), A5 verify+PR, merge ritual. Surfaced the lint:fix in GREEN [PATTERN].
- **comenius, victoria** — not spawned this session.

### Process notes from session 16
- L61 — brainstorming skill is the right tool for architectural forks
- L62 — Mirror the reference implementation when one exists (entu.app is the Entu frontend reference)
- L63 — Forward-compat code is cheap insurance for blocked external asks (login_hint pre-included)
- L64 — Chain discipline matters even when work is correct (the L30 precedent is for trivial refactor, not architectural foundations)
- L65 — GREEN-phase agents must run `pnpm lint:fix` as part of done-criteria
- L66 — superpowers:writing-plans's "complete code in every step" mandate produces hefty plans but pays off in dispatch quality
- L67 — `--force-with-lease` on a feature branch is the bounded exception to git safety; main is still protected

(*MVOX:Palestrina*)
