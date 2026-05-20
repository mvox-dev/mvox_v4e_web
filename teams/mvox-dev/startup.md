# mvox-dev — Startup Checklist

Paths and step-by-step startup procedure for the mvox-dev team.

## Paths

All paths derived from two anchors:

| Anchor | How to resolve |
|---|---|
| `REPO` | `git rev-parse --show-toplevel` or the working directory |
| `TEAM_DIR` | `$HOME/.claude/teams/mvox-dev` (runtime, ephemeral) |

| Item | Path |
|---|---|
| Repo root | `$REPO/` |
| Team config dir | `$REPO/teams/mvox-dev/` |
| Runtime dir | `$TEAM_DIR/` |
| Roster | `$REPO/teams/mvox-dev/roster.json` |
| Common prompt | `$REPO/teams/mvox-dev/common-prompt.md` |
| Memory dir | `$REPO/teams/mvox-dev/memory/` |

## Startup Sequence

Execute in order. State each phase name before executing.

**CRITICAL: Do NOT call `TaskCreate` before Phase 2 completes.** Until then, the active task list is session-scoped (`~/.claude/tasks/<sessionId>/`). When `TeamCreate` runs in Phase 2, the active list switches to team-scoped (`~/.claude/tasks/mvox-dev/`). Any tasks created earlier are orphaned — invisible to teammates but their numbers can still leak into agent context and cause confusion (e.g., a teammate seeing a "task #N" that doesn't exist on the team list). Track Phase 0-1 progress mentally or in plain text. Create formal tasks starting Phase 4 (task restore, if needed) or Phase 5 (routing new work to teammates).

### Phase 0: Orient

Read these files in order:

1. This file (`startup.md`)
2. `roster.json` (roster — team members, models, roles)
3. `common-prompt.md` (mission, standards, shutdown protocol)
4. `memory/team-lead.md` (your scratchpad — prior session state)
5. `memory/task-list-snapshot.md` (prior session's task state, if exists)

**Expected outcome:** You know the team, the mission, and where you left off.

### Phase 1: Sync

```bash
REPO="$(git rev-parse --show-toplevel)"
cd "$REPO" && git pull
```

**Expected outcome:** Prompts, roster, and memory files are at HEAD.

### Phase 2: Establish team

Probe the harness's lead state by attempting `TeamCreate`. Branch on the result — there are three possible states:

1. Try `TeamCreate(team_name="mvox-dev")`.
2. Classify:
   - **Succeeds** → **State B (fresh start).** No prior team in harness state. Verify `ls "$HOME/.claude/teams/mvox-dev/config.json"` exists. No prior task list. Proceed to Phase 3.
   - **Fails with `"Already leading team"`** → harness session state survived from a prior session (typical cause: `/clear` was used instead of exiting the CLI). Inspect disk to distinguish A from C:
     - `config.json` present AND `leadAgentId == "team-lead@mvox-dev"` → **State A (warm reconnect).** Harness and disk agree; team is already operational. No action needed. Proceed to Phase 3. The existing task list survives untouched.
     - `config.json` absent OR `leadAgentId` mismatched → **State C (inconsistent).** Disk got wiped while the harness held the lead (e.g. someone ran the old "Phase 2: Clean" `rm -rf`). Only recovery is `TeamDelete` + `TeamCreate`, which destroys `~/.claude/tasks/mvox-dev/` as a side effect. Sequence: `TeamDelete(team_name="mvox-dev")` → `TeamCreate(team_name="mvox-dev")` → verify `config.json`. **Set a flag: task restore needed in Phase 4** (snapshot at `memory/task-list-snapshot.md` is the source of truth).
   - **Fails with any other error** → unexpected; read the error and decide manually. Do not blindly retry.

**Why State A is common:** `/clear` clears conversation context but does NOT exit the CLI process. The harness keeps its in-memory team-lead tracking. If the prior session's shutdown left `~/.claude/teams/mvox-dev/config.json` on disk, both halves of state are intact and `TeamCreate` is unnecessary — and will fail by design.

**Why the old "Phase 2: Clean" step was removed:** the previous procedure ran `rm -rf "$HOME/.claude/teams/mvox-dev"` before `TeamCreate`. With `/clear` (where harness state survives), this turns State A into State C — manufactured inconsistency, forced `TeamDelete`, wiped task list as collateral damage. Don't clean preemptively; let `TeamDelete` happen only when actually needed.

**Expected outcome:** `config.json` is current; you know whether tasks need restoring in Phase 4.

**CRITICAL:** Do NOT spawn any agents until Phase 2 verification passes. Do NOT call `TaskCreate` until Phase 2 settles (see CRITICAL banner at the top of this file).

### Phase 3: Restore inboxes

```bash
TEAM_CONFIG="$(git rev-parse --show-toplevel)/teams/mvox-dev"
TEAM_DIR="$HOME/.claude/teams/mvox-dev"

# Restore inboxes from repo (durable copy from prior session's shutdown)
if [ -d "$TEAM_CONFIG/inboxes" ]; then
  mkdir -p "$TEAM_DIR/inboxes"
  cp -r "$TEAM_CONFIG/inboxes/"* "$TEAM_DIR/inboxes/" 2>/dev/null || true
  echo "Inboxes restored from repo."
else
  echo "No inboxes to restore (first session or never persisted). This is OK."
fi

# Verify team is operational
if [ -f "$TEAM_DIR/config.json" ] && [ -d "$TEAM_DIR/inboxes" ]; then
  echo "Team mvox-dev operational: config.json OK, inboxes dir exists."
else
  echo "WARNING: Team infrastructure incomplete. Re-run Phase 2."
fi
```

**Note on State A:** inboxes from the prior session may still be in the runtime dir (they weren't wiped). The `cp` above is idempotent — it overwrites runtime copies with the repo copies, which should be equal or newer (per shutdown protocol).

**Expected outcome:** Inboxes restored from repo (or no-op if first session). Team operational.

### Phase 4: Restore tasks (conditional)

**Skip this phase if Phase 2 ended in State A or State B.** The task list is intact (State A: never touched; State B: empty and fine).

**Run only if Phase 2 ended in State C** — `TeamDelete` wiped `~/.claude/tasks/mvox-dev/` and the snapshot is now the only source. Recreate the active rows from `memory/task-list-snapshot.md`:

1. Read `teams/mvox-dev/memory/task-list-snapshot.md`.
2. For each non-completed row, call `TaskCreate(subject, description)` with the snapshot's subject + description verbatim.
3. Completed rows from the snapshot are NOT recreated. The recreated task list starts with fresh IDs; original numbering is lost — note this in your scratchpad if the originals are referenced anywhere (commits, PRs, prior agent messages).

**Expected outcome:** Active tasks from the prior session are visible to teammates. Lost ID numbering is acceptable collateral (closed-issue history lives in GitHub, not the local task list).

### Phase 5: Spawn

Spawn order:

1. **finn** + **bentham** (parallel — always-on roles, intros are independent) — wait for both intros before phase 2
2. **tallis** + **byrd** + **josquin** (parallel if working on independent issues)
3. **comenius** (only if i18n work is needed this session)
4. **victoria** (only if requirements analysis is needed this session)
5. **perotin** (only if seeding / data refresh / write-probe / data-quality work is needed this session — on-demand specialist)

Phase 1 is a gate: do not spawn implementer agents until finn + bentham have introed (research and review infrastructure must be ready).

**Before each spawn:** Check `config.json` for existing members with the same name.
- If agent already registered → `SendMessage` with the new task. Do NOT re-spawn.
- If agent not registered → Spawn via Agent tool with `run_in_background: true`.

**Spawn method depends on environment** (see `.claude/CLAUDE.md` "Spawn Method"):
- **Container:** use `spawn_member.sh` with the Pane Map.
- **Local:** use the `Agent` tool directly. The prompt is the content of `teams/mvox-dev/prompts/<name>.md`.

**Spawn checklist per agent:**

```
1. jq '.members[].name' "$HOME/.claude/teams/mvox-dev/config.json"  # check duplicates
2. Read prompt content from teams/mvox-dev/prompts/<name>.md
3. Spawn (env-specific method above) with name="<name>", team_name="mvox-dev", run_in_background=true
4. Wait for intro message from agent
```

### Phase 6: Ready

Send ready message to user. Wait for task assignment.

---

## Known Environment Issues

### Common (both envs)

- **TeamCreate silent failure** — can return success but not write `config.json`. Always verify with `ls "$HOME/.claude/teams/mvox-dev/config.json"` after TeamCreate. Max 1 retry with TeamDelete before retry.
- **pnpm, not npm** — this is a pnpm workspace. All commands use `pnpm`.

### Container env

- Runs inside a Docker container (Ubuntu 24.04). `$HOME=/home/ai-teams`, workspace at `/home/ai-teams/workspace`.
- **`$HOME` edge case:** If `$HOME` is empty in any shell context, re-resolve: `HOME="/home/ai-teams"`.
- Pane Map applies — see `.claude/CLAUDE.md` "Container Pane Map".
- Spawn via `spawn_member.sh`.

### Local env

- `$HOME=/home/<user>` (no rewrite needed). Workspace path: resolve via `REPO="$(git rev-parse --show-toplevel)"`.
- No tmux Pane Map. Spawn agents via the `Agent` tool with `run_in_background: true`, `name: "<name>"`, `team_name: "mvox-dev"`. The agent's prompt is the content of `teams/mvox-dev/prompts/<name>.md`.

(*FR:Volta*)
