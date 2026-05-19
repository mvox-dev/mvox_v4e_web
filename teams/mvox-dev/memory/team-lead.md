# Palestrina — Team Lead Scratchpad

### [NEXT SESSION] 2026-05-19 — session-5 → session-6

**Launch this session from `~/workspace`, NOT from `~`.** The new convention pinned at the top of `~/.claude/CLAUDE.md`: `cd ~/workspace && claude`. Required so the statusline (`~/workspace/.claude/statusline-command.sh`) resolves via `CLAUDE_PROJECT_DIR`, and so the workspace-scoped permissions/hooks in `~/workspace/.claude/settings.json` activate. Verify by checking that you have a statusline at the bottom of the terminal — if not, you launched from the wrong dir.

**Session 5 was a procedural-surgery session, not a migration session.** Migration path (the actual headline work from session-4 → session-5 seed) did NOT advance. Finn's handbook at `docs/migration/entu-schema-mutation-handbook.md` remains UNREAD. The 6 open questions for PO are still queued. Phase A design has not started. Session 6 picks up exactly where session 5 was supposed to start.

**What landed in session 5:**
- **`startup.md` repaired** — `mvox-dev/mvox_v4e_web@f58910d`. Old Phase 2 (`rm -rf`) removed; new Phase 2 ("Establish team") is a three-state probe (A: warm reconnect / B: fresh / C: inconsistent). Conditional new Phase 4 restores tasks from snapshot only in State C. Renumbering: 0 Orient, 1 Sync, 2 Establish, 3 Restore inboxes, 4 Restore tasks (conditional), 5 Spawn, 6 Ready. Phase 5/6 numbers unchanged.
- **Brilliant article published** — `Patterns/team-startup-clear-soft-restart` (id `d6a33567-c5da-443b-b047-5303d3bea21d`), intelligence type, shared sensitivity. 4 `relates_to` links: `Methods/team-design`, `Teams/ai-teams/framework-research`, `Teams/ai-teams/mvox-dev`, `Projects/ai-teams`.
- **FR issue comment** — `mitselek/ai-teams#62` got a comment with the mvox-dev three-state probe as an alternative to Schliemann's "always TeamDelete" proposal. Side-by-side trade-off table; FR picks the canonical template approach.
- **Launch convention pinned** — `~/.claude/CLAUDE.md` top of file now mandates `cd ~/workspace` before launching Claude. Will be true for ALL future sessions of this assistant on this host.

**Task ID disclaimer for session 6** — session-4's task IDs (#1–#7 incl. completed CHORE-1) were wiped at session-5 startup when the broken Phase 2 forced a `TeamDelete` recovery. I recreated active tasks with fresh IDs (#1–#6, all pending, no "completed CHORE-1" marker). Any agent message or commit message from session 4 or earlier that references "task #N" by number is now stale. The `task-list-snapshot.md` at end of session 5 reflects the fresh numbering; treat it as authoritative.

**Don't trust the recovered task list as a faithful image of pre-session-5 state.** The migration work (current #6, was old #7) is still in_progress conceptually — Finn already delivered the handbook in session 4 — but the live task is `[pending]` because TaskCreate has no way to set partial-progress status. Treat it as a notional pointer; the real state of the migration work lives in the handbook itself + the open PO questions.

**Expected first action session 6:**
1. Verify statusline appears (sanity check on launch-dir convention).
2. Read Finn's `docs/migration/entu-schema-mutation-handbook.md` end-to-end.
3. Summarize the 6 open questions for PO + the 8 doc-improvement-issue candidates.
4. Triage with PO: which questions need Argo input, which PO decides directly, which doc-improvement issues to file.
5. Once questions are settled, design Phase A as a concrete sequence of API calls. PO and I previously agreed Phase A's first probe could be adding `event.capacity` (single property, no data backfill) — re-confirm or pick a smaller probe based on what the handbook reveals.

**Carryforward from session-4 → session-5 seed (NOT yet processed):**
All items in the next block ("[PROCESSED 2026-05-19] session-4 → session-5" after this entry) describe migration work that session 5 did not touch. That seed is still load-bearing for session-6 startup — read it after this one.

**Mvox repo state at end of session 5:**
- `main` HEAD: **f58910d** chore(mvox-dev): repair startup procedure for /clear soft-restart
- Previous commits unchanged from end of session 4 (`8742ec7`, `d69186a`, `e7cf148`, ...)
- All pushed to origin/main.
- Working tree clean (after this shutdown commit lands).

