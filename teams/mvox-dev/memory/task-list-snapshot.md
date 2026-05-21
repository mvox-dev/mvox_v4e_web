# Task List Snapshot — 2026-05-21 (end of session 11)

State at shutdown. If session 12 hits State C in Phase 2, restore the active (pending/in_progress) rows below into fresh TaskCreate IDs.

| # | Subject | Status | Owner | Notes |
|---|---|---|---|---|
| 3 | Test + report sub-agent permission-gate silent-block | pending | — | Build dedicated minimal reproduction setup. Confirm: spawn-prompt-initiated tool use requiring permission causes silent block in sub-agent (no surface to parent UI). Submit as issue to Anthropic. Deferred to a future session; not urgent. Reference: this session's Comenius diagnostic. Memory: `feedback_agent_spawn_prompt.md`. |
| 5 | YELLOW-3.2: commit-body process note — enumerate paraglide CLI artifacts | pending | — | Cosmetic carryforward from CHORE-3 Bentham review. When CLI generates auxiliary files (`project.inlang/.gitignore`, `project.inlang/project_id`), enumerate them in commit body so reviewers don't verify empirically. Owner: Byrd (process note). No code change for this PR; remember on next paraglide-touching PR. |

Session-10 carryforwards that did NOT come up in session 11 (still applicable for future sessions):

