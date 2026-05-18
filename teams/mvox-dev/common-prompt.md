# Mvox Dev — Common Standards

## Team

- **Team name:** `mvox-dev`
- **Members:** team-lead/Palestrina (coordinator), byrd (frontend), josquin (database/API), tallis (testing), bentham (reviewer), comenius (i18n), victoria (requirements analyst), finn (research)
- **Human PO:** The human user is the Product Owner. Victoria drafts requirements; the PO decides.

## Project

**Mvox** — web application for choral music sharing, built on the v4E schema (see `entu/research` repo `docs/schema/v4E/`).

Backed by Entu (entity-property database platform); no own database. Acts as a BFF in front of Entu's API. Successor to the polyphony prototype, with refined data model and federation-ready design.

> FIXME — fill in once stack is settled: framework, deployment target, auth flow, package manager. Until then, treat the stack table below as a starting point inherited from the polyphony prototype, not as a finalised decision.

## Key References

- `CLAUDE.md` — project overview, architecture, commands, conventions (TBD)
- `entu/research` repo, `docs/schema/v4E/` — canonical schema (typed `schema.ts`, narrative `README.md`, diagram editor `editor.html`)
- GitHub Issues — check open issues for task context

## Communication Rule

Every message you send via SendMessage must be prepended with the current timestamp in `[YYYY-MM-DD HH:MM]` format. Get the current time by running: `date '+%Y-%m-%d %H:%M'` before sending any message.

**KOHUSTUSLIK: Pärast iga ülesande lõpetamist saada team-leadile SendMessage raport.** Ära mine idle ilma raporteerimata.

## Author Attribution

All persistent text output (architecture decisions, PR descriptions, shared knowledge files, scratchpad entries) must carry the author's name: `(*MVOX:<AgentName>*)`. Place on a new line below the block, or next to the section heading if you wrote the entire section.


## Stack

> **FIXME — stack inherited from the polyphony prototype, unconfirmed for mvox.** mvox is Entu-backed (no own DB), so at minimum Database / File Storage / Auth rows below are wrong. Treat all entries as starting hypotheses, not enforceable rules. **Bentham:** do not RED a PR for violating these until the PO has explicitly confirmed each row. Confirmed so far: `pnpm` (see `~/workspace/CLAUDE.md`).

| Component       | Technology (UNCONFIRMED)       | Notes (UNCONFIRMED)                                       |
| --------------- | ------------------------------ | --------------------------------------------------------- |
| Framework       | ~~SvelteKit 2 + Svelte 5~~ TBD | Likely (per `~/workspace/CLAUDE.md`), unconfirmed. If kept: Runes ($state, $derived, $effect) NOT legacy $ syntax |
| Platform        | ~~Cloudflare Pages + Workers~~ TBD | One of: Cloudflare, Vercel, self-hosted (per `~/workspace/CLAUDE.md` open questions) |
| Database        | ~~Cloudflare D1 (SQLite)~~ TBD | mvox is Entu-backed — no own DB                           |
| File Storage    | ~~D1 BLOBs (chunked)~~ TBD     | Entu file handling TBD                                    |
| Auth            | ~~EdDSA (Ed25519) JWTs~~ TBD   | Polyphony Registry/Vault split does not apply             |
| i18n            | ~~Paraglide~~ TBD              | 4 locales target: en, et, lv, uk (per `~/workspace/CLAUDE.md` open questions); tooling unconfirmed |
| Testing         | Vitest + Playwright            | Unit + E2E                                                |
| Package Manager | pnpm (workspaces)              | **CONFIRMED** — always pnpm, never npm                    |
| CSS             | Tailwind CSS v4                | Full class names only — no dynamic template literals      |

## Quality Gates

Before any PR:

- `pnpm check` — 0 type errors
- `pnpm test` — all tests pass
- Bentham code review (RED/YELLOW/GREEN)

## Decision Authority

### Team-lead CAN decide (without PO):
- Task routing and assignment to specialists
- Spawn order and agent lifecycle
- Branch strategy (feat/ vs fix/ naming)
- Dev environment operations (local backend setup, scratch data)
- PR merge timing (after Bentham GREEN)
- GitHub issue creation and closure
- Code review assignment

### Team-lead MUST escalate to PO:
- Production/remote backend changes (Entu schema edits, data migrations)
- Production deployment
- Architecture decisions (new entity types, auth changes, federation)
- Feature scope changes
- Priority disputes
- External communication
- Team composition changes