**Pending PO decisions (queued from session-4 seed, untouched):**
- Migration commit attribution convention (`Schema-Change:` trailer direction reverses for migration PRs vs consumption PRs).
- Where migration code lives — entu/research `scripts/migrations/...` is my instinct.
- Backup strategy before Phase B/C/D (polyphony db has real ESL data: 6 choirs, 116 members at Kammerkoor Crede).
- 8 Entu doc-improvement issue candidates queued for PO+team-lead review before filing against whichever Entu docs repo applies.

**Brilliant entries created this session (for cross-reference next time):**
- `Patterns/team-startup-clear-soft-restart` (d6a33567-c5da-443b-b047-5303d3bea21d) — startup-procedure gotcha. Linked from Methods/team-design, Teams/ai-teams/framework-research, Teams/ai-teams/mvox-dev, Projects/ai-teams.

(*MVOX:Palestrina*)

---

### [GOTCHA] 2026-05-19 (session 5) — `/clear` vs CLI exit; startup procedure rewritten

`/clear` clears conversation context but does NOT exit the Claude Code CLI process. The harness keeps its in-memory team-lead tracking across `/clear`. If you then run the old "Phase 2: Clean" (`rm -rf ~/.claude/teams/mvox-dev/`), you land in:

- Disk: no `config.json`
- Harness: still claims I lead the team
- `TeamCreate` → fails ("Already leading")
- Only escape: `TeamDelete` (which ALSO wipes `~/.claude/tasks/mvox-dev/`)

Hit exactly this at session-5 startup. Session-4 task IDs #1–#7 got wiped at the `TeamDelete` step; I had to recreate active tasks from `task-list-snapshot.md` with fresh IDs #1–#6 (and the snapshot's "completed #1" status was lost — it's just unrecorded now).

**Fix landed in `startup.md` (this session):**
- Old Phase 2 (`rm -rf`) removed — that step was actively manufacturing the broken state.
- New Phase 2 ("Establish team") probes by trying `TeamCreate` first and branches on the result into three states:
  - **State A (warm reconnect, `/clear` case)** — `TeamCreate` fails "Already leading", disk matches → no-op, tasks intact.
  - **State B (fresh CLI start)** — `TeamCreate` succeeds → done, no tasks.
  - **State C (inconsistent)** — `TeamCreate` fails, disk doesn't match → only path is `TeamDelete` + `TeamCreate`, accept task loss.
- New Phase 4 restores tasks from `memory/task-list-snapshot.md` only when Phase 2 ended in State C.
- Phase numbering renumbered: 0 Orient, 1 Sync, 2 Establish, 3 Restore inboxes, 4 Restore tasks (conditional), 5 Spawn, 6 Ready. Phase 5/6 numbers unchanged; only middle phases reshuffled.
- `~/.claude/CLAUDE.md` quick-summary updated to match.

**Behavioral implication for the common path (`/clear` between sessions):** State A is now cost-free — no cleanup, no recreate, tasks preserved. PO confirmed `/clear` is the typical inter-session transition; treat it as the default.

(*MVOX:Palestrina*)

---

### [PROCESSED 2026-05-19] session-4 → session-5 seed — NOT processed in session 5

Session 5 was diverted to startup-procedure surgery; the migration work this seed describes did not advance. Read this entire section as session-6 startup material (it is the live state-of-play for the migration). Downgrade tag when session 6 actually executes against it.

Original session-4 → session-5 seed text follows:

### [NEXT SESSION] 2026-05-19 — session-4 → session-5

**Headline finding (most important context for session 5)**: the polyphony Entu db is **NOT v4E** — it's the pre-v4E polyphony schema. We discovered this late in session 4 when PO asked the question I should have asked earlier ("is the live schema actually in sync?"). Finn's full diff in his session-4 report: 9 of 19 v4E entity types absent; every present type has missing properties or type/name divergences; all 5 PR #41 additions absent; `organization._inheritrights: true` in db vs `false` in v4E (directly contradicts the load-bearing Section B3 rights-island invariant). DB also has 4 superseded pre-v4E entity types live (`affiliation`, `participation`, `inventory_copy`, `role`).

**PO decision 2026-05-19 00:35**: **migrate polyphony db to v4E in-place** (not new db, not pivot to pre-v4E). Dual motivation: preserve real data (6 choirs, 116 members) AND learn Entu's live schema-mutation API. Multi-session execution expected. Migration plan (4 phases by risk):

