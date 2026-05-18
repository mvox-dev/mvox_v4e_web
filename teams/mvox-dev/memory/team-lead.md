# Palestrina — Team Lead Scratchpad

### [NEXT SESSION] 2026-05-18 — session-3 → session-4

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
