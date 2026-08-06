# Palestrina — Team Lead Scratchpad

> **Trimmed 2026-08-06 (S42) — Mihkel's directive.** 38 sessions of `[PROCESSED]`/superseded seeds moved to
> `team-lead-archive.md` (git history also retains everything). This file now carries only the **live pointer**.
> The authoritative cross-session **resume vehicle is the auto-memory** `mvox-app-slice1-resume-state.md`
> (`~/.claude/projects/-home-ai-teams/memory/`) + the `MEMORY.md` index — read those first, not this file's history.

## Current state (2026-08-06)

- **Product track: `mvox-app`.** App repo `~/workspace-app` (`mvox-dev/mvox-app`, `main` = prod at **mvox.eu**,
  main->CF-Pages auto-deploy). main @ `848fed1`, 222 tests. **Slice-1 (agenda) + slice-2 (RSVP singer-side) SHIPPED + live.**
- **Memory/harvest repo: `~/workspace`** (this repo -- old `mvox_v4e_web`). Holds team config + memory + Perotin's
  probe/seed scripts + result artifacts. NOT the app code.
- **BLOCKING open item -- HELD with Mihkel, no timeline, slower pace requested:** a *confirmed live* security
  finding -- any Google account can self-provision into polyphony (`GET /auth?db=polyphony`) and read the db's
  domain+public data with no membership/approval. See auto-memory `[[mvox-domain-read-exposure]]` (compounds with
  `[[entu-creation-rights-unenforced]]`). **Do NOT act on it.** New questions -> **Gama via comms `po-team`**, not upward.
  Candidate close (prepped, not executed): scope polyphony's `add_user`.
- **Next slice when unblocked:** ONBOARDING (Mihkel ruled INVITED path) -- grooming with Gama. Slice-3 ROSTER (#16,
  tasks #17-#20) is ready but **parked behind the security decision**.

## Team / session

- Warm session `946440b9`. 8 members registered (team-lead, josquin, bentham, byrd, perotin, comenius, tallis, finn);
  all idle / stood down. Spawn on demand via Agent tool; don't re-spawn ones already in `config.json`.
- PO = Mihkel (direct) + Gama via comms `po-team`.

## Git hygiene note (as of this trim)

- `~/workspace`: local `main` was **21 commits ahead of origin** (today's S41/S42 memory/probe/governance work) +
  uncommitted agent scratchpad edits -- pending PO review before push (shutdown-protocol pause). This trim adds to that batch.

## How to resume (for future-Palestrina)

1. Read auto-memory `mvox-app-slice1-resume-state.md` + `MEMORY.md` -- that is the real state, not this file's tail.
2. Keep THIS file lean: write only a short current-state pointer here; full per-session history goes to `team-lead-archive.md`.

(*MVOX:Palestrina*)
