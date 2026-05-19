# Task List Snapshot — 2026-05-19 (end of session 4)

| # | Subject | Status | Owner | Notes |
|---|---|---|---|---|
| 1 | CHORE-1 (#1) — SvelteKit + adapter-cloudflare bootstrap | completed | josquin | Squash-merged as `6962329`. Issue #1 closed with structured completion comment. Hook installed end-to-end (`prepare-commit-msg` auto-trails). 10/10 tests GREEN. Filed #24 (README rewrite) + #25 (packageManager pin) as Bentham YELLOW followups. |
| 2 | CHORE-2 (#2) — Tailwind v4 | pending (blocked by #1 — now unblocked) | — | Independent of Entu schema. Can proceed in parallel with migration. |
| 3 | CHORE-3 (#3) — Paraglide i18n | pending (blocked by #1 — now unblocked) | — | Independent of Entu schema. Open AC decision: gitignore vs commit `src/lib/paraglide/` — Comenius will recommend on spawn. |
| 4 | CHORE-4 (#4) — Vitest + Playwright configs | pending (blocked by #1 — now unblocked) | — | **~90% already done** by CHORE-1 (configs + 9 vitest tests + 1 playwright test all landed). Only AC remaining: "co-location convention documented" — basically a CONTRIBUTING.md section. Can close fast. |
| 5 | CHORE-5 (#5) — Entu BFF skeleton | pending (blocked by #1, **now blocked by #7**) | — | Do NOT start until at least Phase A of migration is complete. Schema assumptions in any BFF code would be against the wrong shape. |
| 6 | CHORE-6 (#6) — Email (Resend) wiring | pending (blocked by #1) | — | Independent of Entu schema (just adds an email provider). PO action pending: SPF + DKIM DNS records on a chosen sender domain **before #21 GREEN**, NOT before #6 GREEN. |
| 7 | Polyphony db → v4E migration (in-place) | in_progress | finn (research phase) | **PO decision 2026-05-19 00:35**: in-place migration, not new db. Phase A (additive) is first concrete execution. Multi-session. Finn's session-4 handbook delivered at `docs/migration/entu-schema-mutation-handbook.md`. 6 open questions for PO + 8 doc-gap candidates awaiting review. |

## Repo state at shutdown

- **Branch:** `main` (no feature branches active)
- **HEAD:** `d69186a` docs(migration): land Entu schema-mutation handbook
- **All commits pushed to origin/main.**
- Recent commits (newest first):
  - `d69186a` docs(migration): land Entu schema-mutation handbook + session-4→5 seed
  - `e7cf148` chore(mvox-dev): correct Entu docs URL in josquin prompt (entu.dev → entu.ee/overview/)
  - `17e74d8` Tallis [PROCESS] note: team-config commits belong on main not feature branches
  - `85da3ee` Bentham scratchpad — CHORE-1 calibration anchor
  - `6962329` feat(#1): bootstrap SvelteKit + adapter-cloudflare (squash-merge, CHORE-1)
  - `7892b1d` chore(mvox-dev): correct Entu API base URL in josquin prompt (mid-session prompt fix)
- **Hook installed and verified working** — every new commit auto-carries `Co-authored-by: Mihkel Putrinš <mihkel.putrinsh@gmail.com>` via `.githooks/prepare-commit-msg`.

## GitHub state

- **Repo:** `mvox-dev/mvox_v4e_web`
- **Closed this session:** #1 (CHORE-1)
- **Open issues:** #2 Tailwind, #3 Paraglide, #4 Vitest+Playwright docs, #5 BFF skel, #6 Email, #7–#20 user stories, #21–#23 admin stories, **#24 README rewrite (new this session)**, **#25 packageManager pin (new this session)**

## Brilliant KB updates this session

- **Created `Decisions/mvox/polyphony-v4e-divergence`** (`2a1e452e-5ca3-4e66-87a8-4a2d4c0acb82`) — divergence finding + in-place migration decision. Linked `part_of` `Projects/mvox`.
- **Created `Resources/mvox/entu-schema-mutation-handbook`** (`b3406d13-b5a4-4385-a74c-70791a4b4ba8`) — summary of Finn's empirical handbook (full doc in mvox repo at `docs/migration/...`). Linked `relates_to` divergence decision + `relates_to` `Teams/entu` + `part_of` `Projects/mvox`.

## Carried forward (see `team-lead.md` [NEXT SESSION] for full detail)

- **First action session 5**: read Finn's handbook + the 6 open questions for PO. Triage which questions need Argo input, which PO can decide directly.
- **Decision pending PO**: how/where to store schema migration code (entu/research as `scripts/migrations/...`?), attribution convention (`Schema-Change:` trailer direction reverses for migration commits), backup strategy before Phase B+C+D.
- **8 Entu doc-improvement issue candidates** queued for PO+team-lead review before filing.
- **CHORE-4 is nearly free win** — small CONTRIBUTING.md addition closes it.
- **CHORE-2/3 unblocked** if PO wants parallel scaffolding work alongside migration design.

(*MVOX:Palestrina*)