- **Phase A (additive, low risk)**: 9 missing entity types as empty defs + missing properties on existing types + all 5 PR #41 additions
- **Phase B (renames, moderate)**: `voicing`→`original_voicing`, `voice_type`→`voice`, `duration`→`original_duration`, `language`→`original_language`, `ordinal`→`display_order`
- **Phase C (structural, high)**: split `participation`→`rsvp`+`attendance`; restructure `affiliation` into v4E org-tree; rename `inventory_copy`→`copy` + extract `assigned_to` into `lending`
- **Phase D (rights + cleanup)**: flip `organization._inheritrights` true→false; adjust per-type `_sharing` to v4E spec; remove superseded entity types after data migrated

**Expected first action (session 5): read Finn's overnight migration-handbook report** (he's running it as I write this; deliverable: API surface for the 8 schema-mutation operation classes, per-operation feasibility ratings, migration phase mapping, open questions for PO, doc-improvement-issue candidates against Entu). Once we have the handbook, design Phase A as a concrete sequence of API calls, ideally captured as an `entu/research` PR (migration script) since v4E mutations go through that repo per architecture-decisions.md.

**Open questions PO will need to weigh in on (queue these for session 5 morning)**:
- How does PO want migration commits attributed in entu/research? Existing convention is `Schema-Change: entu/research@<sha> "..."` + `PO-Approved: <date>` trailers in mvox PRs that consume schema changes — but for the migration itself the cause/effect is reversed (entu/research PR causes a db change).
- Should the schema-as-data migration code live in entu/research, mvox repo, or somewhere else? My instinct: entu/research, as `scripts/migrations/<date>-<phase>-<short-name>.ts` or similar — keeps schema and migration co-located.
- Backup strategy before Phase B+C+D — polyphony db has real ESL data (per `Projects/polyphony` brilliant entry: pilot at polyphony.uk for Kammerkoor Crede). Even Phase A is supposedly additive but accidents happen. Does Entu have a snapshot mechanism? Or do we export-via-API and store offline?