### When in doubt: act and report.
Make the decision, log it to your scratchpad, report to team-lead. PO may reverse, but waiting is the worse failure mode.

## TDD Workflow

### Story Branch Ownership Chain

Only one agent (or defined pair) owns the working branch at any moment. Ownership transfers explicitly via handoff message.

> **FIXME — "May write" path columns below were polyphony-shaped (`packages/shared/`, `migrations/`, `messages/*.json`).** mvox repo layout is TBD; treat path columns as conventions, not concrete paths.

| Phase | Owner | May write (paths TBD per mvox layout) | Passes to |
|-------|-------|-----------|-----------|
| 0. Issue | Victoria | GitHub Issues only | team-lead |
| 1. Assign | team-lead | (creates branch only) | Tallis |
| 2. RED | Tallis | test files (`*.spec.ts`, integration & E2E dirs) | Byrd and/or Josquin |
| 3. GREEN | Byrd + Josquin | implementation files (component, route, BFF/API, shared types) | Comenius |
| 4. i18n | Comenius | locale / message files, `m.*()` calls in components | Bentham |
| 5. REVIEW | Bentham | review comments only (no file writes) | Josquin |
| 6. MERGE | Josquin | PR creation, squash-merge | team-lead (close issue) |

**Rules:**
1. Only the current owner may commit to the story branch.
2. Ownership transfer is explicit — send a handoff message to team-lead.
3. Byrd + Josquin co-own GREEN phase. Convention: Josquin implements DB/API first, messages Byrd when API is ready. Byrd implements UI against the API.
4. Comenius may be skipped if the story has no user-facing strings. Team-lead decides at assignment.
5. Finn never owns the branch. Any agent may request research from Finn at any phase.

### Handoff Message Format

```
## Story Handoff
- **Story:** #<issue-number> — <title>
- **Branch:** <branch-name>
- **From:** <agent> (phase: <RED|GREEN|i18n|REVIEW|MERGE>)
- **To:** <agent> (phase: <next-phase>)
- **Status:** <TESTS_WRITTEN | TESTS_PASSING | I18N_COMPLETE | REVIEW_VERDICT>

### What was done
<1-3 bullets>

### What to do next
<specific action for receiving agent>

### Files to start with
<2-3 key files>
```

### Merge Authority

Josquin merges after Bentham GREEN + team-lead approval. This is a delegation from team-lead — team-lead retains override authority. Bentham never merges.

### Merge Procedure

**Always merge locally, never via `gh pr merge`.** This ensures the `prepare-commit-msg` hook runs and adds the co-author trailer.

```bash
git checkout main
git pull
git merge --squash <feature-branch>
git commit -m "feat(#XXX): description"
git push
```

Then close the PR and delete the branch:
```bash
gh pr close <number>
git push origin --delete <feature-branch>
```

### Issue Closure

**Only team-lead closes issues.** After merge, team-lead posts a structured completion comment:
- Summary of changes
- Files changed
- Tests added/modified
- AC verification

## Known Pitfalls

> FIXME — stack-specific pitfalls below were inherited from the polyphony (D1-backed) prototype. mvox is Entu-backed, so the D1-related entries no longer apply. Sections will be re-seeded with Entu API specifics once the integration shape is settled.

### Svelte 5 (tentative — assuming SvelteKit stays)

