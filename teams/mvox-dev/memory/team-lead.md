# Palestrina — Team Lead Scratchpad

> **Trimmed 2026-08-06 (S42) — Mihkel's directive.** 38 sessions of `[PROCESSED]`/superseded seeds moved to
> `team-lead-archive.md` (git history also retains everything). This file now carries only the **live pointer**.
> The authoritative cross-session **resume vehicle is the auto-memory** `mvox-app-slice1-resume-state.md`
> (`~/.claude/projects/-home-ai-teams/memory/`) + the `MEMORY.md` index — read those first, not this file's history.

### [NEXT SESSION] 2026-08-06 end-of-S42 — CHECKPOINT: ultracode the Slice-4 build wave

**Mihkel's directive at wrap: checkpoint now; NEXT SESSION ULTRACODE the remaining Slice-4 build wave (Workflow / multi-agent).**
Full state = auto-memory `mvox-app-slice1-resume-state.md` (top block is the checkpoint; read it FIRST).

- **Product track: `mvox-app`** (`~/workspace-app`, `main` = prod at mvox.eu, auto-deploy). **main @ `7838989`, 238 tests.**
- **Slice-4 Onboarding (#21) FOUNDATION DONE + merged:** T4.1 (remove `add_user`, #22 closed) · T4.2 (binding=token-possession,
  #23) · T4.3 (`person` reduced, `profile` type live `6a74933f…817`, #24 closed) · T4.4 (single create path `createProfile` on
  main, #25 closed). This CLOSED the old HELD `[[mvox-domain-read-exposure]]` stranger-vector (add_user gone).
- **NEXT = ultracode the build wave:** T4.5 invite (#31) · T4.6 edit UI (#26) · T4.7 moves (#27) · T4.8 fallback (#28) ·
  T4.10 migration (#30) · T4.9 live gate (#29). T4.5 unblocked + first (closes no-new-person window). Build tasks serialize
  on the single `~/workspace-app` checkout.
- **Open PO decisions (auto-memory has detail):** T4.5 reconcile old `/invite/[token]` page (read: REPLACE w/ native flow) ·
  display-name field vs drop fallback · T4.10 128-synthetic-singers scope. None block starting T4.5.
- **Carry:** YELLOW-T4.4.1 (downstream reviews: verify each create funnels through `createProfile`) · residual exposure
  (~15 person fields still domain-readable by members — NOT closed by slice, on #21; never describe as handled).

## Team / session

- Warm session `946440b9`. 8 members registered (team-lead, josquin, bentham, byrd, perotin, comenius, tallis, finn);
  all idle / stood down. Spawn on demand via Agent tool; don't re-spawn ones already in `config.json`.
- PO = Mihkel (direct) + Gama via comms `po-team`.

## Git hygiene note

- `~/workspace`: **synced with origin as of 2026-08-06 (S42)** — the 26-commit S41/S42 batch (memory/probe/governance
  work + agent scratchpad checkpoints + this trim) was committed in logical per-agent chunks and pushed at Mihkel's
  direction (`c629b5b..bbe66cd`). Working tree clean. App repo `~/workspace-app` unaffected (separate, already in sync).

## How to resume (for future-Palestrina)

1. Read auto-memory `mvox-app-slice1-resume-state.md` + `MEMORY.md` -- that is the real state, not this file's tail.
2. Keep THIS file lean: write only a short current-state pointer here; full per-session history goes to `team-lead-archive.md`.

(*MVOX:Palestrina*)
