# Task List Snapshot — 2026-05-24 (end of session 22)

State at shutdown. If session 23 hits State C in Phase 2, restore the active rows below into fresh TaskCreate IDs.

## Active tasks at shutdown

None `in_progress`. None `pending`.

All session-22 work tasks (#1-#18) are `completed`. CHORE-62 / #63 + CHORE-66 + the trailer-collision rule + URL-overrides-persisted rule + pre-commit hook installations all landed cleanly.

## Open carry-forward (pending session 23+)

| Task ID | Subject | Source / Notes |
|---|---|---|

(empty — all carry-forward work is tracked via GH issues, not local task IDs)

If State C wipes the list at session 23, no local recreations needed.

## Open GH issues — priority for session 23

| GH # | Subject | Notes |
|---|---|---|
| **#65** | CHORE: MvoxNav chip width on long locale renderings (narrow viewport) | Filed CHORE-62 carry-forward. ~15 min Byrd. Layout-only fix for ET `RAAMATUKOGUHOIDJA` (17 chars). Defer until narrow-viewport support is a requirement. |
| **#67** | CHORE-66.2: Lift `ENTU_DB` from hardcoded `'polyphony'` to env (`$env/static/public`) | Filed CHORE-66 carry-forward. ~10 min Byrd or Josquin. **Must land before any prod deploy touching `userStore.ts`.** |
| **#68** | CHORE: Founder-as-org-affiliation — surface orgs where user is `_owner` but has no member row | Filed CHORE-66 documented-limitation follow-up. ~30 min Byrd + Tallis atomic. Augments `hydrateUserStore` with a second membership-query path (union with `_owner`-derived orgs). |
| #54 | CHORE-54 — Client-side runtime error capture (deferred) | Fires before mvox opens to real users |
| #6 | CHORE-6 — Email Resend wiring | Still blocked on PO SPF + DKIM DNS records |
| #7-#23 | A1-D2 user stories + ADMIN-1-5 | Backlog |
| #31 | YELLOW: relax OKLCH regex on next Tailwind upgrade | Fires on next Tailwind minor/major bump |
| #33 | YELLOW-32.1: BFF helper factor-out | **Obsolete** — BFF data routes deleted in CHORE-B |
| #36 | CHORE-36: E2E Entu mock harness + flip landing to SSR | Closes in CHORE-C (MSW + Playwright bootstrap) |
| #38 | YELLOW-35.2 + 35.3: Svelte 5 + types cleanup | `$app/stores` → `$app/state` lift partially done in CHORE-66 (+layout); audit remaining sites |
| #39 | YELLOW-35.4: lift session population to +layout.server.ts | **Effectively obsolete** — Path C has no server-side session |
| #44 | CHORE-43: Migrate multivox to CF Pages Git-connected | Independent |
| #48 | CHORE-48: ESLint + Biome linting setup (parent) | Stays open until CHORE-49 sub-rule cycles complete |
| #49 | CHORE-49: Incremental Biome lint rule enablement (5 sub-cycles) | Filed but no urgency |
| #59 | Production verify: deferred providers (mobile-id + id-card + apple) | Scheduled routine `trig_014xDo7ZTuzNLpBUuWdtEs32` fires 2026-05-30T09:00:00Z |

## Stewardship items parked

- Brilliant KB deferred-updates queue from session 22 (lessons L104-L112) — see team-lead.md [NEXT SESSION] seed
- CHORE-67 (wire /library to real Entu data) — natural-next CHORE per `feedback_ui_parallels_with_seed`; brainstorm-first at session-23 kickoff if PO chooses

## Session 22 outcome summary

### Closed via push this session

- ✅ **CHORE-62 + #63 shipped.** Squash `9637eee` on main. MvoxNav i18n wiring + textSnippet helper single-element fix. Closes GH #62 + #63. (Trailer-collision incident: PO co-author trailer missing on this commit; recovery decision was leave-as-is + log lesson.)
- ✅ **Trailer-collision arch rule landed.** Doc commit `7d078f7` on main. Codifies the `Co-authored-by:` in dispatch body → hook short-circuit failure mode.
- ✅ **URL-overrides-persisted arch rule landed.** Doc commit `3a37e42` on main (Bentham authored). Project-wide rule: URL params override persisted state on read; two-write symmetry on user change AND on read-time divergence.
- ✅ **Pre-commit branch-intent hook landed.** `ef78aa3` (v1: file marker) + `8a42302` (v2: env var, current). Hook source at `.githooks/pre-commit`; active at `.git/hooks/pre-commit` per-clone.
- ✅ **`feedback_no_parallel_branches` strengthened.** Default-no + exception-with-proof framing. Memory updated; not committed (lives in `.claude/projects/.../memory/`).
- ✅ **KB batch.** 12 new Pattern entries + 3 updates + 9 typed cross-links. Brilliant KB went 269 → 281. Cleared deferred-KB queue from sessions 20-21 + session-22 trailer-collision pattern.
- ✅ **CHORE-66 navbar auth wiring shipped.** Squash `9266e2e` on main. 15 files / +852 / -33. 463/463 unit tests (+27). Closes GH #66. First enactment of `feedback_ui_parallels_with_seed`. YELLOW-66.1 folded; YELLOW-66.2 deferred as #67.

### Live state at shutdown

- **Main:** `9266e2e` (origin/main matches; the shutdown bundle will add one more commit when pushed)
- **Production:** `multivox.pages.dev` 200; `mvox.eu` 200. CF auto-deploy of CHORE-66 in progress; verify build chunks at session-23 open.
- **Polyphony Entu db:** unchanged from session 20 (607 librarian-bundle entities under EFK Library `6a12036c4ff8277cd4306b26`)
- **Tests:** 463/463 unit; check 0; lint clean; build clean. Playwright 11 pre-existing failures (CHORE-C scope, unchanged)
- **Brilliant KB:** 281 entries (was 269 pre-session)
- **Stale config entries:** `byrd` (original, terminated mid-session — cleanup at next TeamCreate)
- **Stale local branches:** `chore/per-commit-green-arch-decision`, `chore/seed-librarian-bundle`, `feat/phase-b-live-wiring` (unchanged housekeeping candidates)
- **Stale remote branches:** `origin/feat/phase-a-migration`, `origin/fix/phase-a-partial-failure-recovery`

### Team composition this session

- **palestrina (me)** — coordinator; brainstorm + spec + plan author for CHORE-66; KB batch dispatch; closeout
- **finn** — always-on; not dispatched this session (no research request surfaced)
- **bentham** — always-on; authored arch-decision entries (URL-overrides-persisted `3a37e42`), branch reviews for CHORE-62 + CHORE-66 (RED + re-verify GREEN)
- **josquin** — Task 1 contract types + TWO surface-and-stops on plan divergences (URL form + data-model inverted); squash-merges for CHORE-62 (`9637eee`) + CHORE-66 (`9266e2e`); trailer-collision arch entry (`7d078f7`)
- **tallis** — RED specs for CHORE-62 + CHORE-66 Tasks 3/4/5; discarded one experimental spec refactor (good discipline)
- **byrd** (byrd-1) — Task 3 atomic bundle (`bcdeb00`); stalled on permission gate at Task 4; shut down + respawned as byrd-2
- **byrd-2** — Tasks 4-6 (OrgPicker + MvoxNav update + +layout wiring); RED-1 + YELLOW-66.1 fix; bonus discovery of `tests/setup.ts` cleanup gotcha (L111)
- **comenius** — i18n keys for CHORE-62 (`a439228`) + CHORE-66 (`1c9e5da`); two scratchpad commits for translation decisions
- **perotin** — session-22 first enactment of `feedback_ui_parallels_with_seed`; provided test-librarian person/member IDs + the `_parent` inline-name denormalization finding that shaped the two-fetch userStore design
- **victoria** — not spawned this session

### Process lessons (L104-L112; all in team-lead.md)

- L104 — `Co-authored-by:` in dispatch body short-circuits prepare-commit-msg hook
- L105 — Plan-time URL hardcodes drift fast; cite settled architectural exports by name
- L106 — Surface-and-stop on plan-vs-impl divergence catches data-model bugs early
- L107 — Shared-tree branch flips bite team-lead doc commits too
- L108 — In-process team agents can't be OS-killed; spawn-with-disambiguation is the respawn
- L109 — Marker-file branch-intent design hits silent tool-permission gates; env vars sidestep
- L110 — Verify diff-shape post-merge before squash
- L111 — `@testing-library/svelte` auto-cleanup silently skips under Vitest `globals: false`
- L112 — `feedback_ui_parallels_with_seed` enactment proved the principle in real time (Pérotin from kickoff)

(*MVOX:Palestrina*)
