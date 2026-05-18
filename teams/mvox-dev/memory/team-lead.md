# Palestrina — Team Lead Scratchpad

## 2026-05-18 — First session of mvox-dev

Team bootstrapped today. Repo: only `teams/mvox-dev/` exists, no app code yet. Spawned finn + bentham (always-on); implementers wait for first task.

### [PATCH] Stale polyphony refs + lifecycle bugs cleaned up so far

- `~/.claude/CLAUDE.md` — rewritten from polyphony-dev/container/tmux → mvox-dev/local/Agent-tool. Path corrected from `~/workspace/.claude/teams/polyphony-dev/` → `~/workspace/teams/mvox-dev/`.
- `teams/mvox-dev/startup.md` — added CRITICAL rule before Phase 0: do not call `TaskCreate` before Phase 3 completes (task list switches when `TeamCreate` runs; pre-team tasks orphan and can leak ghost numbers to teammates). Hit this bug 2026-05-18: created tasks #1-8 during Phase 0-2, TeamCreate switched the list, Finn later flagged a phantom task #8.
- **PD → MVOX attribution rename (bulk sed)** — every `(*PD:<name>*)` trailer became `(*MVOX:<name>*)`. PD stood for Polyphony-Dev. 11 occurrences across CLAUDE.md, common-prompt.md, all 8 prompts, team-lead memory.
- **D1 / polyphony neutralization** (after Finn's audit 2026-05-18 19:53):
  - `common-prompt.md` stack table — FIXME banner + per-row UNCONFIRMED / ~~strike~~ markers. Only `pnpm` marked CONFIRMED.
  - `prompts/josquin.md` — gutted D1 Critical Safety Rules, Auth Architecture (Registry/Vault/JWKS), Core Responsibilities (D1 migrations); WRITE/READ list and Key Paths now FIXME placeholders. Personality bullets de-D1'd. Identity (lore, TDD chain, merge authority, scratchpad) intact.
  - `prompts/tallis.md` — Test Patterns banner: D1Database mock noted as removed; auth-mock pattern marked TBD.
  - `prompts/bentham.md` — Security-Critical Files replaced with FIXME banner; "What to Watch For" D1 bullet struck; legal-compliance bullet flagged for PO decision (resolves Bentham's intro flags #1, #2, #5; flag #3 was minor, flag #4 still parked).
  - `.claude/settings.local.json` — dropped one-time `cp ~/projects/polyphony/.claude/statusline-command.sh` allowed-command.
- **Round 2 (after Finn's deeper audit revealed I'd missed a lot):**
  - `.claude/statusline-command.sh` — header (`polyphony-dev statusline` → `mvox-dev statusline`), `(*FR:Brunel*)` → `(*MVOX:Brunel*)`, container path docstring cleaned up, `CLAUDE_ENV_ID="POLY"` example → `MVOX`, `/tmp/polyphony-test-status.txt` → `/tmp/mvox-test-status.txt` (cache-file the agents *would* write to; nothing reads/writes it yet).
  - `prompts/byrd.md` — Core Responsibilities + WRITE list + Key Paths sections now FIXME-banner placeholders, polyphony paths marked as such. `wrangler` prohibition kept but struck through with explanation.
  - `prompts/tallis.md` — Core Responsibilities + WRITE list + Key Paths sections same treatment.
  - `prompts/comenius.md` — Core Responsibilities + WRITE list + Key Paths sections same treatment.
  - `common-prompt.md` — extended UNCONFIRMED markers to Framework / Platform / i18n rows (not just D1/BLOBs/EdDSA). TDD ownership table "May write" column got a FIXME banner + softened path descriptions.
  - `prompts/palestrina.md` — Comenius team-table row: "Paraglide" → "tooling (Paraglide?) TBD".

### [PATCH] Roster model versions

- `roster.json` — three opus entries updated from `claude-opus-4-6[1m]` → `claude-opus-4-7[1m]` (team-lead, josquin, bentham). Sonnet members left at `claude-sonnet-4-6` (latest sonnet — no 4-7 exists per harness model index).

### [DEFERRED] Process lesson from this session

Finn's first audit message looked complete but was a quick scan; his second message (delivered ~1 minute later) was the comprehensive report. I acted on the first too fast and missed ~6 file clusters. Future fix: when delegating audits to Finn, ask explicitly for "comprehensive, single-pass" output and wait for it. Don't kick off patches on the first response if there's any chance more is coming.

### [SESSION-CLOSE] 2026-05-18 — shutdown rehearsal

First end-to-end test of the shutdown protocol (`common-prompt.md` → Team-Lead Shutdown). Goal: validate the loop on real state (this session's accumulated scratchpads + inboxes) so we know it works before relying on it.

Sequence executed (per protocol):
1. Wrote this scratchpad ✅
2. Created `memory/task-list-snapshot.md` (10 tasks, all done except this one) ✅
3. Sent `shutdown_request` to finn + bentham (parallel; they were both idle)
4. Persist inboxes from `~/.claude/teams/mvox-dev/inboxes/` → `teams/mvox-dev/inboxes/` (last 100 per agent, via `jq '.[-100:]'`)
5. Stage + commit memory/ and inboxes/
6. **Paused before push** — PO reviews diff first

If push lands and the session ends cleanly, next-session Palestrina starts with: this scratchpad, the task snapshot, restored inboxes (Phase 4 of startup), and a clean runtime dir to recreate.

### [REMINDER] For next-session Palestrina

When you wake up:
- Read **this file first** (you're already supposed to per startup.md Phase 0; just emphasizing).
- The `[DEFERRED]` and `[REMINDER]` sections above are your loose-ends list — process them before announcing "ready" to PO unless PO speaks first.
- The `[PATCH]` log is for historical reference; don't re-do any of it.
- Big open item from Bentham (his flag #4): no formal mechanism yet for recording PO approval of v4E schema mutations. He'll preemptively RED any such PR. Decide a convention with PO before Josquin's first schema-touching task.

### [REMINDER] Finn's scratchpad needs cleanup at next spawn

`teams/mvox-dev/memory/finn.md` (written by Finn at shutdown 2026-05-18 20:36) has two stale entries:

1. **Trailer is `(*PD:Finn*)`** — should be `(*MVOX:Finn*)`. He carried over the old `PD:` convention because his in-context view predated the bulk sed. Other prompt files already flipped.
2. **`[CHECKPOINT]` L14**: "`.claude/statusline-command.sh` uses `/tmp/polyphony-test-status.txt` — needs rename" — already fixed in round 2 patches. The file uses `/tmp/mvox-test-status.txt` now.

When you next spawn Finn, hand him a startup instruction to read his scratchpad and either correct these or message you to do it (his file, his to own).

### [REMINDER] Bentham scratchpad noted correctly

`teams/mvox-dev/memory/bentham.md` (written 2026-05-18 20:36) has good calibration state — what he won't RED on, what he WILL preemptively RED (v4E schema PRs without recorded PO approval), why `architecture-decisions.md` doesn't exist yet (he'll create on first real decision, not preemptively). No corrections needed.

User noted: more polyphony remnants will surface across docs. Patch as encountered so each launch gets cleaner.

### [DEFERRED] Still open — depends on PO stack decisions

- Bentham's intro flag #4: Schema migration protocol — concrete PO-approval mechanism for v4E schema edits in `entu/research`. Still parked.
- All FIXMEs added in this session will need rewrites once stack lands (Entu auth model, repo structure, access/permissions model, etc.).

### [PATTERN] Local-mode spawning

`Agent` tool, `subagent_type: general-purpose`, `team_name: mvox-dev`, `run_in_background: true`. Prompt = startup instructions + role file ref. Sonnet for finn/byrd/tallis/comenius/victoria; opus for josquin/bentham. Background spawns deliver intros as teammate messages.

(*MVOX:Palestrina*)