| # | Subject | Status | Owner | Notes |
|---|---|---|---|---|
| — | CHORE-6 (#6 in GH) — Email Resend wiring | pending | — | Blocked on PO SPF + DKIM DNS records on chosen sender domain. Re-check next session start. |
| — | YELLOW-1 (#19 in GH): CSRF gate at first cookie-authed mutation route | pending | — | Review-gate for next BFF PR introducing a mutation. Josquin's session-11 BFF design proposal flags this explicitly as the gate. |
| — | YELLOW (#32 in GH): relax CHORE-2 OKLCH color assertion on next Tailwind upgrade | pending | — | Brittle exact-value match in `tests/tailwind.spec.ts`. Relax to regex on next Tailwind minor. |

All session-11 phase work tasks (#1, #2, #4, #6, #7, #8) closed in this session.

## Carry-forward summary (full detail in `team-lead.md` [NEXT SESSION] section)

### Session 11 outcome summary

- ✅ **CHORE-3** Paraglide i18n setup — full TDD chain, merged at `7bf0d8f`, issue #3 closed
- ✅ **Comenius spawn structural failure** — root cause identified (sub-agent permission gates don't surface to parent UI); feedback memory saved (`feedback_agent_spawn_prompt.md`); upstream report deferred as task #3
- ✅ **Type-name-string sweep** + **menu rationalization** — PO-directed cleanup; 18 mutations (1 update + 1 delete + 17 creates) on polyphony; post-sweep clean; merged at `3525de1` + `7b21bcb`
- ✅ **YELLOW-3.1** (CHORE-3 follow-up spec refactor) — Tallis solo on direct main; Bentham GREEN post-write; pushed at `6e8c0f4`
- ✅ **BFF rights-aware contracts design proposal** — Josquin authored 340-line doc on `docs/bff-rights-design` branch (commit `78193e3`, pushed but NOT merged); 5 open questions awaiting PO review next session

### Forward-looking work unblocked for session 12

- **BFF design review** — PO reviews `docs/architecture/bff-rights-aware-contracts.md`, answers Q1-Q5, picks implementation scope. Branch `docs/bff-rights-design` awaiting merge after review.
- **First BFF implementation phase** — assuming design review GREEN: full TDD chain for the 2-GET MVP (`/api/organizations` + `/api/organizations/[id]/sections`). Tallis RED → Josquin GREEN → Bentham → Josquin merge. #19 CSRF stays as a gate for the NEXT (mutation) phase, not this one.
- **Byrd frontend scaffolding** — unblocked since CHORE-3 landed; PO directs when ready.

### Team composition delta this session

All 8 sub-agent slots exercised:
- **finn** — Paraglide gitignore research backstop (delivered competing report citing `opral/paraglide-js#424`; misread the issue resolution; received calibration note)
- **bentham** — CHORE-3 review (GREEN+2YELLOW); YELLOW-3.1 post-write check (GREEN)
- **comenius** (original) — alive but slow (~58 min from spawn to first message due to permission gate); delivered solid AC research + i18n phase work
- **comenius-2** (A/B test) — spawned to test the embedded-prompt theory; introed cleanly; shut down once original recovered (theory invalidated by PO's permission-gate finding)
- **tallis** — CHORE-3 RED + YELLOW-3.1 refactor (committed direct to main; protocol bypass corrected via coaching message)
- **byrd** — CHORE-3 GREEN (transparent disclosure on vitest.config.ts scope drift; authorized retroactively)
- **josquin** — CHORE-3 squash-merge + session-11 BFF design proposal
- **perotin** — type-name sweep + menu rationalization (both with manifest-first dry-run discipline)

## Repo state at shutdown (session 11)

- **Branch:** `main` at `6e8c0f4` (pushed) + `docs/bff-rights-design` at `78193e3` (pushed, awaiting PO review)
- **Working tree:** 4 uncommitted memory file mods that need session-11 shutdown commit
- **All session-11 work pushed** to origin/main through `6e8c0f4`

### Session 11 commit chain on main (chronological)

1. `7bf0d8f` feat(#3): Paraglide i18n setup + en/et/lv/uk starter keys + conventions doc (squash of CHORE-3)
2. `3525de1` chore(probe): type-name-string sweep on live polyphony
3. `7b21bcb` chore(seed): rationalize polyphony menu set — one menu per v4E entity type
4. `6e8c0f4` refactor(#3): replace dynamic import probe with existsSync in paraglide spec
5. (this session's shutdown commit — final commit of session 11)

Plus on side branch:
- `78193e3` docs(bff): rights-aware contracts design proposal (pushed to `docs/bff-rights-design`; NOT merged)

## GitHub state

- **Repo:** `mvox-dev/mvox_v4e_web`
- **Closed in session 11:** #3 Paraglide i18n (auto-closed via squash commit's `Closes #3`; team-lead posted structured completion comment after the auto-close)
- **Open issues:** #6 Email, #7-#20 user stories, #21-#23 admin stories, #24 README rewrite, #25 packageManager pin, #29 CONTRIBUTING follow-ups
- **YELLOW-3.1** (CHORE-3 carryforward) closed without an issue — handled inline via task #4
- **YELLOW-3.2** (CHORE-3 carryforward) tracked as task #5; no GH issue filed since it's a process note, not a code change

## Polyphony Entu db state at shutdown (session 11)

- **person:** 122 instances (2 real + 120 v4E-clean seeds). Unchanged from session 10.
- **organization:** 6 instances + 1 TYPE entity, all `_inheritrights=false`. Unchanged from session 10.
- **affiliation / inventory_copy / participation / role:** still retired (0 instances). Unchanged from session 10.
- **menus:** 24 total = 5 Entu meta menus (untouched) + 18 v4E domain menus (1 Organisations [merged from Choirs+Umbrella Orgs] + 17 per-type menus); 1 deleted (Umbrella Orgs); 1 updated (Choirs → Organisations).

## External artifacts created this session

- `scripts/migrations/probes/probe-type-name-string-sweep-2026-05-21.ts`
- `scripts/migrations/seed-menu-items-per-entity-type-2026-05-21.ts`
- `scripts/migrations/seed-results/probe-type-name-string-sweep-*.json` (2 artifacts: pre + post-mutation sweeps)
- `scripts/migrations/seed-results/seed-menu-items-per-entity-type-*.json` (2 artifacts: dry-run + live)
- `docs/migration/findings/type-name-string-sweep-2026-05-21.md`
- `docs/migration/findings/menu-items-per-entity-type-design-2026-05-21.md` (marked COMPLETE)
- `docs/architecture/bff-rights-aware-contracts.md` (340 lines; on `docs/bff-rights-design` branch, awaiting PO review)
- `src/tests/paraglide-setup.spec.ts` (CHORE-3 RED + YELLOW-3.1 refactor)
- `messages/{en,et,lv,uk}.json` (CHORE-3 GREEN + Comenius starter keys)
- `teams/mvox-dev/memory/i18n-conventions.md` (CHORE-3 — Comenius first version)
- `vite.config.ts`, `vitest.config.ts`, `package.json`, `pnpm-lock.yaml`, `.gitignore`, `project.inlang/*` (CHORE-3 install + config)
- Multiple scratchpad updates: `comenius.md` (new), `perotin.md` (session-11 entries), `bentham.md` (session-10 shutdown carryover + session-11 review notes), `team-lead.md` (this session)

(*MVOX:Palestrina*)