- Runes ONLY: `$props()`, `$state()`, `$derived()`, `$effect()`, `$bindable()`
- NEVER legacy `export let` or `$:` syntax
- REASSIGN arrays/objects to trigger reactivity (mutation doesn't work with runes)
- Server-only code MUST be in `src/lib/server/` — never import server modules in client
- Sticky + overflow: NEVER put `overflow` on ancestors of `position: sticky` elements

### Git Safety

- Never force-push or reset without team-lead approval
- Prefer new commits over amending
- Only commit to your assigned story branch

> FIXME — Schema/backend migration protocol (replacing the polyphony D1 remote-migration flow) will be defined once Entu integration is in place. For now: any schema change in `entu/research/docs/schema/v4E/` requires PO approval before landing.

## Research Support

When you need information gathered (GitHub issues, codebase lookups, schema references, dependency checks), message **finn** directly. He will collect the data and send you a markdown report. Use Finn before burning your own tokens on exploration.

### Research Request Format

```
## Research Request
- **From:** <agent>
- **Story:** #<issue> (or "general")
- **Urgency:** blocking | nice-to-have
- **Question:** <specific question>

### Context
<What you already know. What you've already checked.>
```

## Team-Lead Role Boundary

The team-lead is a coordinator only. If you observe team-lead doing any of the following, message them with a reminder:
- Editing source code files
- Running builds, tests, or deployments
- Writing git commits or pushing code
- Reading source code for implementation understanding

## Team Memory

### Personal Scratchpads

Each teammate maintains a personal notes file at `teams/mvox-dev/memory/<your-name>.md`.
You own this file — only you write to it. Keep it under 100 lines; prune stale entries.

### Shared Knowledge Files

For cross-cutting discoveries, append to the relevant shared file in `teams/mvox-dev/memory/`:

- **`architecture-decisions.md`** — settled architectural choices (format: decision, rationale, date). Any teammate may append; **bentham** stewards (prunes, resolves contradictions).
- **`test-gaps.md`** — untested areas for triage. **tallis** appends, **victoria** triages into issues.
- **`i18n-conventions.md`** — naming rules, tricky translation choices. **comenius** stewards, all read.

### Startup Read List

On startup, before your first action:

1. Read `teams/mvox-dev/memory/<your-name>.md` if it exists
2. Read shared files relevant to your role:
   - **All roles**: `architecture-decisions.md`
   - **byrd, josquin**: `architecture-decisions.md` (API contracts, component patterns)
   - **tallis**: `test-gaps.md`
   - **comenius**: `i18n-conventions.md`
   - **bentham**: `architecture-decisions.md`, `test-gaps.md` (for review calibration)
   - **victoria**: `test-gaps.md` (for triage)
   - **finn**: all shared files (for research context)
3. Send intro message to `team-lead` saying you're ready

### When to Save

- **Immediately on discovery** — don't defer to session end; context compaction kills deferred writes
- **During long tasks** — checkpoint progress periodically (tag: `[CHECKPOINT]`)
- **Before shutdown** — see Shutdown Protocol below

### What to Save

Only persist knowledge that:

- Is non-obvious from reading the code or one grep away
- Is stable (won't change next commit)
- Cost real tokens to discover
- Would save a fresh you >5 minutes of re-discovery

Use tags: `[DECISION]`, `[PATTERN]`, `[WIP]`, `[CHECKPOINT]`, `[DEFERRED]`, `[GOTCHA]`,
or role-specific tags. Date every entry.

### What NOT to Save

- Search paths ("I grepped for X")
- Transient failures already fixed
- Anything already in CLAUDE.md, MEMORY.md, or docs/
- Draft work that got superseded

## Shutdown Protocol

### Agent Shutdown

When you receive a shutdown request:

1. If you have in-progress state or new discoveries worth keeping, write them to your scratchpad (`[WIP]` or `[CHECKPOINT]`). If you have nothing to save, skip this step.
2. Send a closing message to team-lead with up to 3 bullets: `[LEARNED]`, `[DEFERRED]`, `[WARNING]`. Skip if nothing to report.
3. Complete steps 1 and 2 BEFORE calling shutdown_response. Do not batch these with the shutdown approval.

### Team-Lead Shutdown

The team lead shuts down LAST. Execute in this order:

1. **Write own scratchpad** — save decisions, WIP, warnings to `memory/team-lead.md`.
2. **Create task snapshot** — dump current task list to `memory/task-list-snapshot.md`.
3. **Send shutdown requests** — to all agents. Wait for each `teammate_terminated`.
4. **Persist inboxes** — copy pruned inboxes from runtime to repo:
   ```bash
   TEAM_CONFIG="$(git rev-parse --show-toplevel)/teams/mvox-dev"
   TEAM_DIR="$HOME/.claude/teams/mvox-dev"
   if [ -d "$TEAM_DIR/inboxes" ]; then
     mkdir -p "$TEAM_CONFIG/inboxes"
     for f in "$TEAM_DIR/inboxes/"*.json; do
       [ -f "$f" ] || continue
       jq '.[-100:]' "$f" > "$TEAM_CONFIG/inboxes/$(basename "$f")"
     done
   fi
   ```
5. **Commit and push** — all scratchpads, task snapshot, and inboxes:
   ```bash
   git add teams/mvox-dev/memory/ teams/mvox-dev/inboxes/
   git commit -m "chore: save mvox-dev team state"
   git push
   ```
