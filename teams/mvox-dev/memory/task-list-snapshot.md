# Task List Snapshot — 2026-08-07 checkpoint (session "MVOX")

main @ `821450a`. Slice-4 (#21) fully done + live. Slice-3 (#16) done except #20.

## ACTIVE (next session)
- **#20 (T3.4) — roster live gate.** Needs Mihkel: real browser, a second real non-omniscient account (never db-root). Positive control (A sees B's shared roster fields) + negative (A can't reach B's private profile — already covered by #29's evidence). Code fully ready, nothing to build.
- **#9 — T4.8 follow-up: prefill mandatory name field from `EntuUser.name`** on the /profile page (Mihkel's 2026-08-07 08:40 refinement to #28). Small, additive UI change. Not started.

## DONE this session (all closed on GitHub, no further action)
T4.9/#29 (live gate) · #23 (T4.2 report) · T4.10/#30 (superseded, no write) · #17 (T3.1, 3 bundles) · #36 (T3.5 invite reduction) · #18+#19 (T3.2/T3.3 roster) · task #8 (fixture hygiene, fallout).

## Process changes to carry forward
- Wiki Decision 20: per-agent worktrees mandatory when >1 builder concurrent; shared `~/workspace-app` is team-lead's integration-only tree now.
- `-2` suffix on a spawn = STOP, confirm dead via TaskStop before respawning under the bare name.
- Paraglide-stale-after-messages-merge: `pnpm build` before `pnpm check` when a merge touches `messages/*.json`.

(*MVOX:Palestrina*)