**Mvox repo state (frozen at end of session 4)**:
- `main` HEAD: `e7cf148` chore(mvox-dev): correct Entu docs URL in josquin prompt
- `7892b1d` chore(mvox-dev): correct Entu API base URL in josquin prompt — mid-session prompt fix (api.entu.app subdomain)
- `e7cf148` chore(mvox-dev): correct Entu docs URL in josquin prompt — mid-session prompt fix (entu.ee/overview/)
- `6962329` feat(#1): bootstrap SvelteKit + adapter-cloudflare — CHORE-1 squash-merge, 10/10 tests, includes Tallis RED + Josquin GREEN + hook installer
- `17e74d8` Tallis [PROCESS] note: team-config commits belong on main not feature branches
- `85da3ee` Bentham scratchpad CHORE-1 calibration anchor
- All pushed to origin. Working tree clean.

**Hook installed and verified working**: `.githooks/prepare-commit-msg` + `scripts/install-hooks.sh` + `package.json` `prepare` script. Self-applied trailer on the very commit that installed it (`4489d83` on feat/1-bootstrap, absorbed into the squash). Every new commit going forward will have `Co-authored-by: Mihkel Putrinš <mihkel.putrinsh@gmail.com>` appended. Commits pre-hook (everything before `4489d83`) don't have it; PO accepted this — no history rewrites.

**Issue backlog state (mvox-dev/mvox_v4e_web)**:
- Closed: #1 (CHORE-1 bootstrap, see closing comment)
- Open: #2 Tailwind, #3 Paraglide, #4 Vitest+Playwright docs, #5 Entu BFF skel, #6 Email, #7-#20 user stories, #21-#23 admin, **#24 README rewrite** (new), **#25 packageManager pin** (new)
- **Critical reordering**: #2 / #3 / #4 are still parallel-runnable (they don't depend on Entu schema). **#5 (BFF skeleton) is now blocked by the migration — do not start until at least Phase A of migration is done**. Same for any user-facing story (#7-#23 all touch v4E entity shapes).
- **CHORE-4 is ~90% done** — Tallis already added vitest.config.ts and playwright.config.ts during CHORE-1, plus build-config tests count as the "trivial passing test" AC. Only AC remaining: "co-location convention documented" — basically a CONTRIBUTING.md section. Could close very fast.

**Calibration anchor (Bentham, session-4 CHORE-1 review)**: First-PR end-state is GREEN. Stack-table rows now enforceable. RED bar: security boundary violations, multi-hop formula attempts, missing Schema-Change/PO-Approved trailers on v4E touches, legacy Svelte syntax, npm-instead-of-pnpm, monorepo dirs, forbidden CF bindings, TDD violations. YELLOW bar: doc/README staleness, missing trailers, stale scratchpads, minor test gaps. Recorded in `teams/mvox-dev/memory/bentham.md`.

**Process lessons from session 4 (worth remembering)**:
- Don't trust "the schema is the schema" — verify the LIVE database matches the typed definitions before designing features against it. Asking the question 4 hours into a session is far better than 4 weeks. (Original sin: session-3 closed without ever verifying polyphony was v4E-shaped; I assumed it was just because the case study was about polyphony.)
- Per-commit reviews must use `git show <sha>:<path>` — never trust the worktree, which gets contaminated by untracked WIP that shadows commit content (Bentham's CHORE-1 YELLOW #1 retraction was caused by exactly this).
- Mid-session prompt patches go to `main`, not feature branches (the api.entu.app and entu.ee fixes both committed directly to main). Tallis also needed this reminder — captured in his scratchpad.
- "Pause before push" convention applies to **team-lead shutdown commits**, NOT to mid-session scratchpad/team-config commits. Bentham over-applied it once in session 4. Convention should probably be clarified in common-prompt.md.
- Playwright tests must NOT do `pnpm build` inline — the build rewrites hashed chunks and crashes the running preview server (race surface). Build-output invariants belong in vitest.
- Local Entu instance available via docker-compose in `~/projects/entu-research/` (file: `docker-compose.entu.yml`). I haven't fired it up; Finn may have. Worth knowing for session 5 if we need a sandbox before touching the live db.

**Concrete pointers for session 5 (no re-discovery)**:
- Finn's session-4 divergence report: in his last conversation turn; not persisted to a file. **If we want the finding outside conversation memory, mirror to a brilliant entry or in-repo doc.** Suggest creating `Decisions/mvox/polyphony-v4e-divergence` in brilliant + linking to the 8 existing `Decisions/mvox/*` entries.
- Finn's session-4 migration handbook: he's writing it as I write this. He'll deliver to me as a SendMessage. **Save the handbook content to either `entu/research/docs/migration/` or a brilliant entry as soon as he delivers** — don't let it die in chat.
- Entu canonical docs: `https://entu.ee/overview/` (not entu.dev — fixed in josquin prompt this session).
- API base: `https://api.entu.app/{db}/` (subdomain form — also fixed in josquin prompt this session).
- Credentials: still at `~/.config/mvox/credentials.env`, chmod 600.
- v4E source-of-truth: `~/projects/entu-research/docs/schema/v4E/{schema.ts,README.md}` — no changes since PR #41.
- Entu may run locally via `~/projects/entu-research/docker-compose.entu.yml` — UNCONFIRMED whether fires up, but worth checking before touching live polyphony db.
- Brilliant entries to consult: `Projects/polyphony` (long body — v4E design history Topics 1+2), `Projects/entu-research`, `Teams/entu`, the 8 `Decisions/mvox/*` from session 3.

**Suggested session-5 sequence**:
1. Read Finn's handbook (in inbox at session-5 startup).
2. Spawn finn + bentham as always. Don't spawn implementers until migration design is set.
3. PO + me: triage Finn's open questions, settle the few that need PO input.
4. Pick the smallest meaningful additive change as a learning probe (suggest: add `event.capacity` from PR #41 — single property addition, no data backfill, validates the API call shape). Either I execute via raw Bash/curl with PO over my shoulder OR Josquin executes — TBD by complexity revealed by Finn.
5. Document what we learned in the migration handbook (it becomes living doc as we execute).
6. Capture results in brilliant + the entu/research case study.
7. Iterate. Phase A in full is ~20-40 small operations; pace them.
8. If Phase A goes smoothly, queue Phase B for next session. Don't push past Phase A in one session.

**Don't forget after Finn delivers tonight**:
- Save his migration handbook to a persistent location (in-repo doc or brilliant entry).
- File doc-improvement issues he flagged against the Entu docs repo (whichever that turns out to be; he'll identify) — PO + me review first, don't auto-file.
- Create the `Decisions/mvox/polyphony-v4e-divergence` brilliant entry mirroring tonight's finding + the in-place migration decision.

---

### [PROCESSED 2026-05-19] session-3 → session-4 seed

Original seed text below. Processed in session 4 — CHORE-1 (#1) merged + closed end-to-end (10/10 tests GREEN, hook installed). Filed #24 (README) + #25 (packageManager) as Bentham YELLOW followups. Then session pivoted to the polyphony-v4E divergence finding (see session-4 → session-5 seed at top). Tag downgraded so future sessions don't double-process this seed.

**Where we are**: v1 backlog is live. **23 GitHub issues open at `mvox-dev/mvox_v4e_web` as #1–#23** — 6 scaffolding chores + 14 user-facing stories + 5 admin/manager stories. PO authorized opening all of them in this session. No app code yet — first TDD cycle is the next concrete step.

**Expected first action (session 4): spawn Tallis + Josquin and start CHORE-1 (Bootstrap SvelteKit app with Cloudflare adapter, issue #1).** It's the unblocker for everything else (CHORE-2 Tailwind, CHORE-3 Paraglide, CHORE-4 Vitest+Playwright, CHORE-5 Entu BFF skeleton, CHORE-6 Email all extend the scaffold).

**Per Bentham's session-2 [WARNING] — still relevant**: the first PR (bootstrap + auth + first BFF endpoint) carries disproportionate review weight. Cookie flags, CSRF posture, `$env/dynamic/public` discipline, BFF URL composition all set precedent. Bentham budgeting closer review. Suggest landing scaffolding chores as ~6 separate small PRs rather than one big one — easier to review, easier to isolate regressions.

**PO action items I'm tracking for session 4**:
- **CHORE-6 (issue #6) requires SPF + DKIM DNS records on the chosen sender domain.** PO action — Josquin can't do this. Should be done before ADMIN-3 (issue #21) GREEN phase, not before CHORE-6 GREEN (which just wires the provider). Pick a sender domain (probably `multivox.pages.dev` or a custom domain).
- No other PO-blocked work pending.

**Concrete pointers (no re-discovery)**:
- GitHub issues: https://github.com/mvox-dev/mvox_v4e_web/issues — 23 open, sequential #1–#23
- 13 labels created in repo (`chore`, `scaffolding`, `i18n`, `testing`, `backend`, `epic-a`/`b`/`c`/`d`, `singer`, `conductor`, `admin`, `onboarding`). No `manager` (collapsed into `admin`).
- Credentials: `~/.config/mvox/credentials.env` (chmod 600 — Entu API key + Cloudflare token + account ID `1431b76f0b65e3d23833966744ff2bdf`; CF token currently has Pages-read scope, needs Pages-Edit upgrade for `wrangler pages deploy`).
- Cloudflare Pages project name: `multivox` (settled session 3). `multivox.pages.dev`. `mvox.pages.dev` is third-party owned.
- v4E schema source-of-truth: `~/projects/entu-research/docs/schema/v4E/{schema.ts,README.md}` — PR #41 is **MERGED** (2026-05-18 10:33Z), 5 new properties are live (`organization.rsvp_lockout_hours`, `event.capacity`, `repertoire_item.status`, `edition.external_link`, +1).
- Auth flow reference impl: `~/projects/entu-research/src/lib/server/entu/auth.ts` + `src/test/api/api-key-exchange.spec.ts` — Josquin should read both before CHORE-5.
- Architecture decisions: `teams/mvox-dev/memory/architecture-decisions.md` (in-repo, working file, Bentham stewards) + brilliant KB mirror at `Decisions/mvox/*` (8 entries).

**Brilliant KB integration landed this session**:
- `Projects/mvox` entry: `ef517671-e3a3-4e43-ad1f-8c00479f4773`
- `Teams/ai-teams/mvox-dev` entry: `9a16ed48-fee0-4731-b183-67488b860ec4`
- 8 `Decisions/mvox/*` entries (stack, repo-layout, schema-as-contract, schema-mutation-gate, bff-user-rights-default, formula-rules, test-data-strategy, cloudflare-project-name)
- 13 typed edges linking everything (project ↔ polyphony/entu-research/Teams/entu, team → project, 8× decision → project, mvox-dev ↔ polyphony-dev sibling)
- **Dual-write discipline going forward**: when Bentham appends a new entry to `architecture-decisions.md`, mirror to `Decisions/mvox/<slug>` in brilliant. I (team-lead) handle the mirror; Bentham stewards the in-repo file.
- Design history for v4E (Topic 1 + Topic 2 narrative) lives in `Projects/polyphony` body — don't duplicate, link.

**Suggested session-4 task sequence**:
1. Spawn Tallis + Josquin in parallel.
2. Hand Tallis issue #1 (CHORE-1 bootstrap) — he writes a RED smoke-test ensuring `pnpm build` produces `.svelte-kit/cloudflare/` output and `pnpm check` returns 0.
3. Josquin GREENs against the RED.
4. Bentham reviews (first PR — extra calibration scrutiny per session-2 WARNING).
5. Josquin squash-merges locally (NOT `gh pr merge`).
6. team-lead closes #1, then routes #2/#3/#4 (Tailwind, Paraglide, Vitest+Playwright — independent, can be parallelized).
7. Reserve #5 (Entu BFF skeleton) for after #1 is solid since it builds on the SvelteKit shell.
8. #6 (Email) can ride alongside #5 if PO has done the DNS work.

**Stack-order considerations**: #1 → #2 (Tailwind needs the SvelteKit shell) → #3/#4 parallel → #5 (BFF) → #6 (Email). A1/A2 (#7/#8) are the first user-facing stories; they need #1 + #5 minimum.

**Known runtime issue noticed this session**: the team task list at `~/.claude/tasks/mvox-dev/` got cleared mid-session at least twice (highwatermark reset; JSON files vanished). Investigate or work around. Suspect either an out-of-band cleanup hook or a bug in TaskUpdate when the task ID changes during the call. Not blocking — conversation context is the durable source — but if it persists, consider tracking work in `memory/wip.md` instead of TaskCreate.

When you've processed this seed, downgrade the tag from `[NEXT SESSION]` to `[PROCESSED 2026-05-18]` or remove the section.

---

### [CHECKPOINT] 2026-05-18 (session 3) — post-PO-decisions work

After the [DECISION] entry below (which captured the 5 gap resolutions and was committed in `1dba87e`), this session continued:

**Brilliant KB integration**: PO surfaced mid-session that the brilliant database is available. Explored: 231 entries, admin role, owner = PO personally. `Projects/polyphony` is the design home for v4E (Topic 1/2 narrative as `(*PD:Palestrina*)` appends). Created stubs + mirror per PO direction: 1 project + 1 team + 8 decision entries + 13 typed edges. See [NEXT SESSION] above for IDs.

**Victoria's first task**: spawned Victoria for the issue-filing pass. She drafted 23 issues (6 chores + 14 user-facing + 5 admin) with 3 flagged-for-PO questions (A4/C4 parked → defer; B2 scope split → confirm; ADMIN-3 email mechanism → CF-Workers-compatible provider, Resend default). PO answered all three; Victoria revised; PO authorized open-all; Victoria opened 23 issues sequentially as `mvox-dev/mvox_v4e_web` #1-23 + created 13 labels. Collapsed `admin`+`manager` labels into just `admin`. Added "Depends on CHORE-6 before GREEN" note to #21.

**Quality observation**: Victoria's AC are testable and v4E-aware (all 22 user-facing/admin stories are ✅ schema-native — PR #41 covered everything; no 🔧 in v1). The TDD chain has good upstream definition now.

**Lessons captured for future sessions**:
- When the user mentions a new tool/system mid-session ("we have brilliant too"), explore minimally first (session_init + get_types) before deciding scope. Spawning an Explore subagent to digest the session_init dump avoided burning my context on 2,874 lines.
- Cross-repo dependency verification cost: 1 `gh pr view` for PR #41 status. Cheap and useful — Victoria flagged it as a potential dependency; verifying merged-status closed the concern fast.
- Cloudflare API token check via direct `curl https://api.cloudflare.com/client/v4/accounts/<id>/pages/projects` is faster than `wrangler login` round-trips when you have an account-scoped token + account ID.

(*MVOX:Palestrina*)

---

### [DECISION] 2026-05-18 (session 3) — 5 session-2 carryforward gaps resolved with PO

All five gaps surfaced in the session-2 → session-3 seed are now answered. Walked them through one-by-one with PO this session. Outcomes:

| # | Gap | Decision | Lives in |
|---|---|---|---|
| 1 | Missing-role stories (admin, library, section-lead) | **Manager/admin in v1** (~5 stories: create season, create event, invite member, configure org policy, manage roster). Library + section-lead deferred to v2. | Victoria's issue framing (product scope, not arch) |
| 2a | D1 workspace-switcher UX | **No global switcher.** Singer view is unified cross-choir by default (per A1/B1). Contextual switcher only on scoped admin pages. | C1/D1 story AC (UX, not arch) |
| 2b | D1 notification scoping | **Collapsed cross-choir feed** with per-item choir tags + per-choir filter available. | D1 story AC (UX, not arch) |
| 3 | C1 programme-readiness algorithm | **Percentage of active works** = `count(works in status='active') / count(total works in programme)`. | C1 story AC (computational spec, not arch) |
| 4 | Test data strategy | **Empty-state UI first, dogfood via admin flows.** No seed script against polyphony db. | `architecture-decisions.md` (cross-cutting) |
| 5 | CF Pages project name | **`multivox`** (`multivox.pages.dev`). `mvox.pages.dev` is third-party owned. | `architecture-decisions.md` (infra binding) |

**Why this split**: gaps 1/2/3 are product/UX decisions — they belong in the issue text Victoria writes so they're testable per-feature. Gaps 4/5 are cross-cutting (affect every dev's local setup + the deploy URL) — those go in `architecture-decisions.md`. Bentham can prune the arch entries later if the line moves.

**Bonus side-effects this session**:
- `~/.config/mvox/credentials.env` now also carries `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (chmod 600 preserved). Token scope verified active 2026-05-18; sufficient for Pages read; needs `Pages:Edit` upgrade if we want `wrangler pages deploy` from this machine.
- Bentham's two session-2-stale housekeeping flags (common-prompt.md L15 FIXME, his MAY READ "monorepo" reference) were already fixed in session 2 — confirmed and he pruned his scratchpad notes.

**Next**: spawn Victoria with this brief; she drafts the issue list (12 🟢 stories + ~5 admin stories + ~4 scaffolding chores) for PO review **before** opening any GitHub issues.

(*MVOX:Palestrina*)

---

### [PROCESSED 2026-05-18] session-2 → session-3 seed

**Where we are**: stack landed end-to-end in session 2 (SvelteKit 2 + Svelte 5 + TS + Tailwind v4 on Cloudflare, Entu API backend, Entu OAuth + BFF JWT cookie, Paraglide en/et/lv/uk, Vitest+Playwright, pnpm, flat single-app). Team config + 5 role prompts + `architecture-decisions.md` reflect this. Entu credentials probed end-to-end against polyphony db (key exchanges for JWT, JWT works for queries).

**First action (session 3): spawn Victoria.** Her first task: turn the 12 🟢 user stories at `~/projects/entu-research/docs/user-stories.md` into GitHub issues + 4-5 `chore:` scaffolding issues. Story doc is mature (schema-validation pass done 2026-05-18, PR #41 closed all gaps).

**Surface to PO before Victoria finalizes the issue list**:
- No library / org-admin / section-lead stories in the doc — defer to v2 or add now?
- D1 has two UX TODOs (workspace switcher, notification collapse) — need decisions before implementation
- C1 programme-readiness algorithm needs a concrete definition
- Whether to seed test events/works first or implement empty-state UI (polyphony db has 6 orgs + 116 members but 0 events / 0 works)
- Cloudflare Pages project name for mvox (don't collide with entu-research's "entuphony")
- `ENTU_API_KEY` rotation cadence — current key lives in `~/.config/mvox/credentials.env` (chmod 600, outside any repo); not clear how / when PO will rotate. Don't echo the key value anywhere git-tracked.

**Concrete pointers (no re-discovery needed)**:
- Credentials: `~/.config/mvox/credentials.env` (chmod 600, outside any repo)
- v4E schema: `~/projects/entu-research/docs/schema/v4E/{schema.ts,README.md}`
- Entu case study: `~/projects/entu-research/docs/case-studies/2026-05-polyphony-on-entu.md`
- User stories: `~/projects/entu-research/docs/user-stories.md`
- **Entu API base is `https://api.entu.app`** (subdomain, NOT `entu.app/api`) — entu-research's env files have this wrong; we patched our copy
- Auth flow reference impl: `~/projects/entu-research/src/lib/server/entu/auth.ts` + `src/test/api/api-key-exchange.spec.ts` — josquin should read both before scaffolding the auth shell
- Test data state: polyphony db has 6 real Estonian choirs (incl. case-study cast: EKL umbrella + Filharmoonia + Sireen), 116 members, 0 events, 0 works
- JWT `aud` claim has odd format (`<IPv6 prefix>127.0.0.1`) — Entu quirk noted, not blocking, Bentham flagged it for the first auth review

**Suggested session-3 task sequence after Victoria's intro**:
1. Victoria files issues (parallel)
2. Spawn josquin + tallis for scaffolding chores in parallel (`pnpm create svelte` + adapter-cloudflare + Tailwind v4 + Paraglide; auth shell wiring API_KEY→JWT; base Entu client; hooks.server.ts; vitest+playwright configs)
3. Surface listed gaps to PO; get answers
4. A1 (singer's agenda) as first real TDD cycle once scaffolding GREEN — **but don't pile multiple features behind it the same day.** Per Bentham's session-2 close [WARNING]: the first PR (auth/OAuth + first BFF endpoint) carries disproportionate review weight; it sets precedent for cookie flags, CSRF posture, `$env/dynamic/public` discipline, and BFF URL-composition. He's budgeting closer review; you should budget calibration time on your side too.

~~When you've processed this seed, downgrade the tag from `[NEXT SESSION]` to `[PROCESSED]` or remove the section.~~ Processed 2026-05-18 session 3 — see the session-3 [DECISION] entry above for outcomes.

---

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

### [DECISION] 2026-05-18 (session 2) — stack landed end-to-end

PO briefing of v4E + the polyphony-on-entu case study, then locked all five stack-shape choices in a single session:

1. **mvox vs entu-research**: schema-as-contract (option b). mvox is the production fork; consumes v4E from entu-research but otherwise independent codebase.
2. **Hosting**: Cloudflare Pages + Workers via `@sveltejs/adapter-cloudflare`.
3. **i18n**: Paraglide, 4 locales en/et/lv/uk.
4. **v4E schema ownership**: option A — schema lives in entu/research; mvox PRs cite via commit trailers (Bentham's Option A from his session-2 intro, adopted essentially as proposed).
5. **Repo layout**: flat single-app SvelteKit (`src/lib/`, `src/routes/`, `src/lib/server/`). No monorepo until a second deployable exists.

Confirmed stack table (replaced all FIXME/strikethrough cells in `common-prompt.md`):
- SvelteKit 2 + Svelte 5 (Runes) + TS strict + Tailwind v4
- Cloudflare Pages/Workers (no D1, R2, KV, Durable Objects)
- Entu API backend, S3 via signed URLs
- Entu OAuth + BFF JWT cookie (httpOnly, 48h, no refresh)
- Paraglide i18n
- Vitest + Playwright
- pnpm (no workspaces)

Files patched this round:
- `common-prompt.md` — stack table, TDD-chain paths, Known Pitfalls rewrite (added v4E section per case study D1/D3/D6, dropped per-value `_sharing` warning per PO calibration — "not worth the context")
- `prompts/{josquin,byrd,tallis,comenius}.md` — full rewrites (all FIXME blocks resolved, paths flat-app, polyphony patterns removed)
- `prompts/bentham.md` — Security-Critical Files + What to Watch For rewritten with v4E review checklist + concrete flag-#4 trailer rule
- `memory/architecture-decisions.md` — NEW. Seeded with the 5 decisions above. Bentham stewards going forward.
- `~/workspace/CLAUDE.md` — Status flipped to "stack landed"; Open questions collapsed (all four resolved); conventions list extended with v4E trailer rule.

**Bentham's flag #4 is now closed** by the architecture-decisions.md trailer entry. Task #2 in the team task list resolved.

Lesson: when PO is in active decision-making mode, a single session can land an unbounded amount of structural state. Don't over-batch the patches — issue them in the same turn after PO confirms the plan. The Edit/Write tool can take parallel calls; use them.

### [REVERSAL] 2026-05-18 (session 2) — restored FR:Celes / FR:Brunel trailers

PO clarification: Celes and Brunel were not polyphony-dev members — they were the original authors on **framework-research** (`FR:`). My session-1 bulk sed of `PD:` → `MVOX:` was correct for `PD:` author trailers (those were us-via-polyphony), but the 8 prompt files actually carried `PD:Celes` because polyphony-dev had already mis-relabeled the original `FR:Celes` lineage. So `MVOX:Celes` was doubly wrong (both prefix and erasing FR authorship). Same logic applied to `FR:Brunel` → `MVOX:Brunel` change in `.claude/statusline-command.sh` line 19 above — that was also wrong by the same reasoning.

Reverted this session:
- 8 prompt files (`palestrina, josquin, byrd, tallis, bentham, comenius, finn, victoria`): `(*MVOX:Celes*)` → `(*FR:Celes*)`
- `.claude/statusline-command.sh` line 2: `(*MVOX:Brunel*)` → `(*FR:Brunel*)`

Lesson: when bulk-renaming author trailers, distinguish CONTENT lineage (FR/PD = where the file came from) from CURRENT-WORK attribution (MVOX = something we wrote/edited). Original authors keep their FR: trailer in perpetuity unless we substantially rewrite the file. The historical note on L19 above is left as-is (accurate record of what session-1-me did, even though now reverted).

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
