# CLAUDE.md — mvox

This file is the project-level guidance for Claude Code running in this repo.

## Project

**mvox** — choral music sharing web app built on the v4E schema.

- **Repo:** https://github.com/mvox-dev/mvox_v4e_web
- **Schema:** mvox is independent (Mihkel ruling 2026-09-06) — mvox evolves its own schema; the [`entu/research`](https://github.com/entu/research) v4E docs (`docs/schema/v4E/`) are historical reference/design heritage, not a sync target. New types are commissioned via GitHub issue + PO sign-off; see `~/workspace-app/teams/mvox-dev/common-prompt.md` "Schema Evolution".
- **Backend:** Entu (entity-property database platform) — no own database. mvox acts as a BFF in front of Entu's API.
- **Successor to:** the polyphony prototype (now archived at `~/projects/polyphony`, remote `mitselek/polyphony`).

## Status

Schema repo, bootstrapped 2026-05-18. **Team config moved to the app repo** (`~/workspace-app/teams/mvox-dev/`) as of 2026-08-07.

**Stack landed** (see `~/workspace-app/teams/mvox-dev/common-prompt.md` "Stack" and `~/workspace-app/teams/mvox-dev/memory/architecture-decisions.md` for rationale):
SvelteKit 2 + Svelte 5 (Runes) + TS strict + Tailwind v4 + Vitest + Playwright + pnpm, on Cloudflare Pages/Workers, backed by Entu API (no own DB), auth via Entu OAuth + BFF JWT cookie, i18n via Paraglide (en/et/lv/uk), flat single-app layout.

## Team

Lives at `~/workspace-app/teams/mvox-dev/` (the app repo, not this schema repo).

See the app repo for roster, prompts, common-prompt, startup procedure, and all scratchpads.

## Key conventions

- Use `pnpm`, never `npm`
- All persistent text output authored under `(*MVOX:<AgentName>*)` attribution — exception: files originally authored by another team's member keep the original author's trailer (e.g., `(*FR:Celes*)`) unless substantially rewritten
- Co-author trailer `Co-authored-by: Mihkel Putrinš <mihkel.putrinsh@gmail.com>` on all commits
- TDD chain: Tallis (RED) → Byrd + Josquin (GREEN) → Comenius (i18n) → Bentham (review) → Josquin (merge)
- Schema evolution is mvox-independent (Mihkel 2026-09-06): NO upstream `entu/research` PRs; new entity types/shapes need a PO ruling on the commissioning issue + `PO-Approved:` trailer on the mvox PR (the `Schema-Change:` upstream trailer is retired) — see common-prompt.md "Schema Evolution" + `architecture-decisions.md`
- **The `polyphony` Entu db is the DEV/TEST collective — its data is SYNTHETIC (no real data; import is last).** Routine synthetic-data ops on it (fixtures, markers, test props, refreshes) are **pre-authorized** — no per-op PO escalation. Genuine schema-shape changes (new entity **types**, new sharing model) still get a quick PO nod. Real collectives will be separate clones (polyphony as template); polyphony never holds real data. This supersedes the stale "116 real members / production-shaped" line in `architecture-decisions.md` (Mihkel, 2026-08-05). NOTE: mvox-app-specific marker/config types (e.g. `mvox_collective`) are app extensions, **not** canonical v4E — they skip the `entu/research` PR flow (PO sign-off + direct seed suffices).

## Where things live

| What | Where |
|---|---|
| This repo (schema) | `~/workspace/` (i.e., current dir) |
| App repo | `~/workspace-app/` |
| Team config (source of truth) | `~/workspace-app/teams/mvox-dev/` |
| v4E schema (historical reference only) | `$ENTU_RESEARCH/docs/schema/v4E/` — not a sync target since 2026-09-06; mvox schema-of-record home pending (see common-prompt.md "Schema Evolution") |
| Polyphony prototype (archived) | `~/projects/polyphony/` |
| Team runtime (ephemeral, per-session) | `~/.claude/teams/session-<id>/` |

## Open questions

All four stack-shape questions resolved in session 2 (2026-05-18). See `~/workspace-app/teams/mvox-dev/memory/architecture-decisions.md` for the decisions and rationale; `~/workspace-app/teams/mvox-dev/common-prompt.md` Stack table for the working summary.

Current open items live in `~/workspace-app/teams/mvox-dev/memory/team-lead.md` under `[DEFERRED]`.
