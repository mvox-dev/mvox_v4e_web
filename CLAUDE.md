# CLAUDE.md — mvox

This file is the project-level guidance for Claude Code running in this repo.

## Project

**mvox** — choral music sharing web app built on the v4E schema.

- **Repo:** https://github.com/mvox-dev/mvox_v4e_web
- **Schema source-of-truth:** v4E in the [`entu/research`](https://github.com/entu/research) repo at `docs/schema/v4E/` — typed TS (`schema.ts`), narrative README, single-file diagram editor (`editor.html`).
- **Backend:** Entu (entity-property database platform) — no own database. mvox acts as a BFF in front of Entu's API.
- **Successor to:** the polyphony prototype (now archived at `~/projects/polyphony`, remote `mitselek/polyphony`).

## Status

Brand new — repo bootstrapped 2026-05-18 with only the dev team's prompts/config under `teams/mvox-dev/`. No app code yet.

Stack decisions pending. Likely SvelteKit-on-Entu following the BFF pattern from the schema work, but unconfirmed.

## Team

Lives at `teams/mvox-dev/`:

- `roster.json` — 8 members (Palestrina/lead, Byrd/frontend, Josquin/backend, Tallis/tests, Bentham/review, Comenius/i18n, Victoria/requirements, Finn/research)
- `prompts/<name>.md` — per-agent prompts (inherited from polyphony-dev, still being adapted — see FIXME markers)
- `common-prompt.md` — team-wide standards (stack table marked TBD)
- `startup.md` — Phase 0-6 startup procedure for team-lead

**Startup**: in local mode, the team-lead spawns members via the Agent tool with `team_name: "mvox-dev"`, `name: "<member>"`, `run_in_background: true`. Container/tmux mode is not used here.

## Key conventions inherited from polyphony

These will be reaffirmed or replaced as mvox's stack settles:

- Use `pnpm`, never `npm`
- All persistent text output authored under `(*PD:<AgentName>*)` attribution
- Co-author trailer `Co-authored-by: Mihkel Putrinš <mihkel.putrinsh@gmail.com>` on all commits
- TDD chain: Tallis (RED) → Byrd + Josquin (GREEN) → Comenius (i18n) → Bentham (review) → Josquin (merge)

## Where things live

| What | Where |
|---|---|
| This repo | `~/workspace/` (i.e., current dir) |
| Schema source-of-truth | `~/projects/entu-research/docs/schema/v4E/` |
| Polyphony prototype (archived) | `~/projects/polyphony/` |
| Team runtime config (ephemeral, TeamCreate-managed) | `~/.claude/teams/mvox-dev/` |

## Open questions for early work

- **Stack** — SvelteKit + Cloudflare like polyphony, or different (Astro, Next, etc.)?
- **Auth** — reuse polyphony's Registry pattern (separate auth gateway with JWKS) or Entu-native auth or something else?
- **Hosting** — Cloudflare Pages/Workers, Vercel, self-hosted?
- **i18n** — same 4 locales (en/et/lv/uk) via Paraglide, or different?
