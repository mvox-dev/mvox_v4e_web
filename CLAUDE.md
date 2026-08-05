# CLAUDE.md — mvox

This file is the project-level guidance for Claude Code running in this repo.

## Project

**mvox** — choral music sharing web app built on the v4E schema.

- **Repo:** https://github.com/mvox-dev/mvox_v4e_web
- **Schema source-of-truth:** v4E in the [`entu/research`](https://github.com/entu/research) repo at `docs/schema/v4E/` — typed TS (`schema.ts`), narrative README, single-file diagram editor (`editor.html`).
- **Backend:** Entu (entity-property database platform) — no own database. mvox acts as a BFF in front of Entu's API.
- **Successor to:** the polyphony prototype (now archived at `~/projects/polyphony`, remote `mitselek/polyphony`).

## Status

Repo bootstrapped 2026-05-18. Team config + prompts under `teams/mvox-dev/` are stack-current as of session 2 (2026-05-18). No app code yet — scaffolding is the next concrete task.

**Stack landed** (see `teams/mvox-dev/common-prompt.md` "Stack" and `teams/mvox-dev/memory/architecture-decisions.md` for rationale):
SvelteKit 2 + Svelte 5 (Runes) + TS strict + Tailwind v4 + Vitest + Playwright + pnpm, on Cloudflare Pages/Workers, backed by Entu API (no own DB), auth via Entu OAuth + BFF JWT cookie, i18n via Paraglide (en/et/lv/uk), flat single-app layout.

## Team

Lives at `teams/mvox-dev/`:

- `roster.json` — 9 members (Palestrina/lead, Byrd/frontend, Josquin/backend, Tallis/tests, Bentham/review, Comenius/i18n, Victoria/requirements, Finn/research, Pérotin/data manager — permanent always-on as of 2026-05-20)
- `prompts/<name>.md` — per-agent prompts (adapted to the mvox stack and conventions)
- `common-prompt.md` — team-wide standards (stack landed session 2; see Stack table)
- `startup.md` — Phase 0-6 startup procedure for team-lead

**Startup**: in local mode, the team-lead spawns members via the Agent tool with `team_name: "mvox-dev"`, `name: "<member>"`, `run_in_background: true`. Container/tmux mode is not used here.

## Key conventions

- Use `pnpm`, never `npm`
- All persistent text output authored under `(*MVOX:<AgentName>*)` attribution — exception: files originally authored by another team's member keep the original author's trailer (e.g., `(*FR:Celes*)`) unless substantially rewritten
- Co-author trailer `Co-authored-by: Mihkel Putrinš <mihkel.putrinsh@gmail.com>` on all commits
- TDD chain: Tallis (RED) → Byrd + Josquin (GREEN) → Comenius (i18n) → Bentham (review) → Josquin (merge)
- v4E schema mutations require a PR against `entu/research` first, then a mvox PR with `Schema-Change:` + `PO-Approved:` commit trailers — see `teams/mvox-dev/memory/architecture-decisions.md`
- **The `polyphony` Entu db is the DEV/TEST collective — its data is SYNTHETIC (no real data; import is last).** Routine synthetic-data ops on it (fixtures, markers, test props, refreshes) are **pre-authorized** — no per-op PO escalation. Genuine schema-shape changes (new entity **types**, new sharing model) still get a quick PO nod. Real collectives will be separate clones (polyphony as template); polyphony never holds real data. This supersedes the stale "116 real members / production-shaped" line in `architecture-decisions.md` (Mihkel, 2026-08-05). NOTE: mvox-app-specific marker/config types (e.g. `mvox_collective`) are app extensions, **not** canonical v4E — they skip the `entu/research` PR flow (PO sign-off + direct seed suffices).

## Where things live

| What | Where |
|---|---|
| This repo | `~/workspace/` (i.e., current dir) |
| Schema source-of-truth | `$ENTU_RESEARCH/docs/schema/v4E/` (see `teams/mvox-dev/common-prompt.md` "Path Conventions") |
| Polyphony prototype (archived) | `~/projects/polyphony/` |
| Team runtime config (ephemeral, TeamCreate-managed) | `~/.claude/teams/mvox-dev/` |

## Open questions

All four stack-shape questions resolved in session 2 (2026-05-18). See `teams/mvox-dev/memory/architecture-decisions.md` for the decisions and rationale; `teams/mvox-dev/common-prompt.md` Stack table for the working summary.

Current open items live in `teams/mvox-dev/memory/team-lead.md` under `[DEFERRED]`.
